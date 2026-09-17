import {
  GameMap,
  GameSession,
  InitiativeState,
  Player,
  ScreenMarker,
  Token,
  FogShape,
  DiceRollResult,
  SoundTrack,
} from './types.js';

export type ClientToServerMessage =
  | { type: 'join'; roomId: string; playerName: string; playerColor: string; gmKey?: string }
  | { type: 'rtc-offer'; toPeerId: string; sdp: RTCSessionDescriptionInit }
  | { type: 'rtc-answer'; toPeerId: string; sdp: RTCSessionDescriptionInit }
  | { type: 'rtc-ice'; toPeerId: string; candidate: RTCIceCandidateInit }
  | { type: 'token-move'; id: string; x: number; y: number; mapId?: string }
  | { type: 'token-update'; id: string; updates: Partial<Token> }
  | { type: 'token-add'; token: Token }
  | { type: 'token-delete'; id: string }
  | { type: 'token-transfer'; id: string; toMapId: string; x: number; y: number }
  | { type: 'map-add'; map: GameMap }
  | { type: 'map-update'; id: string; updates: Partial<GameMap> }
  | { type: 'map-delete'; mapId: string }
  | { type: 'map-switch'; mapId: string }
  | { type: 'fog-update'; mapId: string; globalCovered?: boolean; newShape?: FogShape; clearShapes?: boolean }
  | { type: 'marker-add'; marker: ScreenMarker }
  | { type: 'dice-roll'; roll: DiceRollResult }
  | { type: 'initiative-update'; initiative: InitiativeState }
  | { type: 'player-update'; updates: Partial<Player> }
  | { type: 'voice-force-mute'; targetPlayerId: string }
  | { type: 'audio-action'; trackId: string; action: 'play' | 'pause' | 'stop' | 'volume'; volume?: number; isLooping?: boolean };

export type ServerToClientMessage =
  | { type: 'join-ack'; player: Player; session: GameSession; isGm: boolean; gmKey?: string }
  | { type: 'error'; message: string }
  | { type: 'peer-joined'; peerId: string; player: Player }
  | { type: 'peer-left'; peerId: string }
  | { type: 'rtc-offer'; fromPeerId: string; sdp: RTCSessionDescriptionInit }
  | { type: 'rtc-answer'; fromPeerId: string; sdp: RTCSessionDescriptionInit }
  | { type: 'rtc-ice'; fromPeerId: string; candidate: RTCIceCandidateInit }
  | { type: 'sync-session'; session: GameSession }
  | { type: 'token-moved'; id: string; x: number; y: number; mapId?: string }
  | { type: 'token-updated'; id: string; updates: Partial<Token> }
  | { type: 'token-added'; token: Token }
  | { type: 'token-deleted'; id: string }
  | { type: 'token-transferred'; id: string; toMapId: string; x: number; y: number }
  | { type: 'map-added'; map: GameMap }
  | { type: 'map-updated'; id: string; updates: Partial<GameMap> }
  | { type: 'map-deleted'; mapId: string; activeMapId?: string }
  | { type: 'map-switched'; mapId: string }
  | { type: 'fog-updated'; mapId: string; globalCovered?: boolean; newShape?: FogShape; clearShapes?: boolean }
  | { type: 'marker-added'; marker: ScreenMarker }
  | { type: 'dice-rolled'; roll: DiceRollResult }
  | { type: 'initiative-updated'; initiative: InitiativeState }
  | { type: 'player-updated'; playerId: string; updates: Partial<Player> }
  | { type: 'voice-force-mute'; targetPlayerId: string }
  | { type: 'audio-action'; trackId: string; action: 'play' | 'pause' | 'stop' | 'volume'; volume?: number; isLooping?: boolean };
