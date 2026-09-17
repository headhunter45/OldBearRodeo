import React, { useEffect, useRef, useState } from 'react';
import {
  GameMap,
  GameSession,
  Player,
  Token,
  DiceRollResult,
  InitiativeState,
  DnDCharacter,
  ScreenMarker,
} from '@oldbear/shared';
import { CanvasEngine, ActiveTool } from './engine/CanvasEngine.js';
import { NetworkClient } from './network/NetworkClient.js';
import { ToolBar } from './components/ToolBar.js';
import { TopBar } from './components/TopBar.js';
import { TokenControls } from './components/TokenControls.js';
import { TokenEditorModal } from './components/TokenEditorModal.js';
import { DiceRoller } from './components/DiceRoller.js';
import { InitiativeTracker } from './components/InitiativeTracker.js';
import { CharacterFlyout, saveCharacterToStorage } from './components/CharacterFlyout.js';
import { MapManagerModal } from './components/MapManagerModal.js';
import { SoundboardModal } from './components/SoundboardModal.js';
import { MobileDrawer } from './components/MobileDrawer.js';
import { VoiceManager, VoiceState } from './network/VoiceManager.js';
import { VoiceSettingsModal } from './components/VoiceSettingsModal.js';
import { DataBackupModal } from './components/DataBackupModal.js';
import { GlobalDropOverlay } from './components/GlobalDropOverlay.js';
import { Mic, Radio } from 'lucide-react';

