import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseDiceExpression, processSlashCommand } from './ChatPanel.js';

describe('Dice Parser & Slash Command Utilities', () => {
  it('correctly parses standard single and multi-dice expressions', () => {
    const d20 = parseDiceExpression('1d20');
    assert.ok(d20);
    assert.strictEqual(d20.count, 1);
    assert.strictEqual(d20.sides, 20);
    assert.strictEqual(d20.modifier, 0);
    assert.strictEqual(d20.rolls.length, 1);
    assert.ok(d20.total >= 1 && d20.total <= 20);

    const d6withMod = parseDiceExpression('3d6+5');
    assert.ok(d6withMod);
    assert.strictEqual(d6withMod.count, 3);
    assert.strictEqual(d6withMod.sides, 6);
    assert.strictEqual(d6withMod.modifier, 5);
    assert.strictEqual(d6withMod.rolls.length, 3);
    assert.ok(d6withMod.total >= 8 && d6withMod.total <= 23);

    const negativeMod = parseDiceExpression('1d20-3');
    assert.ok(negativeMod);
    assert.strictEqual(negativeMod.modifier, -3);
    assert.ok(negativeMod.total >= -2 && negativeMod.total <= 17);
  });

  it('supports advantage and disadvantage on d20 checks', () => {
    const adv = parseDiceExpression('1d20', 'advantage');
    assert.ok(adv);
    assert.strictEqual(adv.rolls.length, 2);
    assert.ok(adv.keptRoll !== undefined);
    assert.strictEqual(adv.keptRoll, Math.max(adv.rolls[0], adv.rolls[1]));
    assert.strictEqual(adv.total, adv.keptRoll);

    const dis = parseDiceExpression('1d20', 'disadvantage');
    assert.ok(dis);
    assert.strictEqual(dis.rolls.length, 2);
    assert.ok(dis.keptRoll !== undefined);
    assert.strictEqual(dis.keptRoll, Math.min(dis.rolls[0], dis.rolls[1]));
    assert.strictEqual(dis.total, dis.keptRoll);
  });

  it('handles invalid syntax gracefully by returning null', () => {
    assert.strictEqual(parseDiceExpression('invalid'), null);
    assert.strictEqual(parseDiceExpression('hello'), null);
    assert.strictEqual(parseDiceExpression(''), null);
  });

  it('lists options ephemerally without rolling when /attack, /spell, or /skill have no name or invalid name (Bug #54)', () => {
    const testPlayer = {
      id: 'test-player-1',
      name: 'Ranger',
      role: 'player' as const,
      color: '#10b981',
      connected: true,
      assignedTokenIds: [],
    };

    const testChar = {
      id: 'char-1',
      name: 'Gimli',
      level: 5,
      classes: 'Fighter 5',
      race: 'Dwarf',
      currentHp: 40,
      maxHp: 40,
      tempHp: 0,
      speed: 25,
      armorClass: 18,
      passivePerception: 12,
      spells: [{ id: 'sp-1', name: 'Shield', level: 1, school: 'Abjuration' }],
      actions: [
        { name: 'Battleaxe', type: 'melee', toHitModifier: 6, damage: '1d8+3 damage' },
        { name: 'Crossbow', type: 'ranged', toHitModifier: 4, damage: '1d8+2 damage' },
      ],
      skills: [
        { name: 'Athletics', stat: 'str' as const, modifier: 6, proficiency: 'proficient' as const },
        { name: 'Stealth', stat: 'dex' as const, modifier: 1, proficiency: 'none' as const },
      ],
      stats: { str: 16, dex: 12, con: 16, int: 10, wis: 12, cha: 8 },
    };

    const sentMessages: any[] = [];
    const broadcastRolls: any[] = [];

    const ctx = {
      player: testPlayer,
      character: testChar as any,
      onSendMessage: (msg: any) => sentMessages.push(msg),
      onBroadcastRoll: (roll: any) => broadcastRolls.push(roll),
    };

    // 1. /help should be ephemeral for caller only
    processSlashCommand('/help', ctx);
    assert.strictEqual(sentMessages.length, 1);
    assert.strictEqual(sentMessages[0].isEphemeral, true);
    assert.strictEqual(sentMessages[0].recipientId, 'test-player-1');
    assert.strictEqual(broadcastRolls.length, 0);

    // 2. /attack with no name should list available attacks ephemerally and NOT roll
    processSlashCommand('/attack', ctx);
    assert.strictEqual(sentMessages.length, 2);
    const attackMsg = sentMessages[1];
    assert.strictEqual(attackMsg.isEphemeral, true);
    assert.strictEqual(attackMsg.recipientId, 'test-player-1');
    assert.ok(attackMsg.text.includes('Battleaxe'));
    assert.ok(attackMsg.text.includes('Crossbow'));
    assert.strictEqual(broadcastRolls.length, 0, 'No roll broadcast for bare /attack');

    // 3. /spell with no name should list available spells ephemerally and NOT roll
    processSlashCommand('/spell', ctx);
    assert.strictEqual(sentMessages.length, 3);
    const spellMsg = sentMessages[2];
    assert.strictEqual(spellMsg.isEphemeral, true);
    assert.strictEqual(spellMsg.recipientId, 'test-player-1');
    assert.ok(spellMsg.text.includes('Shield'));
    assert.strictEqual(broadcastRolls.length, 0, 'No roll broadcast for bare /spell');

    // 4. /skill with no name should list available skills ephemerally and NOT roll
    processSlashCommand('/skill', ctx);
    assert.strictEqual(sentMessages.length, 4);
    const skillMsg = sentMessages[3];
    assert.strictEqual(skillMsg.isEphemeral, true);
    assert.strictEqual(skillMsg.recipientId, 'test-player-1');
    assert.ok(skillMsg.text.includes('Athletics'));
    assert.ok(skillMsg.text.includes('Stealth'));
    assert.strictEqual(broadcastRolls.length, 0, 'No roll broadcast for bare /skill');

    // 5. /attack with invalid name should list available options ephemerally and NOT roll
    processSlashCommand('/attack nonexistent', ctx);
    assert.strictEqual(sentMessages.length, 5);
    const invalidAttackMsg = sentMessages[4];
    assert.strictEqual(invalidAttackMsg.isEphemeral, true);
    assert.strictEqual(invalidAttackMsg.recipientId, 'test-player-1');
    assert.ok(invalidAttackMsg.text.includes('Could not find attack'));
    assert.strictEqual(broadcastRolls.length, 0, 'No roll broadcast for invalid attack');
  });

  it('handles /sync command and token selection logic (Bug #55)', async () => {
    const testPlayer = {
      id: 'p-1',
      name: 'Ranger',
      role: 'player' as const,
      color: '#10b981',
      connected: true,
      assignedTokenIds: [],
    };

    const mockTokens = [
      { id: 'tok-1', name: 'Aragorn', x: 0, y: 0, size: 1, currentHp: 20, maxHp: 20, speed: 30 },
      { id: 'tok-2', name: 'Legolas', x: 5, y: 5, size: 1, currentHp: 15, maxHp: 15, speed: 35 },
    ];

    const mockChar = {
      id: '47804290',
      name: 'Grom',
      level: 5,
      classes: 'Barbarian 5',
      race: 'Orc',
      currentHp: 55,
      maxHp: 55,
      tempHp: 0,
      speed: 40,
      armorClass: 15,
      passivePerception: 14,
      initiativeBonus: 2,
    };

    const sentMessages: any[] = [];
    const updatedTokens: any[] = [];
    let updatedPlayerChar: any = null;

    const ctx = {
      player: testPlayer,
      tokens: mockTokens as any,
      onSendMessage: (msg: any) => sentMessages.push(msg),
      onSyncToken: (tokenId: string, updates: any) => updatedTokens.push({ tokenId, updates }),
      onUpdatePlayerChar: (char: any) => { updatedPlayerChar = char; },
      fetchCharacterFn: async (idOrUrl: string) => {
        if (idOrUrl.includes('fail')) throw new Error('Not found');
        return mockChar as any;
      },
    };

    // 1. /sync without parameters shows usage instructions
    processSlashCommand('/sync', ctx);
    assert.ok(sentMessages.at(-1)?.text.includes('Usage: /sync'));

    // 2. /sync with multiple tokens but no token index prompts for token index
    processSlashCommand('/sync 47804290', ctx);
    assert.ok(sentMessages.at(-1)?.text.includes('Please specify the token index'));

    // 3. /sync with invalid token index shows error
    processSlashCommand('/sync 47804290 99', ctx);
    assert.ok(sentMessages.at(-1)?.text.includes('Invalid token index'));

    // 4. /sync with valid token index (e.g. 2 for Legolas)
    processSlashCommand('/sync 47804290 2', ctx);
    // Allow the promise in fetchCharacterFn to resolve
    await new Promise((r) => setTimeout(r, 20));

    assert.strictEqual(updatedPlayerChar?.name, 'Grom');
    assert.strictEqual(updatedTokens.length, 1);
    assert.strictEqual(updatedTokens[0].tokenId, 'tok-2');
    assert.strictEqual(updatedTokens[0].updates.name, 'Grom');
    assert.strictEqual(updatedTokens[0].updates.currentHp, 55);
    assert.strictEqual(updatedTokens[0].updates.initiativeBonus, 2);
    assert.ok(sentMessages.at(-1)?.text.includes('Successfully synced "Grom" to token #2'));

    // 5. /sync with single token automatically targets it without index
    const singleTokenCtx = {
      ...ctx,
      tokens: [mockTokens[0]] as any,
    };
    processSlashCommand('/sync 47804290', singleTokenCtx);
    await new Promise((r) => setTimeout(r, 20));

    assert.strictEqual(updatedTokens.length, 2);
    assert.strictEqual(updatedTokens[1].tokenId, 'tok-1');
  });

  it('lists tokens and their index numbers with /tokens (Bug #56)', () => {
    const testPlayer = {
      id: 'p-1',
      name: 'Ranger',
      role: 'player' as const,
      color: '#10b981',
      connected: true,
      assignedTokenIds: [],
    };

    const mockTokens = [
      { id: 'tok-1', name: 'Aragorn', x: 0, y: 0, size: 1, currentHp: 20, maxHp: 20 },
      { id: 'tok-2', name: 'Legolas', x: 5, y: 5, size: 1, currentHp: 15, maxHp: 15 },
    ];

    const sentMessages: any[] = [];
    const ctx = {
      player: testPlayer,
      tokens: mockTokens as any,
      onSendMessage: (msg: any) => sentMessages.push(msg),
    };

    // When tokens are available
    processSlashCommand('/tokens', ctx);
    assert.strictEqual(sentMessages.length, 1);
    const msg = sentMessages[0];
    assert.strictEqual(msg.isEphemeral, true);
    assert.strictEqual(msg.recipientId, 'p-1');
    assert.ok(msg.text.includes('1. Aragorn'));
    assert.ok(msg.text.includes('2. Legolas'));

    // When no tokens are available
    processSlashCommand('/tokens', { ...ctx, tokens: [] });
    assert.strictEqual(sentMessages.length, 2);
    assert.ok(sentMessages[1].text.includes('No controllable tokens'));
  });

  it('highlights bonus actions and reactions in /attack and /spell (Bug #71)', () => {
    const testPlayer = {
      id: 'test-player-1',
      name: 'Ranger',
      role: 'player' as const,
      color: '#10b981',
      connected: true,
      assignedTokenIds: [],
    };

    const testChar = {
      id: 'char-71',
      name: 'Vax',
      actions: [
        { name: 'Dagger Slash', type: 'melee', toHitModifier: 7, damage: '1d4+4 damage', activationType: 'action' },
        { name: 'Cunning Action: Dash', type: 'bonus', activationType: 'bonus', description: 'As a bonus action you can dash' },
        { name: 'Uncanny Dodge', type: 'reaction', activationType: 'reaction', description: 'Use reaction when hit' },
      ],
      spells: [
        { id: 'sp-1', name: 'Misty Step', level: 2, school: 'Conjuration', castingTime: '1 bonus action' },
        { id: 'sp-2', name: 'Shield', level: 1, school: 'Abjuration', castingTime: '1 reaction' },
        { id: 'sp-3', name: 'Fireball', level: 3, school: 'Evocation', castingTime: '1 action' },
      ],
    };

    const sentMessages: any[] = [];
    const ctx = {
      player: testPlayer,
      character: testChar as any,
      onSendMessage: (msg: any) => sentMessages.push(msg),
    };

    // /attack should highlight bonus action and reaction
    processSlashCommand('/attack', ctx);
    const attackMsg = sentMessages[0];
    assert.ok(attackMsg.text.includes('Cunning Action: Dash [Bonus Action]'), 'Dash has Bonus Action tag');
    assert.ok(attackMsg.text.includes('Uncanny Dodge [Reaction]'), 'Uncanny Dodge has Reaction tag');
    assert.ok(!attackMsg.text.includes('Dagger Slash [Bonus Action]'));

    // /spell should highlight bonus action and reaction
    processSlashCommand('/spell', ctx);
    const spellMsg = sentMessages[1];
    assert.ok(spellMsg.text.includes('Misty Step [Bonus Action]'), 'Misty Step has Bonus Action tag');
    assert.ok(spellMsg.text.includes('Shield [Reaction]'), 'Shield has Reaction tag');
    assert.ok(!spellMsg.text.includes('Fireball [Bonus Action]'));
  });

  it('supports 1-based index selection and index listing for spell, skill, attack, and item (Bug #91)', () => {
    const testPlayer = {
      id: 'test-player-91',
      name: 'Rogue',
      role: 'player' as const,
      color: '#3b82f6',
      connected: true,
      assignedTokenIds: [],
    };

    const testChar = {
      id: 'char-91',
      name: 'Shadow',
      actions: [
        { name: 'Dagger', type: 'melee', toHitModifier: 6, damageDice: '1d4+3' },
        { name: 'Shortbow', type: 'ranged', toHitModifier: 5, damageDice: '1d6+3' },
      ],
      spells: [
        { id: 'sp-1', name: 'Invisibility', level: 2, school: 'Illusion', castingTime: '1 action' },
      ],
      skills: [
        { name: 'Acrobatics', stat: 'dex' as const, modifier: 5, proficiency: 'proficient' as const },
        { name: 'Stealth', stat: 'dex' as const, modifier: 7, proficiency: 'expertise' as const },
      ],
      items: [
        { name: 'Smoke Bomb', description: 'Creates a 15ft cloud of smoke.', quantity: 3 },
      ],
      stats: { str: 10, dex: 18, con: 14, int: 12, wis: 10, cha: 12 },
    };

    const sentMessages: any[] = [];
    const broadcastRolls: any[] = [];
    const ctx = {
      player: testPlayer,
      character: testChar as any,
      onSendMessage: (msg: any) => sentMessages.push(msg),
      onBroadcastRoll: (roll: any) => broadcastRolls.push(roll),
    };

    // 1. Bare commands include 1-based index numbers
    processSlashCommand('/attack', ctx);
    assert.ok(sentMessages[0].text.includes('1. Dagger'));
    assert.ok(sentMessages[0].text.includes('2. Shortbow'));

    processSlashCommand('/spell', ctx);
    assert.ok(sentMessages[1].text.includes('1. Invisibility'));

    processSlashCommand('/skill', ctx);
    assert.ok(sentMessages[2].text.includes('1. Acrobatics'));
    assert.ok(sentMessages[2].text.includes('2. Stealth'));

    processSlashCommand('/item', ctx);
    assert.ok(sentMessages[3].text.includes('1. Smoke Bomb'));

    // 2. Invoking with index 1 works
    processSlashCommand('/attack 1', ctx);
    assert.ok(sentMessages[4].text.includes('attacks with Dagger'));

    processSlashCommand('/spell 1', ctx);
    assert.ok(sentMessages[5].text.includes('casts Invisibility'));

    processSlashCommand('/skill 2', ctx);
    assert.ok(sentMessages[6].text.includes('checks Stealth'));

    processSlashCommand('/item 1', ctx);
    assert.ok(sentMessages[7].text.includes('Smoke Bomb'));
  });
});
