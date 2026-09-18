import { DnDCharacter, DnDAction, Token } from '@oldbear/shared';
import { StoredAsset } from '../storage/db.js';

export interface ParsedMonsterResult {
  asset: StoredAsset;
  character: DnDCharacter;
  defaultSize: number;
  speed: number;
  hp: number;
  ac: number;
}

/**
 * Checks if a given text or JSON payload is a TetraCube monster export.
 */
export function isTetraCubeMonsterFile(content: string, filename?: string): boolean {
  if (filename && filename.toLowerCase().endsWith('.monster')) return true;
  try {
    const data = typeof content === 'string' ? JSON.parse(content) : content;
    return !!(
      data &&
      (data.name || data.monsterName) &&
      (data.hpText ||
        data.hitDice !== undefined ||
        data.strPoints !== undefined ||
        data.actions ||
        data.armorClass !== undefined ||
        data.abilities ||
        data.challenge !== undefined)
    );
  } catch {
    return false;
  }
}

/**
 * Generates an SVG data URL token medallion for monsters lacking custom artwork.
 */
export function generateMonsterSvgAvatar(name: string, type: string): string {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || 'M';
  const cleanType = (type || 'Monstrosity').slice(0, 14).toUpperCase();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <defs>
      <radialGradient id="bg" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#4c0519" />
        <stop offset="65%" stop-color="#1e1b4b" />
        <stop offset="100%" stop-color="#020617" />
      </radialGradient>
      <linearGradient id="ring" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f43f5e" />
        <stop offset="100%" stop-color="#991b1b" />
      </linearGradient>
    </defs>
    <circle cx="100" cy="100" r="94" fill="url(#bg)" stroke="url(#ring)" stroke-width="8" />
    <path d="M70 65 Q100 45 130 65 Q115 100 100 115 Q85 100 70 65 Z" fill="#f43f5e" opacity="0.35" />
    <text x="100" y="112" font-family="system-ui, sans-serif" font-weight="900" font-size="52" fill="#ffffff" text-anchor="middle" letter-spacing="2">${initials}</text>
    <text x="100" y="148" font-family="system-ui, sans-serif" font-weight="700" font-size="13" fill="#fca5a5" text-anchor="middle" letter-spacing="1">${cleanType}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Parses a TetraCube .monster file JSON into an asset and attached DnDCharacter.
 */
export function parseTetraCubeMonster(jsonString: string): ParsedMonsterResult {
  const data = JSON.parse(jsonString);
  const name = (data.name || data.monsterName || 'Monster').trim();

  // Size mapping
  const sizeRaw = (data.size || 'Medium').toLowerCase();
  let size = 1;
  if (sizeRaw.includes('tiny')) size = 1;
  else if (sizeRaw.includes('small')) size = 1;
  else if (sizeRaw.includes('medium')) size = 1;
  else if (sizeRaw.includes('large')) size = 2;
  else if (sizeRaw.includes('huge')) size = 3;
  else if (sizeRaw.includes('gargantuan')) size = 4;

  // HP parsing
  let hp = 20;
  if (typeof data.hp === 'number') {
    hp = data.hp;
  } else if (typeof data.hitPoints === 'number') {
    hp = data.hitPoints;
  } else if (typeof data.hpText === 'string') {
    const m = data.hpText.match(/^(\d+)/);
    if (m) hp = parseInt(m[1], 10);
  }

  // AC parsing
  let ac = 12;
  if (typeof data.armorClass === 'number') {
    ac = data.armorClass;
  } else if (typeof data.armorClass === 'string') {
    const m = data.armorClass.match(/^(\d+)/);
    if (m) ac = parseInt(m[1], 10);
  } else if (typeof data.ac === 'number') {
    ac = data.ac;
  }

  // Speed parsing
  let speed = 30;
  if (typeof data.speed === 'number') {
    speed = data.speed;
  } else if (typeof data.speed === 'string') {
    const m = data.speed.match(/(\d+)\s*ft/i) || data.speed.match(/^(\d+)/);
    if (m) speed = parseInt(m[1], 10);
  }

  // Abilities / Stats
  const str = Number(data.strPoints ?? data.str ?? 10);
  const dex = Number(data.dexPoints ?? data.dex ?? 10);
  const con = Number(data.conPoints ?? data.con ?? 10);
  const int = Number(data.intPoints ?? data.int ?? 10);
  const wis = Number(data.wisPoints ?? data.wis ?? 10);
  const cha = Number(data.chaPoints ?? data.cha ?? 10);

  const initBonus = Math.floor((dex - 10) / 2);

  // Actions parsing
  const actions: DnDAction[] = [];
  const rawActions = Array.isArray(data.actions) ? data.actions : [];
  for (const act of rawActions) {
    if (!act || !act.name) continue;
    const desc = (act.desc || act.description || '').trim();

    // To hit: e.g. "+5 to hit" or "+11 to hit"
    const toHitMatch = desc.match(/([+-]\d+)\s+to hit/i);
    const toHitModifier = toHitMatch ? parseInt(toHitMatch[1], 10) : undefined;

    // Reach / Range
    const reachMatch = desc.match(/reach\s+(\d+\s*ft\.)/i);
    const rangeMatch = desc.match(/range\s+([0-9/]+\s*ft\.)/i);

    // Damage: e.g. "Hit: 10 (2d6 + 3) slashing damage"
    const dmgMatch = desc.match(/Hit:\s*(?:\d+\s*\(([^)]+)\)|\d+)\s*([a-zA-Z]+)?\s*damage/i);
    let damageExpr: string | undefined;
    let damageDice: string | undefined;
    if (dmgMatch) {
      if (dmgMatch[1]) {
        damageDice = dmgMatch[1].replace(/\s+/g, '');
        damageExpr = `${damageDice}${dmgMatch[2] ? ` ${dmgMatch[2]}` : ''} damage`;
      } else {
        const flatMatch = desc.match(/Hit:\s*(\d+)\s*([a-zA-Z]+)?\s*damage/i);
        if (flatMatch) {
          damageDice = flatMatch[1];
          damageExpr = `${flatMatch[1]}${flatMatch[2] ? ` ${flatMatch[2]}` : ''} damage`;
        }
      }
    }

    const isBonus = /\bbonus action\b/i.test(desc) || /\bbonus action\b/i.test(act.name);
    const isReact = /\breaction\b/i.test(desc) || /\breaction\b/i.test(act.name);

    actions.push({
      name: act.name,
      type: isBonus ? 'bonus' : isReact ? 'reaction' : 'action',
      activationType: isBonus ? 'bonus' : isReact ? 'reaction' : 'action',
      toHitModifier,
      reach: reachMatch ? reachMatch[1] : undefined,
      range: rangeMatch ? rangeMatch[1] : undefined,
      damage: damageExpr,
      damageDice,
      description: desc,
    });
  }

  // Reactions
  const rawReactions = Array.isArray(data.reactions) ? data.reactions : [];
  for (const r of rawReactions) {
    if (!r || !r.name) continue;
    actions.push({
      name: r.name,
      type: 'reaction',
      activationType: 'reaction',
      description: (r.desc || r.description || '').trim(),
    });
  }

  // Traits / Special Abilities
  const rawAbilities = Array.isArray(data.abilities) ? data.abilities : [];
  for (const ab of rawAbilities) {
    if (!ab || !ab.name) continue;
    actions.push({
      name: ab.name,
      type: 'action',
      activationType: 'action',
      description: (ab.desc || ab.description || '').trim(),
    });
  }

  // Legendary actions
  const rawLegendary = Array.isArray(data.legendaryActions) ? data.legendaryActions : [];
  for (const leg of rawLegendary) {
    if (!leg || !leg.name) continue;
    actions.push({
      name: `Legendary: ${leg.name}`,
      type: 'action',
      activationType: 'action',
      description: (leg.desc || leg.description || '').trim(),
    });
  }

  const imageUrl =
    data.imageUrl ||
    data.tokenUrl ||
    data.artUrl ||
    data.dataUrl ||
    generateMonsterSvgAvatar(name, data.type || 'Monstrosity');

  const characterId = `char-${crypto.randomUUID()}`;
  const character: DnDCharacter = {
    id: characterId,
    name,
    avatarUrl: imageUrl,
    level: parseInt(data.challenge || '1', 10) || 1,
    classes: `CR ${data.challenge || '1'} ${data.type || 'Monstrosity'}`,
    race: data.type || 'Monstrosity',
    currentHp: hp,
    maxHp: hp,
    tempHp: 0,
    speed,
    armorClass: ac,
    passivePerception: 10 + Math.floor((wis - 10) / 2),
    initiativeBonus: initBonus,
    stats: { str, dex, con, int, wis, cha },
    spells: [],
    actions,
  };

  const assetId = `monster-${crypto.randomUUID()}`;
  const asset: StoredAsset = {
    id: assetId,
    name,
    type: 'token',
    dataUrl: imageUrl,
    speed,
    maxHp: hp,
    armorClass: ac,
    size,
    ringColor: '#ef4444',
    fillColor: '#1e1b4b',
    monsterData: data,
    character,
    createdAt: Date.now(),
  };

  return { asset, character, defaultSize: size, speed, hp, ac };
}

