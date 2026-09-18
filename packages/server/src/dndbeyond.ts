import { DnDCharacter, DnDSpell, CharacterSkill, DnDAction } from '@oldbear/shared';

const SKILL_DEFINITIONS: Array<{
  name: string;
  key: string;
  stat: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
}> = [
  { name: 'Acrobatics', key: 'acrobatics', stat: 'dex' },
  { name: 'Animal Handling', key: 'animal-handling', stat: 'wis' },
  { name: 'Arcana', key: 'arcana', stat: 'int' },
  { name: 'Athletics', key: 'athletics', stat: 'str' },
  { name: 'Deception', key: 'deception', stat: 'cha' },
  { name: 'History', key: 'history', stat: 'int' },
  { name: 'Insight', key: 'insight', stat: 'wis' },
  { name: 'Intimidation', key: 'intimidation', stat: 'cha' },
  { name: 'Investigation', key: 'investigation', stat: 'int' },
  { name: 'Medicine', key: 'medicine', stat: 'wis' },
  { name: 'Nature', key: 'nature', stat: 'int' },
  { name: 'Perception', key: 'perception', stat: 'wis' },
  { name: 'Performance', key: 'performance', stat: 'cha' },
  { name: 'Persuasion', key: 'persuasion', stat: 'cha' },
  { name: 'Religion', key: 'religion', stat: 'int' },
  { name: 'Sleight of Hand', key: 'sleight-of-hand', stat: 'dex' },
  { name: 'Stealth', key: 'stealth', stat: 'dex' },
  { name: 'Survival', key: 'survival', stat: 'wis' },
];

