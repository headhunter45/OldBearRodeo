import { DnDCharacter, DnDSpell } from '@oldbear/shared';

export async function fetchDnDCharacter(characterIdOrUrl: string): Promise<DnDCharacter | null> {
  // Extract ID if a full URL was provided
  const idMatch = characterIdOrUrl.match(/characters\/(\d+)/) || characterIdOrUrl.match(/^(\d+)$/);
  const characterId = idMatch ? idMatch[1] : characterIdOrUrl.trim();

  if (!characterId) {
    throw new Error('Invalid D&D Beyond character ID');
  }

  // Demo character support for testing
  if (characterId === 'demo' || characterId === '000000') {
    return getDemoCharacter();
  }

  const endpoint = `https://character-service.dndbeyond.com/character/v2/character/${characterId}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
        Accept: 'application/json',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      if (res.status === 403 || res.status === 404) {
        throw new Error('Character not found or privacy is set to Private on D&D Beyond');
      }
      throw new Error(`D&D Beyond returned status: ${res.status}`);
    }

    const json = (await res.json()) as any;
    const data = json.data;
    if (!data) {
      throw new Error('Unexpected response format from D&D Beyond');
    }

    return parseDnDData(characterId, data);
  } catch (err: any) {
    console.error(`[DnDBeyond] Failed to fetch character ${characterId}:`, err.message);
    // If external fetch fails (e.g. offline, firewalled, or D&D Beyond private character),
    // throw descriptive error
    throw err;
  }
}

function parseDnDData(characterId: string, data: any): DnDCharacter {
  // 1. Calculate HP
  const baseHp = Number(data.baseHitPoints || 10);
  const removedHp = Number(data.removedHitPoints || 0);
  const tempHp = Number(data.temporaryHitPoints || 0);
  const bonusHp = Number(data.bonusHitPoints || 0);
  
  // Calculate CON modifier bonus across levels
  const conStat = (data.stats || []).find((s: any) => s.id === 3)?.value || 10;
  const conMod = Math.floor((conStat - 10) / 2);
  const level = (data.classes || []).reduce((sum: number, c: any) => sum + (c.level || 0), 0) || 1;
  
  const totalMaxHp = Math.max(1, baseHp + bonusHp + conMod * level);
  const currentHp = Math.max(0, totalMaxHp - removedHp);

  // 2. Classes & Race
  const classNames = (data.classes || [])
    .map((c: any) => `${c.definition?.name || 'Adventurer'} ${c.level || 1}`)
    .join(' / ') || 'Hero';
  const race = data.race?.fullName || 'Unknown';

  // 3. Stats (1: STR, 2: DEX, 3: CON, 4: INT, 5: WIS, 6: CHA)
  const getStat = (id: number) => {
    const raw = (data.stats || []).find((s: any) => s.id === id)?.value || 10;
    const bonus = (data.bonusStats || []).find((s: any) => s.id === id)?.value || 0;
    const override = (data.overrideStats || []).find((s: any) => s.id === id)?.value;
    return override ?? (raw + bonus);
  };

  const stats = {
    str: getStat(1),
    dex: getStat(2),
    con: getStat(3),
    int: getStat(4),
    wis: getStat(5),
    cha: getStat(6),
  };

  // 4. Speed
  // In D&D Beyond, speed is in data.weightSpeeds.normal.walk or data.race.weightSpeeds or custom
  let speed = 30;
  if (data.weightSpeeds?.normal?.walk) {
    speed = data.weightSpeeds.normal.walk;
  } else if (data.customSpeeds) {
    const walkCustom = data.customSpeeds.find((s: any) => s.movementId === 1);
    if (walkCustom) speed = walkCustom.distance;
  }

  // 5. Spells
  const rawSpells = [
    ...(data.spells?.class || []),
    ...(data.spells?.race || []),
    ...(data.spells?.feat || []),
    ...(data.spells?.item || []),
  ];

  const spells: DnDSpell[] = [];
  const seenSpellNames = new Set<string>();

  for (const s of rawSpells) {
    const def = s.definition;
    if (!def || seenSpellNames.has(def.name)) continue;
    seenSpellNames.add(def.name);

    spells.push({
      id: String(def.id || def.name),
      name: def.name,
      level: def.level ?? 0,
      school: def.school || 'Evocation',
      castingTime: def.activation?.activationTime
        ? `${def.activation.activationTime} ${def.activation.activationType === 1 ? 'Action' : def.activation.activationType === 3 ? 'Bonus Action' : 'Reaction'}`
        : '1 Action',
      range: def.range?.rangeValue ? `${def.range.rangeValue} ft` : (def.range?.origin || 'Self'),
      duration: def.duration?.durationInterval ? `${def.duration.durationInterval} ${def.duration.durationUnit || 'minutes'}` : 'Instantaneous',
      description: (def.snippet || def.description || '').replace(/<[^>]*>/g, '').slice(0, 300) + '...',
      dndBeyondUrl: `https://www.dndbeyond.com/spells/${encodeURIComponent(def.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}`,
    });
  }

  return {
    id: characterId,
    name: data.name || 'Hero',
    avatarUrl: data.avatarUrl || data.decorations?.avatarUrl || undefined,
    level,
    classes: classNames,
    race,
    currentHp,
    maxHp: totalMaxHp,
    tempHp,
    speed,
    armorClass: 15,
    passivePerception: 10 + Math.floor((stats.wis - 10) / 2),
    stats,
    spells,
  };
}

export function getDemoCharacter(): DnDCharacter {
  return {
    id: 'demo',
    name: 'Valeros the Valiant',
    avatarUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=150&auto=format&fit=crop&q=80',
    level: 5,
    classes: 'Fighter (Champion) 5',
    race: 'Human',
    currentHp: 44,
    maxHp: 48,
    tempHp: 5,
    speed: 30,
    armorClass: 18,
    passivePerception: 13,
    stats: {
      str: 18,
      dex: 14,
      con: 16,
      int: 10,
      wis: 12,
      cha: 10,
    },
    spells: [
      {
        id: 'action-surge',
        name: 'Action Surge',
        level: 0,
        school: 'Special',
        castingTime: 'Free',
        range: 'Self',
        duration: 'Instantaneous',
        description: 'Take one additional action on your turn. Once used, you must finish a short or long rest before you can use it again.',
        dndBeyondUrl: 'https://www.dndbeyond.com/classes/fighter#ActionSurge',
      },
      {
        id: 'second-wind',
        name: 'Second Wind',
        level: 0,
        school: 'Special',
        castingTime: '1 Bonus Action',
        range: 'Self',
        duration: 'Instantaneous',
        description: 'You have a limited well of stamina that you can draw on to protect yourself from harm. On your turn, you can use a bonus action to regain hit points equal to 1d10 + your fighter level.',
        dndBeyondUrl: 'https://www.dndbeyond.com/classes/fighter#SecondWind',
      }
    ],
  };
}