/**
 * Generates an auto-incrementing numbered token name e.g. "Ankheg 1", "Ankheg 2".
 */
export function getNextNumberedTokenName(baseName: string, existingTokens: Token[]): string {
  const cleanBase = baseName.replace(/\s+\d+$/, '').trim();
  const pattern = new RegExp(`^${cleanBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s+(\\d+))?$`, 'i');

  let maxNum = 0;
  let hasMatch = false;

  for (const token of existingTokens) {
    const match = token.name.match(pattern);
    if (match) {
      hasMatch = true;
      if (match[1]) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
  }

  const nextNum = maxNum > 0 ? maxNum + 1 : (hasMatch ? 2 : 1);
  return `${cleanBase} ${nextNum}`;
}

/**
 * Creates a ready-to-fight Token from a monster asset.
 */
export function createMonsterToken(
  asset: StoredAsset,
  mapId: string,
  x: number,
  y: number,
  existingTokens: Token[]
): Token {
  const tokenName = getNextNumberedTokenName(asset.name, existingTokens);
  const charCopy: DnDCharacter | undefined = asset.character
    ? {
        ...asset.character,
        id: `monster-char-${crypto.randomUUID()}`,
        name: tokenName,
      }
    : undefined;

  return {
    id: `token-${crypto.randomUUID()}`,
    mapId,
    name: tokenName,
    imageUrl: asset.dataUrl,
    x: Math.round(x),
    y: Math.round(y),
    size: asset.size || 1,
    rotation: 0,
    ringColor: asset.ringColor || '#ef4444',
    fillColor: asset.fillColor || '#1e1b4b',
    clipCircle: true,
    clipShape: 'circle',
    currentHp: asset.maxHp || 20,
    maxHp: asset.maxHp || 20,
    tempHp: 0,
    speed: asset.speed || 30,
    conditions: [],
    isProp: false,
    layer: 'token',
    initiativeBonus: charCopy?.initiativeBonus ?? 0,
    character: charCopy,
  };
}
