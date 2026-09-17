import crypto from 'node:crypto';
import { GameSession, GameMap, Token, FogState } from '@oldbear/shared';

// In-memory store for sessions (fallback/dev mode)
const sessions = new Map<string, { session: GameSession; gmKey: string }>();

// Simple readable room slug generator (e.g., owl-bear-42)
const ADJECTIVES = ['daring', 'brave', 'mystic', 'ancient', 'wild', 'shadow', 'golden', 'frost', 'ember', 'arcane'];
const NOUNS = ['owlbear', 'dragon', 'beholder', 'griffin', 'goblin', 'ranger', 'wizard', 'dungeon', 'cavern', 'tavern'];

export function generateRoomId(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 90 + 10);
  return `${adj}-${noun}-${num}`;
}

export function createDefaultMap(mapId = 'map-default'): GameMap {
  return {
    id: mapId,
    name: 'Ancient Stone Ruins',
    imageUrl: '', // Blank or SVG background
    gridSize: 50,
    gridType: 'square',
    gridColor: 'rgba(255, 255, 255, 0.25)',
    gridOpacity: 0.25,
    width: 2000,
    height: 1500,
    scaleFtPerCell: 5,
  };
}

export function createDefaultTokens(mapId: string): Record<string, Token> {
  const t1Id = 'token-fighter';
  const t2Id = 'token-goblin';

  return {
    [t1Id]: {
      id: t1Id,
      mapId,
      name: 'Valeros the Fighter',
      imageUrl: '',
      x: 350,
      y: 350,
      size: 1,
      rotation: 0,
      ringColor: '#3b82f6', // blue ring
      fillColor: '#1e3a8a',
      clipCircle: true,
      currentHp: 28,
      maxHp: 28,
      tempHp: 0,
      speed: 30,
      conditions: [],
      isProp: false,
      layer: 'token',
    },
    [t2Id]: {
      id: t2Id,
      mapId,
      name: 'Goblin Scout',
      imageUrl: '',
      x: 650,
      y: 450,
      size: 1,
      rotation: 0,
      ringColor: '#ef4444', // red ring
      fillColor: '#7f1d1d',
      clipCircle: true,
      currentHp: 7,
      maxHp: 7,
      tempHp: 0,
      speed: 30,
      conditions: [],
      isProp: false,
      layer: 'token',
    },
  };
}

export function createSession(name?: string): { session: GameSession; gmKey: string } {
  const id = generateRoomId();
  const gmKey = crypto.randomUUID();
  const defaultMap = createDefaultMap();

  const initialFog: FogState = {
    mapId: defaultMap.id,
    globalCovered: false,
    shapes: [],
  };

  const session: GameSession = {
    id,
    name: name || `Session ${id}`,
    createdAt: Date.now(),
    gmId: '',
    activeMapId: defaultMap.id,
    maps: [defaultMap],
    tokens: createDefaultTokens(defaultMap.id),
    fog: { [defaultMap.id]: initialFog },
    players: {},
    initiative: {
      round: 1,
      currentTurnIndex: 0,
      items: [
        { id: 'init-1', tokenId: 'token-fighter', name: 'Valeros the Fighter', initiative: 16, hp: 28, maxHp: 28, color: '#3b82f6' },
        { id: 'init-2', tokenId: 'token-goblin', name: 'Goblin Scout', initiative: 12, hp: 7, maxHp: 7, color: '#ef4444' },
      ],
    },
    markers: [],
    diceHistory: [],
    soundtracks: [],
  };

  sessions.set(id, { session, gmKey });
  return { session, gmKey };
}

export function getSession(id: string): GameSession | null {
  const entry = sessions.get(id);
  return entry ? entry.session : null;
}

export function getSessionGmKey(id: string): string | null {
  const entry = sessions.get(id);
  return entry ? entry.gmKey : null;
}

export function updateSession(id: string, updates: Partial<GameSession>): GameSession | null {
  const entry = sessions.get(id);
  if (!entry) return null;

  Object.assign(entry.session, updates);
  return entry.session;
}

export function removeSession(id: string): boolean {
  return sessions.delete(id);
}
