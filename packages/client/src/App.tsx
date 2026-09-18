import React, { useEffect, useRef, useState } from 'react';
import {
  GameMap,
  GameSession,
  Player,
  Token,
  DiceRollResult,
  InitiativeState,
  InitiativeItem,
  DnDCharacter,
  ScreenMarker,
  ChatMessage,
  generateRandomName,
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
import { TokenPickerModal } from './components/TokenPickerModal.js';
import { BatchTokenTransferModal } from './components/BatchTokenTransferModal.js';
import { PlayerTokenPickerModal } from './components/PlayerTokenPickerModal.js';
import { RollAnnouncementBanner } from './components/RollAnnouncementBanner.js';
import { TurnAnnouncementBanner, TurnAnnouncement } from './components/TurnAnnouncementBanner.js';
import { ChatPanel } from './components/ChatPanel.js';
import { TOAST_DURATION_MS } from './config/toast.js';
import { Mic, Radio, Compass, Check, AlertTriangle, RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
  const networkRef = useRef<NetworkClient | null>(null);
  const voiceManagerRef = useRef<VoiceManager | null>(null);

  // App State
  const [session, setSession] = useState<GameSession | null>(null);
  const sessionRef = useRef<GameSession | null>(null);
  sessionRef.current = session;

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string, durationMs = TOAST_DURATION_MS) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, durationMs);
  };

  const [localPlayer, setLocalPlayer] = useState<Player | null>(null);
  const [isGm, setIsGm] = useState(false);
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [selectedTokens, setSelectedTokens] = useState<Token[]>([]);

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
  const [showTokenPickerModal, setShowTokenPickerModal] = useState(false);
  const [showBatchTransferModal, setShowBatchTransferModal] = useState(false);
  const [showPlayerTokenPickerModal, setShowPlayerTokenPickerModal] = useState(false);
  const [availablePlayerTokens, setAvailablePlayerTokens] = useState<Token[]>([]);

  // Chat & Dice Announcement State (Bugs #43, #45, #67)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [activeRollAnnouncement, setActiveRollAnnouncement] = useState<DiceRollResult | null>(null);
  const [activeTurnAnnouncement, setActiveTurnAnnouncement] = useState<TurnAnnouncement | null>(null);
  const prevInitTurnRef = useRef<{ round: number; index: number; id?: string } | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // GM Preview Map vs Player Active Map
  const [gmPreviewMapId, setGmPreviewMapId] = useState<string>('');

  // Connection & Signaling Status
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error' | 'disconnected'>('connecting');
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // 1. Initialize Network & Session
  useEffect(() => {
    // Extract room ID from URL search param or generate/default
    const params = new URLSearchParams(window.location.search);
    const isNewRoom = !params.get('room');
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

    const savedGmKey = localStorage.getItem(`oldbear_gmkey_${roomId}`) || undefined;
    const isLikelyGm = isNewRoom || Boolean(savedGmKey);

    let savedName = localStorage.getItem('oldbear_player_name');
    if (isLikelyGm) {
      if (!savedName || savedName === 'Adventurer' || savedName === 'Game Master') {
        savedName = 'GM';
      }
    } else {
      if (!savedName || savedName === 'Adventurer' || savedName === 'Game Master') {
        savedName = generateRandomName();
        localStorage.setItem('oldbear_player_name', savedName);
      }
    }
    const savedColor = localStorage.getItem('oldbear_player_color') || (isLikelyGm ? '#ef4444' : '#6366f1');

    const net = new NetworkClient();
    networkRef.current = net;

    net.onStatusChange((status, error) => {
      setConnectionStatus(status);
      if (error) {
        setConnectionError(error);
      }
    });

    net.onMessage((msg) => {
      switch (msg.type) {
        case 'join-ack': {
          setConnectionStatus('connected');
          setConnectionError(null);
          if (msg.isGm && (msg.player.name === 'Adventurer' || msg.player.name === 'Game Master')) {
            msg.player.name = 'GM';
          }
          setLocalPlayer(msg.player);
          setSession(msg.session);
          setIsGm(msg.isGm);
          setGmPreviewMapId(msg.session.activeMapId);

          if (msg.player?.id) {
            localStorage.setItem('oldbear_player_id', msg.player.id);
          }
          if (msg.gmKey) {
            localStorage.setItem(`oldbear_gmkey_${roomId}`, msg.gmKey);
          }

          // Player token claiming prompt on join (Bug #42)
          if (!msg.isGm) {
            const allTokens = Object.values(msg.session.tokens);
            const unclaimed = allTokens.filter(
              (t) => (t.isPlayerToken || t.ownerId === 'unassigned') && t.ownerId !== msg.player.id
            );
            const hasAssigned = allTokens.some((t) => t.ownerId === msg.player.id);
            if (!hasAssigned && unclaimed.length > 0) {
              setAvailablePlayerTokens(unclaimed);
              setShowPlayerTokenPickerModal(true);
            }
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
          setSession((prev) => {
            if (!prev) return prev;
            const targetMap = prev.maps.find((m) => m.id === msg.mapId);
            if (!net.isGm && targetMap) {
              showToast(`GM moved everyone to ${targetMap.name}`);
            }
            return { ...prev, activeMapId: msg.mapId };
          });
          setGmPreviewMapId(msg.mapId);
          if (engineRef.current) {
            engineRef.current.setActiveMap(msg.mapId);
            const targetMap = sessionRef.current?.maps.find((m) => m.id === msg.mapId);
            if (targetMap) {
              engineRef.current.viewport.centerOn(
                targetMap.width / 2,
                targetMap.height / 2,
                window.innerWidth,
                window.innerHeight
              );
            }
          }
          break;
        }

        case 'map-deleted': {
          setSession((prev) => {
            if (!prev) return prev;
            const remaining = prev.maps.filter((m) => m.id !== msg.mapId);
            return {
              ...prev,
              maps: remaining,
              activeMapId: msg.activeMapId || (remaining[0]?.id || ''),
            };
          });
          if (gmPreviewMapId === msg.mapId && msg.activeMapId) {
            setGmPreviewMapId(msg.activeMapId);
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
            if (msg.newShape) {
              const exists = updatedFog.shapes.some((s) => s.id === msg.newShape?.id);
              if (!exists) {
                updatedFog.shapes = [...updatedFog.shapes, msg.newShape];
              }
            }

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
          setActiveRollAnnouncement(msg.roll);
          setSession((prev) => {
            if (!prev) return prev;
            const history = prev.diceHistory || [];
            if (history.some((r) => r.id === msg.roll.id)) return prev;
            return {
              ...prev,
              diceHistory: [...history, msg.roll],
            };
          });
          break;
        }

        case 'chat-message': {
          if (msg.message.recipientId && msg.message.recipientId !== localPlayer?.id) {
            break;
          }
          setChatMessages((prev) => [...prev, msg.message]);
          if (!isChatOpen) {
            setUnreadChatCount((c) => c + 1);
          }
          if (msg.message.roll) {
            setActiveRollAnnouncement(msg.message.roll);
            setSession((prev) => {
              if (!prev) return prev;
              const history = prev.diceHistory || [];
              if (history.some((r) => r.id === msg.message.roll!.id)) return prev;
              return {
                ...prev,
                diceHistory: [...history, msg.message.roll!],
              };
            });
          }
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
    const savedPlayerId = localStorage.getItem('oldbear_player_id') || undefined;
    net.connect(roomId, savedName, savedColor, savedGmKey, savedPlayerId);

    return () => {
      unsubVoiceState();
      unsubPeerSpeaking();
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
      vm.destroy();
      net.disconnect();
    };
  }, []);

  // Turn Change Announcement Listener (Bug #67)
  useEffect(() => {
    if (!session?.initiative || session.initiative.items.length === 0) return;
    const init = session.initiative;
    const currentItem = init.items[init.currentTurnIndex];
    if (!currentItem) return;

    if (!prevInitTurnRef.current) {
      prevInitTurnRef.current = { round: init.round, index: init.currentTurnIndex, id: currentItem.id };
      return;
    }

    if (
      prevInitTurnRef.current.round !== init.round ||
      prevInitTurnRef.current.index !== init.currentTurnIndex ||
      prevInitTurnRef.current.id !== currentItem.id
    ) {
      prevInitTurnRef.current = { round: init.round, index: init.currentTurnIndex, id: currentItem.id };
      setActiveTurnAnnouncement({ combatant: currentItem, round: init.round });

      if (isGm) {
        const turnMsg: ChatMessage = {
          id: crypto.randomUUID(),
          senderId: 'system',
          senderName: 'Initiative Tracker',
          senderColor: '#f59e0b',
          text: `⚔️ **Round ${init.round}**: It's now **${currentItem.name}**'s turn!`,
          timestamp: Date.now(),
        };
        networkRef.current?.send({ type: 'chat-send', message: turnMsg });
        setChatMessages((prev) => [...prev, turnMsg]);
      }
    }
  }, [session?.initiative, isGm]);

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
        setSelectedTokens(tok ? [tok] : []);
      },
      onTokensSelect: (toks) => {
        setSelectedTokens(toks);
        setSelectedToken(toks[0] || null);
      },
      onMarkerAdd: (marker) => {
        networkRef.current?.send({
          type: 'marker-add',
          marker,
        });
      },
      onFogUpdate: (newShape) => {
        const targetMapId = engine.currentMapId;
        setSession((prev) => {
          if (!prev) return prev;
          const fog = prev.fog[targetMapId] || {
            mapId: targetMapId,
            globalCovered: false,
            shapes: [],
          };
          return {
            ...prev,
            fog: {
              ...prev.fog,
              [targetMapId]: {
                ...fog,
                shapes: [...fog.shapes, newShape],
              },
            },
          };
        });
        networkRef.current?.send({
          type: 'fog-update',
          mapId: targetMapId,
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

  };

  const handleCreateNewTokenFromPicker = (data: { name: string; imageUrl?: string; size: number }) => {
    if (!session || !localPlayer) return;
    const currentMapId = isGm && gmPreviewMapId ? gmPreviewMapId : session.activeMapId;
    const gridSize = currentMap?.gridSize || 50;
    const pos = findUnoccupiedPosition(currentMapId, 400, 400, gridSize);

    const newToken: Token = {
      id: `token-${crypto.randomUUID()}`,
      mapId: currentMapId,
      name: data.name,
      imageUrl: data.imageUrl || '',
      x: pos.x,
      y: pos.y,
      size: data.size || 1,
      rotation: 0,
      ringColor: localPlayer.color || '#3b82f6',
      fillColor: '#1e293b',
      clipCircle: true,
      clipShape: 'circle',
      currentHp: 20,
      maxHp: 20,
      tempHp: 0,
      speed: 30,
      ownerId: isGm ? undefined : localPlayer.id,
      isPlayerToken: !isGm,
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

  const handleCreateTokenForCharacter = (char: DnDCharacter) => {
    if (!session || !localPlayer) return;
    const currentMapId = isGm && gmPreviewMapId ? gmPreviewMapId : session.activeMapId;
    const activeMap = session.maps.find((m) => m.id === currentMapId) || session.maps[0];
    const mapW = activeMap?.width || 2000;
    const mapH = activeMap?.height || 1500;

    const newToken: Token = {
      id: `token-${crypto.randomUUID()}`,
      mapId: currentMapId,
      name: char.name,
      imageUrl: char.avatarUrl || '',
      x: Math.round(mapW / 2 - 25),
      y: mapH + 20, // Just off the map near bottom (Bug #41)
      size: 1,
      rotation: 0,
      ringColor: localPlayer.color || '#3b82f6',
      fillColor: '#1e293b',
      clipCircle: true,
      clipShape: 'circle',
      currentHp: char.currentHp,
      maxHp: char.maxHp,
      tempHp: 0,
      speed: char.speed,
      ownerId: localPlayer.id,
      isPlayerToken: true,
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
    showToast(`Created token for ${char.name} just off the bottom of the map`);
  };

  const handleClaimPlayerToken = (token: Token) => {
    if (!localPlayer) return;
    handleUpdateToken(token.id, {
      ownerId: localPlayer.id,
      isPlayerToken: true,
    });
    handleUpdateProfile(localPlayer.name, localPlayer.color);
    setSelectedToken(token);
    engineRef.current?.selectToken(token.id);
    showToast(`Claimed control of ${token.name}`);
  };

  const handleBatchTransferTokens = (tokenIds: string[], targetMapId: string) => {
    if (!session) return;
    const targetMap = session.maps.find((m) => m.id === targetMapId);
    const gSize = targetMap?.gridSize || 50;

    setSession((prev) => {
      if (!prev) return prev;
      const updatedTokens = { ...prev.tokens };
      tokenIds.forEach((id, idx) => {
        if (updatedTokens[id]) {
          const newX = 200 + (idx % 5) * (gSize * 1.5);
          const newY = 200 + Math.floor(idx / 5) * (gSize * 1.5);
          updatedTokens[id] = {
            ...updatedTokens[id],
            mapId: targetMapId,
            x: newX,
            y: newY,
          };
          networkRef.current?.send({
            type: 'token-update',
            id,
            updates: { mapId: targetMapId, x: newX, y: newY },
          });
        }
      });
      return { ...prev, tokens: updatedTokens };
    });
    showToast(`Moved ${tokenIds.length} tokens to ${targetMap?.name || 'map'}`);
  };

  const handleSetActiveMapForPlayers = (mapId: string) => {
    setSession((prev) => (prev ? { ...prev, activeMapId: mapId } : prev));
    setGmPreviewMapId(mapId);
    networkRef.current?.send({ type: 'map-switch', mapId });
    const targetMap = session?.maps.find((m) => m.id === mapId);
    showToast(`Sent all players to ${targetMap?.name || 'map'}`);
  };

  const handleSendPlayersWithTokens = (targetMapId: string) => {
    handleSetActiveMapForPlayers(targetMapId);
    if (!session) return;
    const playerTokenIds = Object.values(session.tokens)
      .filter((t) => t.ownerId || t.isPlayerToken)
      .map((t) => t.id);
    if (playerTokenIds.length > 0) {
      handleBatchTransferTokens(playerTokenIds, targetMapId);
    }
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

  const handleDuplicateTokens = (tokensToDup: Token[]) => {
    if (!session || !localPlayer || tokensToDup.length === 0) return;
    const currentMapId = tokensToDup[0].mapId;
    const gridSize = currentMap?.gridSize || 50;

    const duplicatedTokens: Token[] = [];
    const updatedTokens = { ...session.tokens };

    for (let i = 0; i < tokensToDup.length; i++) {
      const tok = tokensToDup[i];
      const pos = findUnoccupiedPosition(currentMapId, tok.x + gridSize, tok.y, gridSize);
      const nameMatch = tok.name.match(/^(.*?)(?:\s+(\d+))?$/);
      const baseName = nameMatch && nameMatch[1] ? nameMatch[1].trim() : tok.name;
      const nextNum = nameMatch && nameMatch[2] ? parseInt(nameMatch[2], 10) + 1 : 2;
      const newName = `${baseName} ${nextNum}`;

      const duplicated: Token = {
        ...tok,
        id: `token-${crypto.randomUUID()}`,
        name: newName,
        x: pos.x,
        y: pos.y,
      };

      updatedTokens[duplicated.id] = duplicated;
      duplicatedTokens.push(duplicated);

      networkRef.current?.send({
        type: 'token-add',
        token: duplicated,
      });
    }

    setSession((prev) => (prev ? { ...prev, tokens: updatedTokens } : prev));
    setSelectedTokens(duplicatedTokens);
    setSelectedToken(duplicatedTokens[0] || null);
    engineRef.current?.selectTokens(duplicatedTokens.map((t) => t.id));
  };

  // Profile Update
  const handleUpdateProfile = (name: string, color: string) => {
    localStorage.setItem('oldbear_player_name', name);
    localStorage.setItem('oldbear_player_color', color);
    if (localPlayer) {
      const updated = { ...localPlayer, name, color };
      setLocalPlayer(updated);
      setSession((prev) => {
        if (!prev || !prev.players[localPlayer.id]) return prev;
        return {
          ...prev,
          players: {
            ...prev.players,
            [localPlayer.id]: {
              ...prev.players[localPlayer.id],
              name,
              color,
            },
          },
        };
      });
      networkRef.current?.send({
        type: 'player-update',
        updates: { name, color },
      });
    }
  };

  const handleSetTokenInitiative = (tok: Token, score: number) => {
    setSession((prev) => {
      if (!prev) return prev;
      const existing = prev.initiative.items.find((it) => it.tokenId === tok.id);
      let items: InitiativeItem[];
      if (existing) {
        items = prev.initiative.items.map((it) =>
          it.tokenId === tok.id ? { ...it, initiative: score } : it
        );
      } else {
        const newItem: InitiativeItem = {
          id: crypto.randomUUID(),
          tokenId: tok.id,
          name: tok.name,
          initiative: score,
          hp: tok.currentHp,
          maxHp: tok.maxHp,
          color: tok.ringColor,
        };
        items = [...prev.initiative.items, newItem];
      }
      items.sort((a, b) => b.initiative - a.initiative);
      const updated = { ...prev.initiative, items };
      networkRef.current?.send({ type: 'initiative-update', initiative: updated });
      return { ...prev, initiative: updated };
    });
  };

  const handleAddMap = (newMap: GameMap) => {
    setSession((prev) => (prev ? { ...prev, maps: [...prev.maps, newMap] } : prev));
    setGmPreviewMapId(newMap.id);
    networkRef.current?.send({ type: 'map-add', map: newMap });
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

  const handleDeleteMap = (id: string) => {
    setSession((prev) => {
      if (!prev) return prev;
      const remaining = prev.maps.filter((m) => m.id !== id);
      const newActive = prev.activeMapId === id ? (remaining[0]?.id || '') : prev.activeMapId;
      return {
        ...prev,
        maps: remaining,
        activeMapId: newActive,
      };
    });
    if (gmPreviewMapId === id) {
      const remaining = session?.maps.filter((m) => m.id !== id);
      if (remaining && remaining.length > 0) {
        setGmPreviewMapId(remaining[0].id);
      }
    }
    networkRef.current?.send({ type: 'map-delete', mapId: id });
    showToast('Map deleted.');
  };

  const currentMap =
    session?.maps.find((m) => m.id === (isGm && gmPreviewMapId ? gmPreviewMapId : session.activeMapId)) ||
    session?.maps[0];

  const handleToggleGrid = () => {
    if (!currentMap) return;
    const newShowGrid = currentMap.showGrid === false ? true : false;
    handleUpdateMap(currentMap.id, { showGrid: newShowGrid });
  };

  const handleCoverAllFog = () => {
    const mapId = isGm && gmPreviewMapId ? gmPreviewMapId : session?.activeMapId;
    if (!mapId) return;
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        fog: {
          ...prev.fog,
          [mapId]: {
            mapId,
            globalCovered: true,
            shapes: [],
          },
        },
      };
    });
    networkRef.current?.send({
      type: 'fog-update',
      mapId,
      globalCovered: true,
      clearShapes: true,
    });
    showToast('Covered entire map with fog');
  };

  const handleClearAllFog = () => {
    const mapId = isGm && gmPreviewMapId ? gmPreviewMapId : session?.activeMapId;
    if (!mapId) return;
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        fog: {
          ...prev.fog,
          [mapId]: {
            mapId,
            globalCovered: false,
            shapes: [],
          },
        },
      };
    });
    networkRef.current?.send({
      type: 'fog-update',
      mapId,
      globalCovered: false,
      clearShapes: true,
    });
    showToast('Cleared all fog from map');
  };

  const assignedToken = localPlayer
    ? Object.values(session?.tokens || {}).find((t) => t.ownerId === localPlayer.id)
    : null;

  // Keyboard shortcuts (Bugs #16, #39, #60, #61, #62):
  // 1-5: Ephemeral highlight tools (laser, arrow, crosshair, circle, rectangle)
  // g: Grab tool (pan viewport)
  // s: Select tool
  // b: Box select tool
  // f: Fog hide (GM only)
  // r: Fog reveal (GM only)
  // d / Ctrl+D / Cmd+D: Duplicate selected token
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }

      // Highlight controls (1-5)
      if (e.key === '1') {
        e.preventDefault();
        setActiveTool('laser');
        return;
      }
      if (e.key === '2') {
        e.preventDefault();
        setActiveTool('arrow');
        return;
      }
      if (e.key === '3') {
        e.preventDefault();
        setActiveTool('crosshair');
        return;
      }
      if (e.key === '4') {
        e.preventDefault();
        setActiveTool('circle');
        return;
      }
      if (e.key === '5') {
        e.preventDefault();
        setActiveTool('rectangle');
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'g') {
        e.preventDefault();
        setActiveTool('pan');
        return;
      }
      if (key === 's') {
        e.preventDefault();
        setActiveTool('select');
        return;
      }
      if (key === 'b') {
        e.preventDefault();
        setActiveTool('box-select');
        return;
      }
      if (key === 'f') {
        if (isGm) {
          e.preventDefault();
          setActiveTool('fog-hide');
        }
        return;
      }
      if (key === 'r') {
        if (isGm) {
          e.preventDefault();
          setActiveTool('fog-reveal');
        }
        return;
      }

      if (key === 'd' || ((e.ctrlKey || e.metaKey) && key === 'd')) {
        if (selectedTokens.length > 1) {
          e.preventDefault();
          handleDuplicateTokens(selectedTokens);
        } else if (selectedToken) {
          e.preventDefault();
          handleDuplicateToken(selectedToken);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedToken, selectedTokens, session, localPlayer, currentMap, isGm]);

  const handleRecordRoll = (roll: DiceRollResult) => {
    setSession((prev) => {
      if (!prev) return prev;
      const history = prev.diceHistory || [];
      if (history.some((r) => r.id === roll.id)) return prev;
      return {
        ...prev,
        diceHistory: [...history, roll],
      };
    });
  };

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
          players={session ? Object.values(session.players).filter((p) => p.connected !== false) : []}
          localPlayer={localPlayer}
          voiceState={voiceState}
          onToggleMute={handleToggleMute}
          onToggleDeafen={handleToggleDeafen}
          onOpenVoiceSettings={() => setShowVoiceSettings(true)}
          onToggleChat={() => {
            setIsChatOpen((v) => {
              if (!v) setUnreadChatCount(0);
              return !v;
            });
          }}
          isChatOpen={isChatOpen}
          unreadChatCount={unreadChatCount}
          onOpenDice={() => setShowDiceRoller((v) => !v)}
          onOpenInitiative={() => setShowInitiative((v) => !v)}
          onOpenCharacter={() => setShowCharacterFlyout((v) => !v)}
          onOpenMaps={() => setShowMapManager(true)}
          onOpenSoundboard={() => setShowSoundboard(true)}
          onOpenBackup={() => setShowBackupModal(true)}
          onAddNewToken={() => setShowTokenPickerModal(true)}
          onToggleMobileDrawer={() => setShowMobileDrawer((v) => !v)}
        />
      )}

      {/* Animated Roll Announcement Banner (Bug #43) */}
      <RollAnnouncementBanner
        roll={activeRollAnnouncement}
        onDismiss={() => setActiveRollAnnouncement(null)}
      />

      {/* Animated Turn Announcement Banner (Bug #67) */}
      <TurnAnnouncementBanner
        announcement={activeTurnAnnouncement}
        onDismiss={() => setActiveTurnAnnouncement(null)}
      />

      {/* Chat & Commands Panel (Bug #45) */}
      {localPlayer && (
        <ChatPanel
          player={localPlayer}
          character={localPlayer.dndBeyondCharacter}
          tokens={
            (() => {
              const owned = Object.values(session?.tokens || {}).filter(
                (t) => t.ownerId === localPlayer.id || localPlayer.assignedTokenIds?.includes(t.id)
              );
              const list = owned.length > 0 ? owned : (isGm ? Object.values(session?.tokens || {}) : []);
              return [...list].sort((a, b) => a.name.localeCompare(b.name));
            })()
          }
          onSyncToken={(tokenId, updates) => {
            handleUpdateToken(tokenId, updates);
          }}
          onUpdatePlayerChar={(dndBeyondCharacter) => {
            setLocalPlayer((p) => (p ? { ...p, dndBeyondCharacter } : p));
            networkRef.current?.send({
              type: 'player-update',
              updates: { dndBeyondCharacter },
            });
            saveCharacterToStorage(dndBeyondCharacter, isGm);
          }}
          messages={chatMessages}
          onSendMessage={(m) => {
            if (m.roll) {
              handleRecordRoll(m.roll);
            }
            if (m.isEphemeral) {
              setChatMessages((prev) => [...prev, m]);
            } else {
              networkRef.current?.send({ type: 'chat-send', message: m });
            }
          }}
          onBroadcastRoll={(r) => {
            handleRecordRoll(r);
            networkRef.current?.send({ type: 'dice-roll', roll: r });
            setActiveRollAnnouncement(r);
          }}
          isOpen={isChatOpen}
          onToggleOpen={() => {
            setIsChatOpen((v) => {
              if (!v) setUnreadChatCount(0);
              return !v;
            });
          }}
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
        onCoverAllFog={handleCoverAllFog}
        onClearAllFog={handleClearAllFog}
        userColor={localPlayer?.color || '#6366f1'}
        onChangeColor={(c) => handleUpdateProfile(localPlayer?.name || 'Player', c)}
      />

      {/* Selected Token Floating Controls */}
      {selectedToken && session && (
        <TokenControls
          token={selectedToken}
          selectedTokens={selectedTokens}
          onUpdateToken={handleUpdateToken}
          onDeleteToken={handleDeleteToken}
          onDuplicateToken={handleDuplicateToken}
          onDuplicateTokens={handleDuplicateTokens}
          onTransferToken={handleTransferToken}
          onSetInitiative={handleSetTokenInitiative}
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
            onRoll={(roll) => {
              handleRecordRoll(roll);
              networkRef.current?.send({ type: 'dice-roll', roll });
              setActiveRollAnnouncement(roll);
            }}
            rollHistory={session.diceHistory || []}
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
            players={session.players}
            isGm={isGm}
            onClose={() => setShowInitiative(false)}
            onSelectToken={(tokenId) => {
              const token = session.tokens[tokenId];
              if (!token) return;
              if (token.mapId && currentMap && token.mapId !== currentMap.id) {
                if (isGm) {
                  setGmPreviewMapId(token.mapId);
                  engineRef.current?.setActiveMap(token.mapId);
                } else {
                  return;
                }
              }
              setSelectedToken(token);
              setSelectedTokens([token]);
              if (engineRef.current) {
                engineRef.current.selectToken(token.id);
                engineRef.current.viewport.centerOn(
                  token.x,
                  token.y,
                  window.innerWidth,
                  window.innerHeight
                );
              }
            }}
          />
        </div>
      )}

      {/* Slide-out Character Sheet Flyout */}
      {showCharacterFlyout && localPlayer && (
        <CharacterFlyout
          player={localPlayer}
          targetToken={selectedToken || assignedToken}
          ownedTokens={Object.values(session?.tokens || {}).filter(
            (t) => t.ownerId === localPlayer.id || localPlayer.assignedTokenIds?.includes(t.id)
          )}
          onSyncToken={(tokenId, updates) => {
            handleUpdateToken(tokenId, updates);
          }}
          onCreateTokenForCharacter={handleCreateTokenForCharacter}
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
          onSetActiveMapForPlayers={handleSetActiveMapForPlayers}
          onSendPlayersWithTokens={handleSendPlayersWithTokens}
          onOpenBatchTokenTransfer={() => setShowBatchTransferModal(true)}
          onAddMap={(newMap) => {
            setSession((prev) => (prev ? { ...prev, maps: [...prev.maps, newMap] } : prev));
            setGmPreviewMapId(newMap.id);
            networkRef.current?.send({ type: 'map-add', map: newMap });
          }}
          onUpdateMap={handleUpdateMap}
          onDeleteMap={handleDeleteMap}
          onClose={() => setShowMapManager(false)}
        />
      )}

      {/* Batch Token Transfer Modal (Bug #40) */}
      {showBatchTransferModal && session && (
        <BatchTokenTransferModal
          tokens={Object.values(session.tokens).filter(
            (t) => t.mapId === (gmPreviewMapId || session.activeMapId)
          )}
          maps={session.maps}
          currentMapId={gmPreviewMapId || session.activeMapId}
          onTransferTokens={handleBatchTransferTokens}
          onClose={() => setShowBatchTransferModal(false)}
        />
      )}

      {/* Token Creation Image Picker Modal (Bug #32) */}
      {showTokenPickerModal && (
        <TokenPickerModal
          onClose={() => setShowTokenPickerModal(false)}
          onCreateToken={handleCreateNewTokenFromPicker}
        />
      )}

      {/* Player Token Claim Picker on Join (Bug #42) */}
      {showPlayerTokenPickerModal && localPlayer && (
        <PlayerTokenPickerModal
          availableTokens={availablePlayerTokens}
          player={localPlayer}
          onClaimToken={handleClaimPlayerToken}
          onClose={() => setShowPlayerTokenPickerModal(false)}
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
          onAddMap={handleAddMap}
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
        onAddMap={handleAddMap}
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
        players={session ? Object.values(session.players).filter((p) => p.connected !== false) : []}
        onUpdatePlayerName={handleUpdateProfile}
        onAddNewToken={() => setShowTokenPickerModal(true)}
        onOpenDice={() => setShowDiceRoller(true)}
        onOpenInitiative={() => setShowInitiative(true)}
        onOpenCharacter={() => setShowCharacterFlyout(true)}
        onOpenMaps={() => setShowMapManager(true)}
        onOpenSoundboard={() => setShowSoundboard(true)}
        onOpenBackup={() => setShowBackupModal(true)}
        onToggleChat={() => {
          setIsChatOpen((v) => {
            if (!v) setUnreadChatCount(0);
            return !v;
          });
        }}
        voiceState={voiceState}
        onToggleMute={handleToggleMute}
        onToggleDeafen={handleToggleDeafen}
        onOpenVoiceSettings={() => setShowVoiceSettings(true)}
        isGm={isGm}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '75px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            color: '#f8fafc',
            border: '1px solid var(--accent-indigo)',
            padding: '0.6rem 1.25rem',
            borderRadius: 'var(--radius-full)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 0 15px rgba(99, 102, 241, 0.3)',
            fontSize: '0.85rem',
            fontWeight: 600,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            pointerEvents: 'none',
            backdropFilter: 'blur(8px)',
          }}
        >
          <Compass size={16} color="var(--accent-emerald)" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Connecting & Error Overlay when Session is Loading */}
      {!session && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(10, 15, 29, 0.96)',
            backdropFilter: 'blur(12px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
        >
          <div
            className="glass-panel-elevated animate-fade-in"
            style={{
              maxWidth: '480px',
              width: '100%',
              padding: '2rem',
              textAlign: 'center',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-strong)',
            }}
          >
            {connectionStatus === 'error' ? (
              <div>
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(244, 63, 94, 0.15)',
                    color: 'var(--accent-rose)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.25rem',
                  }}
                >
                  <AlertTriangle size={28} />
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.75rem', color: '#fff' }}>
                  Unable to Connect to Server
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                  {connectionError || 'Failed to establish WebSocket connection with the game server.'}
                </p>

                <div
                  style={{
                    padding: '0.85rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    color: '#fbbf24',
                    fontSize: '0.8rem',
                    textAlign: 'left',
                    marginBottom: '1.5rem',
                  }}
                >
                  <strong>Nginx Proxy Manager Configuration Required:</strong>
                  <br />
                  If you are using Nginx Proxy Manager (NPM), open your NPM admin panel, edit the Proxy Host for <code>ttrpgwith.me</code>, and toggle <strong>Websockets Support</strong> to <strong>ON</strong>.
                </div>

                <button
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => {
                    setConnectionStatus('connecting');
                    setConnectionError(null);
                    const net = networkRef.current;
                    if (net) {
                      const params = new URLSearchParams(window.location.search);
                      const roomId = params.get('room') || 'default-room';
                      const savedName = localStorage.getItem('oldbear_player_name') || generateRandomName();
                      const savedColor = localStorage.getItem('oldbear_player_color') || '#6366f1';
                      const savedGmKey = localStorage.getItem(`oldbear_gmkey_${roomId}`) || undefined;
                      net.connect(roomId, savedName, savedColor, savedGmKey);
                    } else {
                      window.location.reload();
                    }
                  }}
                >
                  <RefreshCw size={16} /> Retry Connection
                </button>
              </div>
            ) : (
              <div>
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    color: 'var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.25rem',
                    animation: 'pulse 2s infinite',
                  }}
                >
                  <Compass size={32} />
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem', color: '#fff' }}>
                  Joining Virtual Tabletop...
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Connecting to real-time session signaling server
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