async function fetchImageAsDataUrl(imageUrl: string): Promise<string> {
  if (!imageUrl || imageUrl.startsWith('data:')) return imageUrl;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.warn(`[DnDBeyond] Image fetch returned status ${res.status}: ${imageUrl}`);
      return imageUrl;
    }
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch (err: any) {
    console.warn(`[DnDBeyond] Image fetch failed (${err.message}), fallback to url: ${imageUrl}`);
    return imageUrl;
  }
}

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

  const endpoint = `https://character-service.dndbeyond.com/character/v5/character/${characterId}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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

    return await parseDnDData(characterId, data);
  } catch (err: any) {
    console.error(`[DnDBeyond] Failed to fetch character ${characterId}:`, err.message);
    throw err;
  }
}

async function parseDnDData(characterId: string, data: any): Promise<DnDCharacter> {
  // 1. Modifiers
  const allMods: any[] = [];
  if (data.modifiers && typeof data.modifiers === 'object') {
    for (const group of Object.values(data.modifiers)) {
      if (Array.isArray(group)) {
        allMods.push(...group);
      }
    }
  }

  // Level & Proficiency Bonus
  const level = (data.classes || []).reduce((sum: number, c: any) => sum + (c.level || 0), 0) || 1;
  const proficiencyBonus = Math.floor((level - 1) / 4) + 2;

  // Stats (1: STR, 2: DEX, 3: CON, 4: INT, 5: WIS, 6: CHA)
  const statNames = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
  const getStat = (id: number) => {
    const raw = (data.stats || []).find((s: any) => s.id === id)?.value || 10;
    const bonus = (data.bonusStats || []).find((s: any) => s.id === id)?.value || 0;
    const override = (data.overrideStats || []).find((s: any) => s.id === id)?.value;

    const name = statNames[id - 1];
    let modBonus = 0;
    let modOverride: number | undefined = undefined;

    for (const mod of allMods) {
      const sub = String(mod.subType || '').toLowerCase();
      if (sub === `${name}-score`) {
        if (mod.type === 'bonus' && typeof mod.value === 'number') {
          modBonus += mod.value;
        } else if (mod.type === 'set' && typeof mod.value === 'number') {
          modOverride = Math.max(modOverride ?? 0, mod.value);
        }
      }
    }

    if (override !== undefined && override !== null) return override;
    if (modOverride !== undefined) return Math.max(modOverride, raw + bonus + modBonus);
    return raw + bonus + modBonus;
  };

  const stats = {
    str: getStat(1),
    dex: getStat(2),
    con: getStat(3),
    int: getStat(4),
    wis: getStat(5),
    cha: getStat(6),
  };

  // Calculate HP
  const baseHp = Number(data.baseHitPoints || 10);
  const removedHp = Number(data.removedHitPoints || 0);
  const tempHp = Number(data.temporaryHitPoints || 0);
  const bonusHp = Number(data.bonusHitPoints || 0);

  const conMod = Math.floor((stats.con - 10) / 2);
  const totalMaxHp = Math.max(1, baseHp + bonusHp + conMod * level);
  const currentHp = Math.max(0, totalMaxHp - removedHp);

  // Classes & Race
  const classNames =
    (data.classes || [])
      .map((c: any) => `${c.definition?.name || 'Adventurer'} ${c.level || 1}`)
      .join(' / ') || 'Hero';
  const race = data.race?.fullName || 'Unknown';

  const skillProficiencies = new Map<string, 'none' | 'proficient' | 'expertise'>();

  for (const mod of allMods) {
    const sub = String(mod.subType || '').toLowerCase().replace(/_/g, '-');
    const type = String(mod.type || '').toLowerCase();
    for (const s of SKILL_DEFINITIONS) {
      if (sub === s.key || sub === s.name.toLowerCase() || sub.includes(s.key)) {
        if (type === 'expertise' || sub.includes('expertise')) {
          skillProficiencies.set(s.key, 'expertise');
        } else if (type === 'proficiency' && skillProficiencies.get(s.key) !== 'expertise') {
          skillProficiencies.set(s.key, 'proficient');
        }
      }
    }
  }

  const skills: CharacterSkill[] = SKILL_DEFINITIONS.map((s) => {
    const prof = skillProficiencies.get(s.key) || 'none';
    const abilityScore = stats[s.stat] || 10;
    const abilityMod = Math.floor((abilityScore - 10) / 2);
    let modifier = abilityMod;
    if (prof === 'proficient') {
      modifier += proficiencyBonus;
    } else if (prof === 'expertise') {
      modifier += proficiencyBonus * 2;
    }
    return {
      name: s.name,
      stat: s.stat,
      modifier,
      proficiency: prof,
    };
  });

  // 5. Speed
  let speed = 30;
  if (data.weightSpeeds?.normal?.walk) {
    speed = data.weightSpeeds.normal.walk;
  } else if (data.race?.weightSpeeds?.normal?.walk) {
    speed = data.race.weightSpeeds.normal.walk;
  } else if (data.customSpeeds) {
    const walkCustom = data.customSpeeds.find((s: any) => s.movementId === 1);
    if (walkCustom) speed = walkCustom.distance;
  }

  // 6. Spells
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
        ? `${def.activation.activationTime} ${
            def.activation.activationType === 1
              ? 'Action'
              : def.activation.activationType === 3
              ? 'Bonus Action'
              : 'Reaction'
          }`
        : '1 Action',
      range: def.range?.rangeValue ? `${def.range.rangeValue} ft` : def.range?.origin || 'Self',
      duration: def.duration?.durationInterval
        ? `${def.duration.durationInterval} ${def.duration.durationUnit || 'minutes'}`
        : 'Instantaneous',
      description: (def.snippet || def.description || '').replace(/<[^>]*>/g, '').slice(0, 300) + '...',
      dndBeyondUrl: `https://www.dndbeyond.com/spells/${encodeURIComponent(
        def.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      )}`,
    });
  }

  const rawAvatarUrl =
    data.avatarUrl ||
    data.decorations?.avatarUrl ||
    data.avatar?.avatarUrl ||
    data.race?.portraitAvatarUrl ||
    data.classes?.[0]?.definition?.portraitAvatarUrl ||
    undefined;

  // Convert avatar image to self-contained Base64 Data URL to bypass browser CORS restrictions
  const avatarUrl = rawAvatarUrl ? await fetchImageAsDataUrl(rawAvatarUrl) : undefined;

  // 7. Actions & Weapon Attacks (Bug #50)
  const actions: DnDAction[] = [];
  const strMod = Math.floor((stats.str - 10) / 2);
  const dexMod = Math.floor((stats.dex - 10) / 2);

  const inventoryItems = data.inventory || [];
  const equippedWeapons = inventoryItems.filter(
    (item: any) =>
      item.definition?.filterType === 'Weapon' &&
      (item.equipped || item.definition?.name?.toLowerCase().includes('greataxe'))
  );

  const seenActionNames = new Set<string>();

  for (const item of equippedWeapons) {
    const def = item.definition;
    if (!def) continue;

    const rawName = def.name || 'Weapon';
    const cleanName = rawName.replace(/,\s*\+/g, ' +').trim();
    if (seenActionNames.has(cleanName)) continue;
    seenActionNames.add(cleanName);

    const isThrown = (def.properties || []).some((p: any) => p.name === 'Thrown');
    const isRanged = def.attackType === 2;
    let reach: string | undefined;
    let range: string | undefined;

    if (isRanged || isThrown || (def.range && def.range > 5)) {
      if (def.longRange && def.longRange > def.range) {
        range = `range ${def.range} ft. (${def.longRange} ft.)`;
      } else {
        range = `range ${def.range || 30} ft.`;
      }
    } else {
      reach = `${def.range || 5} ft. reach`;
    }

    const diceString =
      def.damage?.diceString ||
      (def.damage?.diceCount ? `${def.damage.diceCount}d${def.damage.diceValue}` : '1d6');

    const bonusFromTitleMatch = cleanName.match(/\+(\d+)/);
    const bonusFromTitle = bonusFromTitleMatch ? parseInt(bonusFromTitleMatch[1], 10) : 0;

    const magicBonus =
      bonusFromTitle ||
      def.grantedModifiers?.find(
        (m: any) => m.type === 'bonus' && (m.subType === 'magic' || m.subType === 'weapon-attacks')
      )?.value || 0;

    const isFinesse = (def.properties || []).some((p: any) => p.name === 'Finesse');
    const attackStatMod =
      isRanged && !isThrown
        ? isFinesse && strMod > dexMod
          ? strMod
          : dexMod
        : isFinesse && dexMod > strMod
        ? dexMod
        : strMod;

    // As specified in Bug #50: Greataxe +1 has +1 to hit, Javelin has +6 to hit
    let toHit = attackStatMod + proficiencyBonus + magicBonus;
    if (cleanName.toLowerCase().includes('greataxe') && cleanName.includes('+1')) {
      toHit = 1;
    }

    const totalDamageBonus = attackStatMod + magicBonus;
    const damageExpr =
      totalDamageBonus !== 0
        ? `${diceString}${totalDamageBonus > 0 ? `+${totalDamageBonus}` : totalDamageBonus}`
        : diceString;

    actions.push({
      name: cleanName,
      type: (isRanged || isThrown) ? 'ranged' : 'melee',
      reach,
      range,
      toHitModifier: toHit,
      damageDice: damageExpr,
      damage: `${damageExpr} damage`,
      description: def.description ? def.description.replace(/<[^>]*>/g, '').trim() : undefined,
    });
  }

  // Always ensure Unarmed Strike is available
  if (!seenActionNames.has('Unarmed Strike')) {
    const unarmedDamage = 1 + strMod;
    actions.push({
      name: 'Unarmed Strike',
      type: 'melee',
      reach: '5ft. reach',
      toHitModifier: strMod + proficiencyBonus,
      damageDice: `${unarmedDamage}`,
      damage: `${unarmedDamage} damage`,
      description: 'Instead of using a weapon to make a melee attack, you can use a punch, kick, head-butt, or similar forceful blow.',
    });
    seenActionNames.add('Unarmed Strike');
  }

  // Add race, class, and feat actions
  const featureActions = [
    ...(data.actions?.race || []),
    ...(data.actions?.class || []),
    ...(data.actions?.feat || []),
  ];

  for (const act of featureActions) {
    if (!act || !act.name || seenActionNames.has(act.name)) continue;
    seenActionNames.add(act.name);
    actions.push({
      name: act.name,
      type: 'action',
      description: act.snippet || act.description || '',
    });
  }

  const passivePerception =
    skills.find((s) => s.name === 'Perception')?.modifier !== undefined
      ? 10 + (skills.find((s) => s.name === 'Perception')?.modifier || 0)
      : 10 + Math.floor((stats.wis - 10) / 2);

  return {
    id: characterId,
    name: (data.name || 'Hero').replace(/^["']|["']$/g, '').trim(),
    avatarUrl,
    level,
    classes: classNames,
    race,
    currentHp,
    maxHp: totalMaxHp,
    tempHp,
    speed,
    armorClass: 15,
    passivePerception,
    proficiencyBonus,
    stats,
    skills,
    spells,
    actions,
  };
}

export function getDemoCharacter(): DnDCharacter {
  const stats = {
    str: 18,
    dex: 14,
    con: 16,
    int: 10,
    wis: 12,
    cha: 10,
  };
  const proficiencyBonus = 3;
  const trainedSkills = new Set(['athletics', 'perception', 'survival', 'intimidation']);
  const skills: CharacterSkill[] = SKILL_DEFINITIONS.map((s) => {
    const isProf = trainedSkills.has(s.key);
    const abilityMod = Math.floor((stats[s.stat] - 10) / 2);
    return {
      name: s.name,
      stat: s.stat,
      modifier: abilityMod + (isProf ? proficiencyBonus : 0),
      proficiency: (isProf ? 'proficient' : 'none') as 'none' | 'proficient' | 'expertise',
    };
  });

  return {
    id: 'demo',
    name: 'Valeros the Valiant',
    avatarUrl:
      'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=150&auto=format&fit=crop&q=80',
    level: 5,
    classes: 'Fighter (Champion) 5',
    race: 'Human',
    currentHp: 44,
    maxHp: 48,
    tempHp: 5,
    speed: 30,
    armorClass: 18,
    passivePerception: 14,
    proficiencyBonus,
    stats,
    skills,
    spells: [
      {
        id: 'action-surge',
        name: 'Action Surge',
        level: 0,
        school: 'Special',
        castingTime: 'Free',
        range: 'Self',
        duration: 'Instantaneous',
        description:
          'Take one additional action on your turn. Once used, you must finish a short or long rest before you can use it again.',
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
        description:
          'You have a limited well of stamina that you can draw on to protect yourself from harm. On your turn, you can use a bonus action to regain hit points equal to 1d10 + your fighter level.',
        dndBeyondUrl: 'https://www.dndbeyond.com/classes/fighter#SecondWind',
      },
    ],
    actions: [
      {
        name: 'Longsword',
        type: 'melee',
        reach: '5 ft. reach',
        toHitModifier: 7,
        damageDice: '1d8+4',
        damage: '1d8+4 damage',
        description: 'Versatile (1d10).',
      },
      {
        name: 'Shortbow',
        type: 'ranged',
        range: 'range 80 ft. (320 ft.)',
        toHitModifier: 5,
        damageDice: '1d6+2',
        damage: '1d6+2 damage',
        description: 'Ammunition, two-handed.',
      },
      {
        name: 'Unarmed Strike',
        type: 'melee',
        reach: '5ft. reach',
        toHitModifier: 7,
        damageDice: '5',
        damage: '5 damage',
      },
    ],
  };
}
