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
import { CharacterFlyout } from './components/CharacterFlyout.js';
import { MapManagerModal } from './components/MapManagerModal.js';
import { SoundboardModal } from './components/SoundboardModal.js';
import { MobileDrawer } from './components/MobileDrawer.js';

export const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
  const networkRef = useRef<NetworkClient | null>(null);

  // App State
  const [session, setSession] = useState<GameSession | null>(null);
  const [localPlayer, setLocalPlayer] = useState<Player | null>(null);
  const [isGm, setIsGm] = useState(false);
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);

  // Modals & Flyouts
  const [showTokenEditor, setShowTokenEditor] = useState(false);
  const [tokenToEdit, setTokenToEdit] = useState<Token | null>(null);
  const [showDiceRoller, setShowDiceRoller] = useState(false);
  const [showInitiative, setShowInitiative] = useState(false);
  const [showCharacterFlyout, setShowCharacterFlyout] = useState(false);
  const [showMapManager, setShowMapManager] = useState(false);
  const [showSoundboard, setShowSoundboard] = useState(false);
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);

  // GM Preview Map vs Player Active Map
  const [gmPreviewMapId, setGmPreviewMapId] = useState<string>('');

  // 1. Initialize Network & Session
  useEffect(() => {
    // Extract room ID from URL search param or generate/default
    const params = new URLSearchParams(window.location.search);
    let roomId = params.get('room');
    if (!roomId) {
      roomId = 'daring-owlbear-1';
      // Update URL without reloading
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
      }
    });

    net.connect(roomId, savedName, savedColor, savedGmKey);

    return () => {
      net.disconnect();
    };
  }, []);

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

  // Token Actions
  const handleUpdateToken = (id: string, updates: Partial<Token>) => {
    networkRef.current?.send({
      type: 'token-update',
      id,
      updates,
    });
  };

  const handleDeleteToken = (id: string) => {
    networkRef.current?.send({
      type: 'token-delete',
      id,
    });
  };

  const handleTransferToken = (id: string, toMapId: string) => {
    networkRef.current?.send({
      type: 'token-transfer',
      id,
      toMapId,
      x: 350,
      y: 350,
    });
  };

  const handleCreateNewToken = () => {
    if (!session || !localPlayer) return;
    const currentMapId = isGm && gmPreviewMapId ? gmPreviewMapId : session.activeMapId;

    const newToken: Token = {
      id: `token-${crypto.randomUUID()}`,
      mapId: currentMapId,
      name: 'New Token',
      imageUrl: '',
      x: 400,
      y: 400,
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

    networkRef.current?.send({
      type: 'token-add',
      token: newToken,
    });

    setSelectedToken(newToken);
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

  const currentMap =
    session?.maps.find((m) => m.id === (isGm && gmPreviewMapId ? gmPreviewMapId : session.activeMapId)) ||
    session?.maps[0];

  const assignedToken = localPlayer
    ? Object.values(session?.tokens || {}).find((t) => t.ownerId === localPlayer.id)
    : null;

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
          onOpenDice={() => setShowDiceRoller((v) => !v)}
          onOpenInitiative={() => setShowInitiative((v) => !v)}
          onOpenCharacter={() => setShowCharacterFlyout((v) => !v)}
          onOpenMaps={() => setShowMapManager(true)}
          onOpenSoundboard={() => setShowSoundboard(true)}
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
        userColor={localPlayer?.color || '#6366f1'}
        onChangeColor={(c) => handleUpdateProfile(localPlayer?.name || 'Player', c)}
      />

      {/* Selected Token Floating Controls */}
      {selectedToken && session && (
        <TokenControls
          token={selectedToken}
          onUpdateToken={handleUpdateToken}
          onDeleteToken={handleDeleteToken}
          onTransferToken={handleTransferToken}
          onOpenFullEditor={() => {
            setTokenToEdit(selectedToken);
            setShowTokenEditor(true);
          }}
          canControl={isGm || selectedToken.ownerId === localPlayer?.id}
          isGm={isGm}
          maps={session.maps}
        />
      )}

      {/* Floating Dice Roller Panel */}
      {showDiceRoller && session && localPlayer && (
        <div className="floating-hud" style={{ right: '1rem', top: '4.5rem' }}>
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

      {/* Floating Initiative Tracker Panel */}
      {showInitiative && session && (
        <div className="floating-hud" style={{ right: showDiceRoller ? '22rem' : '1rem', top: '4.5rem' }}>
          <InitiativeTracker
            initiative={session.initiative}
            onUpdateInitiative={(initiative) =>
              networkRef.current?.send({ type: 'initiative-update', initiative })
            }
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
          assignedToken={assignedToken}
          onUpdateTokenHp={(tokenId, currentHp, maxHp, speed) => {
            handleUpdateToken(tokenId, { currentHp, maxHp, speed });
          }}
          onUpdatePlayerChar={(dndBeyondCharacter) => {
            setLocalPlayer((p) => (p ? { ...p, dndBeyondCharacter } : p));
            networkRef.current?.send({
              type: 'player-update',
              updates: { dndBeyondCharacter },
            });
          }}
          onClose={() => setShowCharacterFlyout(false)}
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
            networkRef.current?.send({ type: 'map-add', map: newMap });
          }}
          onUpdateMap={(id, updates) => {
            networkRef.current?.send({ type: 'map-update', id, updates });
          }}
          onClose={() => setShowMapManager(false)}
        />
      )}

      {/* Soundboard Modal */}
      {showSoundboard && (
        <SoundboardModal isGm={isGm} onClose={() => setShowSoundboard(false)} />
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
        isGm={isGm}
      />
    </div>
  );
};