export const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
  const networkRef = useRef<NetworkClient | null>(null);
  const voiceManagerRef = useRef<VoiceManager | null>(null);

  // App State
  const [session, setSession] = useState<GameSession | null>(null);
  const [localPlayer, setLocalPlayer] = useState<Player | null>(null);
  const [isGm, setIsGm] = useState(false);
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);

  // Voice Chat State
  const [voiceState, setVoiceState] = useState<VoiceState>({
    isInitialized: false,
    isMuted: false,
    isForceMuted: false,
    isDeafened: false,
    isSpeaking: false,
    isPttActive: false,
    transmissionMode: (localStorage.getItem('oldbear_audio_trans_mode') as 'open' | 'ptt') || 'open',
    pttKey: localStorage.getItem('oldbear_audio_ptt_key') || 'KeyV',
    pttKeyDisplay: localStorage.getItem('oldbear_audio_ptt_key_display') || 'V',
    selectedInputId: localStorage.getItem('oldbear_audio_input_device') || 'default',
    selectedOutputId: localStorage.getItem('oldbear_audio_output_device') || 'default',
    isAudioStreaming: false,
    micVolume: 1.0,
    desktopVolume: 0.8,
    localLevel: 0,
  });
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);

  // Modals & Flyouts
  const [showTokenEditor, setShowTokenEditor] = useState(false);
  const [tokenToEdit, setTokenToEdit] = useState<Token | null>(null);
  const [showDiceRoller, setShowDiceRoller] = useState(false);
  const [showInitiative, setShowInitiative] = useState(false);
  const [showCharacterFlyout, setShowCharacterFlyout] = useState(false);
  const [showMapManager, setShowMapManager] = useState(false);
  const [showSoundboard, setShowSoundboard] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);

  // GM Preview Map vs Player Active Map
  const [gmPreviewMapId, setGmPreviewMapId] = useState<string>('');

  // 1. Initialize Network & Session
  useEffect(() => {
    // Extract room ID from URL search param or generate/default
    const params = new URLSearchParams(window.location.search);
    let roomId = params.get('room');
    if (!roomId) {
      const ADJECTIVES = ['daring', 'brave', 'mystic', 'ancient', 'wild', 'shadow', 'golden', 'frost', 'ember', 'arcane'];
      const NOUNS = ['owlbear', 'dragon', 'beholder', 'griffin', 'goblin', 'ranger', 'wizard', 'dungeon', 'cavern', 'tavern'];
      const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
      const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
      const num = Math.floor(Math.random() * 90 + 10);
      roomId = `${adj}-${noun}-${num}`;
      const newUrl = `${window.location.pathname}?room=${roomId}`;
      window.history.replaceState({}, '', newUrl);
    }

    const savedName = localStorage.getItem('oldbear_player_name') || 'Adventurer';
    const savedColor = localStorage.getItem('oldbear_player_color') || '#6366f1';
    const savedGmKey = localStorage.getItem(`oldbear_gmkey_${roomId}`) || undefined;

    const net = new NetworkClient();
    networkRef.current = net;

    net.onMessage((msg) => {
      switch (msg.type) {
        case 'join-ack': {
          setLocalPlayer(msg.player);
          setSession(msg.session);
          setIsGm(msg.isGm);
          setGmPreviewMapId(msg.session.activeMapId);

          if (msg.gmKey) {
            localStorage.setItem(`oldbear_gmkey_${roomId}`, msg.gmKey);
          }
          break;
        }

        case 'sync-session': {
          setSession(msg.session);
          break;
        }

        case 'token-moved': {
          setSession((prev) => {
            if (!prev || !prev.tokens[msg.id]) return prev;
            return {
              ...prev,
              tokens: {
                ...prev.tokens,
                [msg.id]: {
                  ...prev.tokens[msg.id],
                  x: msg.x,
                  y: msg.y,
                  mapId: msg.mapId || prev.tokens[msg.id].mapId,
                },
              },
            };
          });
          break;
        }

        case 'token-updated': {
          setSession((prev) => {
            if (!prev || !prev.tokens[msg.id]) return prev;
            const updated = { ...prev.tokens[msg.id], ...msg.updates };
            return {
              ...prev,
              tokens: { ...prev.tokens, [msg.id]: updated },
            };
          });
          setSelectedToken((prev) => (prev?.id === msg.id ? { ...prev, ...msg.updates } : prev));
          break;
        }

        case 'token-added': {
          setSession((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              tokens: { ...prev.tokens, [msg.token.id]: msg.token },
            };
          });
          break;
        }

        case 'token-deleted': {
          setSession((prev) => {
            if (!prev) return prev;
            const copy = { ...prev.tokens };
            delete copy[msg.id];
            return { ...prev, tokens: copy };
          });
          setSelectedToken((prev) => (prev?.id === msg.id ? null : prev));
          break;
        }

        case 'token-transferred': {
          setSession((prev) => {
            if (!prev || !prev.tokens[msg.id]) return prev;
            return {
              ...prev,
              tokens: {
                ...prev.tokens,
                [msg.id]: {
                  ...prev.tokens[msg.id],
                  mapId: msg.toMapId,
                  x: msg.x,
                  y: msg.y,
                },
              },
            };
          });
          break;
        }

        case 'map-added': {
          setSession((prev) => {
            if (!prev) return prev;
            return { ...prev, maps: [...prev.maps, msg.map] };
          });
          break;
        }

        case 'map-updated': {
          setSession((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              maps: prev.maps.map((m) => (m.id === msg.id ? { ...m, ...msg.updates } : m)),
            };
          });
          break;
        }

        case 'map-switched': {
          setSession((prev) => (prev ? { ...prev, activeMapId: msg.mapId } : prev));
          // If player, update viewport map as well
          if (!net.isGm) {
            setGmPreviewMapId(msg.mapId);
          }
          break;
        }

        case 'fog-updated': {
          setSession((prev) => {
            if (!prev) return prev;
            const fog = prev.fog[msg.mapId] || {
              mapId: msg.mapId,
              globalCovered: false,
              shapes: [],
            };
            const updatedFog = { ...fog };
            if (msg.globalCovered !== undefined) updatedFog.globalCovered = msg.globalCovered;
            if (msg.clearShapes) updatedFog.shapes = [];
            if (msg.newShape) updatedFog.shapes = [...updatedFog.shapes, msg.newShape];

            return {
              ...prev,
              fog: { ...prev.fog, [msg.mapId]: updatedFog },
            };
          });
          break;
        }

        case 'marker-added': {
          setSession((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              markers: [...prev.markers, msg.marker],
            };
          });
          break;
        }

        case 'dice-rolled': {
          setSession((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              diceHistory: [...prev.diceHistory, msg.roll],
            };
          });
          break;
        }

        case 'initiative-updated': {
          setSession((prev) => (prev ? { ...prev, initiative: msg.initiative } : prev));
          break;
        }

        case 'player-updated': {
          if (net.isGm && msg.updates.dndBeyondCharacter) {
            saveCharacterToStorage(msg.updates.dndBeyondCharacter, true);
          }
          setSession((prev) => {
            if (!prev || !prev.players[msg.playerId]) return prev;
            return {
              ...prev,
              players: {
                ...prev.players,
                [msg.playerId]: { ...prev.players[msg.playerId], ...msg.updates },
              },
            };
          });
          break;
        }

        case 'peer-joined': {
          setSession((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              players: { ...prev.players, [msg.player.id]: msg.player },
            };
          });
          break;
        }

        case 'peer-left': {
          setSession((prev) => {
            if (!prev || !prev.players[msg.peerId]) return prev;
            return {
              ...prev,
              players: {
                ...prev.players,
                [msg.peerId]: { ...prev.players[msg.peerId], connected: false },
              },
            };
          });
          break;
        }

        case 'voice-force-mute': {
          if (localPlayer && msg.targetPlayerId === localPlayer.id) {
            voiceManagerRef.current?.handleForceMuted();
          }
          setSession((prev) => {
            if (!prev || !prev.players[msg.targetPlayerId]) return prev;
            return {
              ...prev,
              players: {
                ...prev.players,
                [msg.targetPlayerId]: {
                  ...prev.players[msg.targetPlayerId],
                  isMuted: true,
                  isForceMuted: true,
                },
              },
            };
          });
          break;
        }
      }
    });

    const vm = new VoiceManager();
    voiceManagerRef.current = vm;
    net.setVoiceManager(vm);

    const unsubVoiceState = vm.onStateChange((state) => {
      setVoiceState(state);
      net.send({
        type: 'player-update',
        updates: {
          isMuted: state.isMuted,
          isSpeaking: state.isSpeaking,
          isDeafened: state.isDeafened,
          isForceMuted: state.isForceMuted,
          isAudioStreaming: state.isAudioStreaming,
        },
      });
    });

    const unsubPeerSpeaking = vm.onPeerSpeaking((peerId, isSpeaking) => {
      setSession((prev) => {
        if (!prev || !prev.players[peerId]) return prev;
        return {
          ...prev,
          players: {
            ...prev.players,
            [peerId]: { ...prev.players[peerId], isSpeaking },
          },
        };
      });
    });

    const handleFirstGesture = () => {
      vm.init();
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
    };
    window.addEventListener('click', handleFirstGesture);
    window.addEventListener('keydown', handleFirstGesture);

    net.connect(roomId, savedName, savedColor, savedGmKey);

    return () => {
      unsubVoiceState();
      unsubPeerSpeaking();
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
      vm.destroy();
      net.disconnect();
    };
  }, []);

  const handleToggleMute = () => {
    voiceManagerRef.current?.toggleMute();
  };

  const handleToggleDeafen = () => {
    voiceManagerRef.current?.toggleDeafen();
  };

  const handleForceMutePlayer = (targetPlayerId: string) => {
    networkRef.current?.send({
      type: 'voice-force-mute',
      targetPlayerId,
    });
  };

  // 2. Initialize Canvas Engine
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;

    // Resize to fit viewport
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const engine = new CanvasEngine(canvas);
    engineRef.current = engine;

    engine.callbacks = {
      onTokenMove: (id, x, y) => {
        networkRef.current?.send({
          type: 'token-move',
          id,
          x,
          y,
          mapId: engine.currentMapId,
        });
      },
      onTokenSelect: (tok) => {
        setSelectedToken(tok);
      },
      onMarkerAdd: (marker) => {
        networkRef.current?.send({
          type: 'marker-add',
          marker,
        });
      },
      onFogUpdate: (newShape) => {
        networkRef.current?.send({
          type: 'fog-update',
          mapId: engine.currentMapId,
          newShape,
        });
      },
    };

    return () => {
      window.removeEventListener('resize', handleResize);
      engine.destroy();
    };
  }, []);

  // 3. Keep Canvas Engine In Sync with React State
  useEffect(() => {
    if (!engineRef.current) return;
    if (session) {
      engineRef.current.setSession(session);
    }
    if (localPlayer) {
      engineRef.current.setLocalPlayer(localPlayer);
    }
    const mapIdToView = isGm && gmPreviewMapId ? gmPreviewMapId : session?.activeMapId;
    if (mapIdToView) {
      engineRef.current.setActiveMap(mapIdToView);
    }
    engineRef.current.activeTool = activeTool;
    engineRef.current.snapEnabled = snapEnabled;
  }, [session, localPlayer, isGm, gmPreviewMapId, activeTool, snapEnabled]);

  // Token Actions with Optimistic Local Updates
  const handleUpdateToken = (id: string, updates: Partial<Token>) => {
    setSession((prev) => {
      if (!prev || !prev.tokens[id]) return prev;
      return {
        ...prev,
        tokens: {
          ...prev.tokens,
          [id]: { ...prev.tokens[id], ...updates },
        },
      };
    });
    setSelectedToken((prev) => (prev?.id === id ? { ...prev, ...updates } : prev));
    networkRef.current?.send({
      type: 'token-update',
      id,
      updates,
    });
  };

  const handleDeleteToken = (id: string) => {
    setSession((prev) => {
      if (!prev) return prev;
      const copy = { ...prev.tokens };
      delete copy[id];
      return { ...prev, tokens: copy };
    });
    setSelectedToken((prev) => (prev?.id === id ? null : prev));
    networkRef.current?.send({
      type: 'token-delete',
      id,
    });
  };

  const handleTransferToken = (id: string, toMapId: string) => {
    setSession((prev) => {
      if (!prev || !prev.tokens[id]) return prev;
      return {
        ...prev,
        tokens: {
          ...prev.tokens,
          [id]: { ...prev.tokens[id], mapId: toMapId, x: 350, y: 350 },
        },
      };
    });
    networkRef.current?.send({
      type: 'token-transfer',
      id,
      toMapId,
      x: 350,
      y: 350,
    });
  };

  const findUnoccupiedPosition = (mapId: string, startX = 400, startY = 400, gridSize = 50) => {
    if (!session) return { x: startX, y: startY };
    const existing = Object.values(session.tokens).filter((t) => t.mapId === mapId);
    let x = startX;
    let y = startY;
    let step = 0;
    while (existing.some((t) => Math.hypot(t.x - x, t.y - y) < gridSize * 0.8)) {
      step++;
      const row = Math.floor(step / 6);
      const col = step % 6;
      x = startX + col * gridSize;
      y = startY + row * gridSize;
    }
    return { x, y };
  };

  const handleCreateNewToken = () => {
    if (!session || !localPlayer) return;
    const currentMapId = isGm && gmPreviewMapId ? gmPreviewMapId : session.activeMapId;
    const gridSize = currentMap?.gridSize || 50;
    const pos = findUnoccupiedPosition(currentMapId, 400, 400, gridSize);

    const newToken: Token = {
      id: `token-${crypto.randomUUID()}`,
      mapId: currentMapId,
      name: 'New Token',
      imageUrl: '',
      x: pos.x,
      y: pos.y,
      size: 1,
      rotation: 0,
      ringColor: localPlayer.color || '#3b82f6',
      fillColor: '#1e293b',
      clipCircle: true,
      currentHp: 20,
      maxHp: 20,
      tempHp: 0,
      speed: 30,
      ownerId: isGm ? undefined : localPlayer.id,
      conditions: [],
      isProp: false,
      layer: 'token',
    };

    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tokens: { ...prev.tokens, [newToken.id]: newToken },
      };
    });
    setSelectedToken(newToken);
    engineRef.current?.selectToken(newToken.id);

    networkRef.current?.send({
      type: 'token-add',
      token: newToken,
    });
  };

  const handleDuplicateToken = (token: Token) => {
    if (!session || !localPlayer) return;
    const currentMapId = token.mapId;
    const gridSize = currentMap?.gridSize || 50;
    const pos = findUnoccupiedPosition(currentMapId, token.x + gridSize, token.y, gridSize);

    const nameMatch = token.name.match(/^(.*?)(?:\s+(\d+))?$/);
    const baseName = nameMatch && nameMatch[1] ? nameMatch[1].trim() : token.name;
    const nextNum = nameMatch && nameMatch[2] ? parseInt(nameMatch[2], 10) + 1 : 2;
    const newName = `${baseName} ${nextNum}`;

    const duplicated: Token = {
      ...token,
      id: `token-${crypto.randomUUID()}`,
      name: newName,
      x: pos.x,
      y: pos.y,
    };

    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tokens: { ...prev.tokens, [duplicated.id]: duplicated },
      };
    });
    setSelectedToken(duplicated);
    engineRef.current?.selectToken(duplicated.id);

    networkRef.current?.send({
      type: 'token-add',
      token: duplicated,
    });
  };

  // Profile Update
  const handleUpdateProfile = (name: string, color: string) => {
    localStorage.setItem('oldbear_player_name', name);
    localStorage.setItem('oldbear_player_color', color);
    if (localPlayer) {
      const updated = { ...localPlayer, name, color };
      setLocalPlayer(updated);
      networkRef.current?.send({
        type: 'player-update',
        updates: { name, color },
      });
    }
  };

  const handleUpdateMap = (id: string, updates: Partial<GameMap>) => {
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        maps: prev.maps.map((m) => (m.id === id ? { ...m, ...updates } : m)),
      };
    });
    networkRef.current?.send({ type: 'map-update', id, updates });
  };

  const currentMap =
    session?.maps.find((m) => m.id === (isGm && gmPreviewMapId ? gmPreviewMapId : session.activeMapId)) ||
    session?.maps[0];

  const handleToggleGrid = () => {
    if (!currentMap) return;
    const newShowGrid = currentMap.showGrid === false ? true : false;
    handleUpdateMap(currentMap.id, { showGrid: newShowGrid });
  };

  const assignedToken = localPlayer
    ? Object.values(session?.tokens || {}).find((t) => t.ownerId === localPlayer.id)
    : null;

  // Keyboard shortcut: Ctrl+D / Cmd+D to duplicate selected token
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) {
          return;
        }
        if (selectedToken) {
          e.preventDefault();
          handleDuplicateToken(selectedToken);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedToken, session, localPlayer, currentMap]);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* 2D Viewport Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          touchAction: 'none',
          cursor:
            activeTool === 'pan'
              ? 'grab'
              : activeTool === 'laser'
              ? 'crosshair'
              : activeTool.startsWith('fog')
              ? 'crosshair'
              : 'default',
        }}
      />

      {/* Top Header Bar */}
      {session && (
        <TopBar
          roomName={session.name}
          activeMapName={currentMap?.name || 'Default Map'}
          isGm={isGm}
          players={Object.values(session.players)}
          localPlayer={localPlayer}
          voiceState={voiceState}
          onToggleMute={handleToggleMute}
          onToggleDeafen={handleToggleDeafen}
          onOpenVoiceSettings={() => setShowVoiceSettings(true)}
          onOpenDice={() => setShowDiceRoller((v) => !v)}
          onOpenInitiative={() => setShowInitiative((v) => !v)}
          onOpenCharacter={() => setShowCharacterFlyout((v) => !v)}
          onOpenMaps={() => setShowMapManager(true)}
          onOpenSoundboard={() => setShowSoundboard(true)}
          onOpenBackup={() => setShowBackupModal(true)}
          onAddNewToken={handleCreateNewToken}
          onToggleMobileDrawer={() => setShowMobileDrawer((v) => !v)}
        />
      )}

      {/* Left Floating Tools */}
      <ToolBar
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        isGm={isGm}
        snapEnabled={snapEnabled}
        onToggleSnap={() => setSnapEnabled((v) => !v)}
        showGrid={currentMap?.showGrid !== false}
        onToggleGrid={handleToggleGrid}
        userColor={localPlayer?.color || '#6366f1'}
        onChangeColor={(c) => handleUpdateProfile(localPlayer?.name || 'Player', c)}
      />

      {/* Selected Token Floating Controls */}
      {selectedToken && session && (
        <TokenControls
          token={selectedToken}
          onUpdateToken={handleUpdateToken}
          onDeleteToken={handleDeleteToken}
          onDuplicateToken={handleDuplicateToken}
          onTransferToken={handleTransferToken}
          onOpenFullEditor={() => {
            setTokenToEdit(selectedToken);
            setShowTokenEditor(true);
          }}
          canControl={
            isGm ||
            selectedToken.ownerId === localPlayer?.id ||
            Boolean(localPlayer?.assignedTokenIds?.includes(selectedToken.id))
          }
          isGm={isGm}
          maps={session.maps}
          players={Object.values(session.players)}
        />
      )}

      {/* Floating / Mobile Modal Dice Roller Panel */}
      {showDiceRoller && session && localPlayer && (
        <div className="hud-panel-container">
          <DiceRoller
            userName={localPlayer.name}
            userColor={localPlayer.color}
            userId={localPlayer.id}
            onRoll={(roll) => networkRef.current?.send({ type: 'dice-roll', roll })}
            rollHistory={session.diceHistory}
            onClose={() => setShowDiceRoller(false)}
          />
        </div>
      )}

      {/* Floating / Mobile Modal Initiative Tracker Panel */}
      {showInitiative && session && (
        <div className="hud-panel-container" style={{ right: showDiceRoller ? '22rem' : '1rem' }}>
          <InitiativeTracker
            initiative={session.initiative}
            onUpdateInitiative={(initiative) => {
              setSession((prev) => (prev ? { ...prev, initiative } : prev));
              networkRef.current?.send({ type: 'initiative-update', initiative });
            }}
            tokens={session.tokens}
            selectedToken={selectedToken}
            isGm={isGm}
            onClose={() => setShowInitiative(false)}
          />
        </div>
      )}

      {/* Slide-out Character Sheet Flyout */}
      {showCharacterFlyout && localPlayer && (
        <CharacterFlyout
          player={localPlayer}
          targetToken={selectedToken || assignedToken}
          onSyncToken={(tokenId, updates) => {
            handleUpdateToken(tokenId, updates);
          }}
          onUpdatePlayerChar={(dndBeyondCharacter) => {
            setLocalPlayer((p) => (p ? { ...p, dndBeyondCharacter } : p));
            networkRef.current?.send({
              type: 'player-update',
              updates: { dndBeyondCharacter },
            });
          }}
          onClose={() => setShowCharacterFlyout(false)}
          isGm={isGm}
        />
      )}

      {/* Full Token Editor Modal */}
      {showTokenEditor && tokenToEdit && session && (
        <TokenEditorModal
          token={tokenToEdit}
          onClose={() => setShowTokenEditor(false)}
          onSave={(updates) => handleUpdateToken(tokenToEdit.id, updates)}
          players={Object.values(session.players)}
          isGm={isGm}
        />
      )}

      {/* GM Maps Manager Modal */}
      {showMapManager && session && (
        <MapManagerModal
          maps={session.maps}
          activeMapId={session.activeMapId}
          currentGmPreviewMapId={gmPreviewMapId}
          onSelectGmPreviewMap={(id) => setGmPreviewMapId(id)}
          onSetActiveMapForPlayers={(id) => {
            networkRef.current?.send({ type: 'map-switch', mapId: id });
          }}
          onAddMap={(newMap) => {
            setSession((prev) => (prev ? { ...prev, maps: [...prev.maps, newMap] } : prev));
            setGmPreviewMapId(newMap.id);
            networkRef.current?.send({ type: 'map-add', map: newMap });
          }}
          onUpdateMap={handleUpdateMap}
          onClose={() => setShowMapManager(false)}
        />
      )}

      {/* Soundboard Modal */}
      {showSoundboard && (
        <SoundboardModal
          isGm={isGm}
          onClose={() => setShowSoundboard(false)}
          onBroadcastAudioAction={(trackId, action, volume) => {
            networkRef.current?.send({
              type: 'audio-action',
              trackId,
              action,
              volume,
            });
          }}
        />
      )}

      {/* Voice Settings Modal */}
      {showVoiceSettings && voiceManagerRef.current && session && (
        <VoiceSettingsModal
          voiceManager={voiceManagerRef.current}
          voiceState={voiceState}
          players={Object.values(session.players)}
          localPlayer={localPlayer}
          isGm={isGm}
          onForceMutePlayer={handleForceMutePlayer}
          onClose={() => setShowVoiceSettings(false)}
        />
      )}

      {/* Full Data Backup & Transfer Modal (Export / Import) */}
      {showBackupModal && (
        <DataBackupModal
          session={session}
          isGm={isGm}
          onRestoreSession={(restoredSession) => {
            setSession(restoredSession);
            if (networkRef.current && isGm) {
              for (const map of restoredSession.maps) {
                networkRef.current.send({ type: 'map-add', map });
              }
              for (const tok of Object.values(restoredSession.tokens)) {
                networkRef.current.send({ type: 'token-add', token: tok });
              }
              if (restoredSession.initiative) {
                networkRef.current.send({ type: 'initiative-update', initiative: restoredSession.initiative });
              }
            }
          }}
          onClose={() => setShowBackupModal(false)}
        />
      )}

      {/* Global Drag & Drop Handler (Maps, Tokens, Audio, Backups) */}
      <GlobalDropOverlay
        isGm={isGm}
        activeMapId={currentMap?.id || session?.activeMapId || ''}
        gridSize={currentMap?.gridSize || 50}
        onAddMap={(newMap) => {
          setSession((prev) => (prev ? { ...prev, maps: [...prev.maps, newMap] } : prev));
          setGmPreviewMapId(newMap.id);
          networkRef.current?.send({ type: 'map-add', map: newMap });
        }}
        onAddToken={(newToken) => {
          setSession((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              tokens: { ...prev.tokens, [newToken.id]: newToken },
            };
          });
          networkRef.current?.send({ type: 'token-add', token: newToken });
          engineRef.current?.selectToken(newToken.id);
        }}
      />

      {/* On-Screen Push-to-Talk touch button for mobile / touch screens */}
      {voiceState.transmissionMode === 'ptt' && (
        <div
          className="floating-hud"
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            zIndex: 40,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.35rem',
          }}
        >
          <button
            onMouseDown={() => voiceManagerRef.current?.setPttActive(true)}
            onMouseUp={() => voiceManagerRef.current?.setPttActive(false)}
            onTouchStart={(e) => {
              e.preventDefault();
              voiceManagerRef.current?.setPttActive(true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              voiceManagerRef.current?.setPttActive(false);
            }}
            onTouchCancel={(e) => {
              e.preventDefault();
              voiceManagerRef.current?.setPttActive(false);
            }}
            className="btn glass-panel"
            style={{
              padding: '0.75rem 1.3rem',
              borderRadius: 'var(--radius-full)',
              backgroundColor: voiceState.isPttActive
                ? 'var(--accent-emerald)'
                : 'rgba(17, 24, 39, 0.85)',
              borderColor: voiceState.isPttActive ? '#ffffff' : 'var(--border-strong)',
              boxShadow: voiceState.isPttActive
                ? '0 0 20px var(--accent-emerald)'
                : '0 8px 24px rgba(0,0,0,0.5)',
              color: 'white',
              fontWeight: 800,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transform: voiceState.isPttActive ? 'scale(1.05)' : 'scale(1)',
              transition: 'all 0.1s ease',
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }}
          >
            {voiceState.isPttActive ? <Mic size={18} /> : <Radio size={18} />}
            <span>{voiceState.isPttActive ? 'TRANSMITTING' : `PTT [${voiceState.pttKeyDisplay}]`}</span>
          </button>
        </div>
      )}

      {/* Mobile Navigation Drawer */}
      <MobileDrawer
        isOpen={showMobileDrawer}
        onClose={() => setShowMobileDrawer(false)}
        localPlayer={localPlayer}
        onUpdatePlayerName={handleUpdateProfile}
        onOpenDice={() => setShowDiceRoller(true)}
        onOpenInitiative={() => setShowInitiative(true)}
        onOpenCharacter={() => setShowCharacterFlyout(true)}
        onOpenMaps={() => setShowMapManager(true)}
        onOpenSoundboard={() => setShowSoundboard(true)}
        onOpenBackup={() => setShowBackupModal(true)}
        voiceState={voiceState}
        onToggleMute={handleToggleMute}
        onToggleDeafen={handleToggleDeafen}
        onOpenVoiceSettings={() => setShowVoiceSettings(true)}
        isGm={isGm}
      />
    </div>
  );
};
