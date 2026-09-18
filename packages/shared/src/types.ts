export type Role = 'gm' | 'player';

export interface Player {
  id: string;
  name: string;
  role: Role;
  color: string;
  connected: boolean;
  assignedTokenIds: string[];
  dndBeyondCharacterId?: string;
  dndBeyondCharacter?: DnDCharacter;
  isMuted?: boolean;
  isSpeaking?: boolean;
  isDeafened?: boolean;
  isForceMuted?: boolean;
  isAudioStreaming?: boolean;
}

export type GridType = 'square' | 'hex' | 'none';

export interface GameMap {
  id: string;
  name: string;
  imageUrl: string; // URL, data URL, or IndexedDB asset ID
  gridSize: number; // pixels per grid cell (default e.g. 50)
  gridType: GridType;
  gridColor: string;
  gridOpacity: number;
  width: number;
  height: number;
  scaleFtPerCell: number; // default 5 (5ft per cell)
  showGrid?: boolean;
  gridOffsetX?: number;
  gridOffsetY?: number;
  tilesX?: number;
  tilesY?: number;
  backgroundColor?: string;
  baseMapId?: string; // ID of the underlying map asset/image when used across multiple scenes
  baseMapName?: string; // Display name of base map asset
}

export interface Scene extends GameMap {
  baseMapId?: string;
  baseMapName?: string;
}

export interface MapAsset {
  id: string;
  name: string;
  imageUrl: string;
  width: number;
  height: number;
  gridSize: number;
  gridType: GridType;
  gridColor: string;
  gridOpacity: number;
  scaleFtPerCell: number;
  backgroundColor?: string;
  tilesX?: number;
  tilesY?: number;
}

export interface Token {
  id: string;
  mapId: string;
  name: string;
  imageUrl?: string;
  x: number;
  y: number;
  size: number; // grid units, 1 = medium (1x1), 2 = large (2x2), etc.
  rotation: number; // degrees
  ringColor: string; // border ring color
  fillColor: string; // background color for clipped token
  clipCircle: boolean;
  clipShape?: 'circle' | 'square' | 'rounded' | 'hexagon' | 'octagon';
  clipZoom?: number; // 0.5 to 3.0 (default 1.0)
  clipPanX?: number; // -100 to 100 percentage offset
  clipPanY?: number; // -100 to 100 percentage offset
  borderWidth?: number; // pixel width
  isPlayerToken?: boolean; // marks token as an assignable/claimable player token
  currentHp: number;
  maxHp: number;
  tempHp: number;
  speed: number; // speed in feet, e.g. 30
  ownerId?: string; // Player ID who has control, or undefined for GM-only
  conditions: string[]; // e.g. 'Blinded', 'Charmed', 'Poisoned', 'Stunned', etc.
  isProp: boolean; // props are decorative items on map
  layer: 'map' | 'token' | 'prop';
  elevation?: number; // e.g. flying +10ft
  initiativeBonus?: number;
  character?: DnDCharacter;
}

export interface FogPoint {
  x: number;
  y: number;
}

export interface FogShape {
  id: string;
  mode: 'reveal' | 'hide';
  type: 'brush' | 'polygon' | 'rect';
  points: FogPoint[];
  radius?: number; // for brush strokes
}

export interface FogState {
  mapId: string;
  globalCovered: boolean; // default true for unexplored
  shapes: FogShape[];
}

export type MarkerType = 'laser' | 'arrow' | 'crosshair' | 'circle' | 'rectangle';

export interface ScreenMarker {
  id: string;
  type: MarkerType;
  userId: string;
  userName: string;
  color: string;
  x: number;
  y: number;
  // Dynamic parameters depending on type
  points?: FogPoint[]; // for laser trails
  targetX?: number; // for arrow
  targetY?: number;
  radius?: number; // for circle
  width?: number; // for rectangle
  height?: number;
  durationMs: number; // how long it stays on screen
  createdAt: number; // epoch ms
}

export type DieType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';

export interface DiceRollResult {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  diceType: DieType;
  count: number;
  modifier: number;
  rolls: number[];
  total: number;
  advantageMode?: 'normal' | 'advantage' | 'disadvantage';
  keptRoll?: number;
  timestamp: number;
}

export interface InitiativeItem {
  id: string;
  tokenId?: string;
  name: string;
  initiative: number;
  hp?: number;
  maxHp?: number;
  color?: string;
  isCurrentTurn?: boolean;
}

export interface InitiativeState {
  round: number;
  currentTurnIndex: number;
  items: InitiativeItem[];
}

export interface DnDSpell {
  id: string;
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  duration: string;
  description: string;
  dndBeyondUrl: string;
}

export interface CharacterSkill {
  name: string;
  stat: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
  modifier: number;
  proficiency: 'none' | 'proficient' | 'expertise';
}

export interface DnDAction {
  name: string;
  type?: string;
  activationType?: 'action' | 'bonus' | 'reaction' | string;
  toHitModifier?: number;
  damageDice?: string;
  reach?: string;
  range?: string;
  damage?: string;
  description?: string;
}

export function getActivationCategory(item?: {
  activationType?: string;
  type?: string;
  castingTime?: string;
  description?: string;
  name?: string;
}): 'action' | 'bonus' | 'reaction' | 'other' {
  if (!item) return 'other';
  const act = (item.activationType || '').toLowerCase();
  const t = (item.type || '').toLowerCase();
  const cast = (item.castingTime || '').toLowerCase();
  const desc = (item.description || '').toLowerCase();

  if (act === 'bonus' || act.includes('bonus') || t.includes('bonus') || /\bbonus\b/i.test(cast) || /\bbonus action\b/i.test(desc)) {
    return 'bonus';
  }
  if (act === 'reaction' || act.includes('reaction') || t.includes('reaction') || /\breaction\b/i.test(cast) || /\breaction\b/i.test(desc)) {
    return 'reaction';
  }
  if (act === 'action' || t === 'action' || /\b1 action\b/i.test(cast)) {
    return 'action';
  }
  return 'other';
}

export interface DnDItem {
  id?: string;
  name: string;
  description?: string;
  quantity?: number;
  dndBeyondUrl?: string;
}

export interface DnDCharacter {
  id: string;
  name: string;
  avatarUrl?: string;
  level: number;
  classes: string;
  race: string;
  currentHp: number;
  maxHp: number;
  tempHp: number;
  speed: number;
  armorClass: number;
  passivePerception: number;
  initiativeBonus?: number;
  savingThrows?: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
    proficiencies?: string[];
  };
  passives?: {
    perception: number;
    investigation: number;
    insight: number;
  };
  currencies?: {
    cp: number;
    sp: number;
    ep: number;
    gp: number;
    pp: number;
  };
  proficiencyBonus?: number;
  stats: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  skills?: CharacterSkill[];
  spells: DnDSpell[];
  actions?: DnDAction[];
  items?: DnDItem[];
}

export interface SoundTrack {
  id: string;
  name: string;
  url: string; // or local asset id
  volume: number; // 0 to 1
  isLooping: boolean;
  isPlaying: boolean;
  isBroadcast: boolean; // play for players as well or GM-only
  category: 'music' | 'ambience' | 'sfx';
}

export interface GameSession {
  id: string;
  name: string;
  createdAt: number;
  gmId: string;
  activeMapId: string; // The map players currently see
  maps: GameMap[];
  tokens: Record<string, Token>; // key is token ID
  fog: Record<string, FogState>; // key is map ID
  players: Record<string, Player>;
  initiative: InitiativeState;
  markers: ScreenMarker[];
  diceHistory: DiceRollResult[];
  soundtracks: SoundTrack[];
}
