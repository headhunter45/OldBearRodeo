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
});
