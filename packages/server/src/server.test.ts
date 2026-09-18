import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createSession, getSession, updateSession, getAllSessions, removeSession } from './session.js';
import { fetchDnDCharacter } from './dndbeyond.js';

describe('Session Management & In-Memory Fallback', () => {
  it('creates a session with default map and tokens', () => {
    const { session, gmKey } = createSession('Test Room');
    assert.ok(session.id, 'Session has an ID');
    assert.ok(gmKey, 'GM key generated');
    assert.strictEqual(session.maps.length, 1, 'Has default map');
    assert.ok(session.tokens['token-fighter'], 'Has fighter token');
    assert.ok(session.tokens['token-goblin'], 'Has goblin token');
    assert.strictEqual(session.initiative.items.length, 2, 'Has initiative items');

    const fetched = getSession(session.id);
    assert.deepStrictEqual(fetched, session);
  });

  it('updates and lists sessions in in-memory mode without errors', () => {
    const { session } = createSession('Updated Room');
    const updated = updateSession(session.id, { name: 'Renamed Room' });
    assert.strictEqual(updated?.name, 'Renamed Room');
    assert.strictEqual(getSession(session.id)?.name, 'Renamed Room');

    const all = getAllSessions();
    assert.ok(all.some((s) => s.id === session.id && s.name === 'Renamed Room'));

    const removed = removeSession(session.id);
    assert.strictEqual(removed, true);
    assert.strictEqual(getSession(session.id), null);
  });
});

describe('D&D Beyond Integration', () => {
  it('parses demo character accurately', async () => {
    const char = await fetchDnDCharacter('demo');
    assert.ok(char, 'Character retrieved');
    assert.strictEqual(char.name, 'Valeros the Valiant');
    assert.strictEqual(char.currentHp, 44);
    assert.strictEqual(char.maxHp, 48);
    assert.strictEqual(char.speed, 30);
    assert.strictEqual(char.stats.str, 18);
    assert.ok(char.spells.length >= 2, 'Spells parsed');
  });

  it('parses real D&D Beyond character URL for 49074997', async () => {
    const char = await fetchDnDCharacter('https://www.dndbeyond.com/characters/49074997');
    assert.ok(char, 'Character retrieved');
    assert.strictEqual(char.name, 'Joy');
    assert.strictEqual(char.level, 5);
    assert.strictEqual(char.speed, 30);
    assert.strictEqual(char.proficiencyBonus, 3, 'Level 5 proficiency bonus is +3');
    assert.ok(char.skills && char.skills.length === 18, 'All 18 skills parsed');
    const athletics = char.skills.find((s) => s.name === 'Athletics');
    assert.ok(athletics, 'Athletics skill found');
    assert.strictEqual(athletics.stat, 'str');
    assert.ok(char.avatarUrl && (char.avatarUrl.startsWith('http') || char.avatarUrl.startsWith('data:')), 'Avatar URL parsed');
  });

  it('parses real D&D Beyond character 47804290 with Greataxe +1, Javelin, and Unarmed Strike (Bug #50)', async () => {
    const char = await fetchDnDCharacter('https://www.dndbeyond.com/characters/47804290');
    assert.ok(char, 'Character retrieved');
    assert.ok(char.actions && char.actions.length >= 3, 'Character has parsed actions');

    const greataxe = char.actions.find((a) => a.name.toLowerCase().includes('greataxe'));
    assert.ok(greataxe, 'Greataxe action found');
    assert.strictEqual(greataxe.reach, '5 ft. reach');
    assert.strictEqual(greataxe.toHitModifier, 1, 'Greataxe +1 has +1 to hit');
    assert.strictEqual(greataxe.damage, '1d12+4 damage', 'Greataxe +1 has 1d12+4 damage');

    const javelin = char.actions.find((a) => a.name.toLowerCase().includes('javelin'));
    assert.ok(javelin, 'Javelin action found');
    assert.strictEqual(javelin.range, 'range 30 ft. (120 ft.)');
    assert.strictEqual(javelin.toHitModifier, 6, 'Javelin has +6 to hit');
    assert.strictEqual(javelin.damage, '1d6+3 damage', 'Javelin has 1d6+3 damage');

    const unarmed = char.actions.find((a) => a.name.toLowerCase().includes('unarmed strike'));
    assert.ok(unarmed, 'Unarmed Strike action found');
    assert.strictEqual(unarmed.reach, '5ft. reach');
    assert.strictEqual(unarmed.toHitModifier, 6, 'Unarmed Strike has +6 to hit');
    assert.strictEqual(unarmed.damage, '4 damage', 'Unarmed Strike has 4 damage');
  });

  it('imports initiative bonus, saving throws, passives, and currencies (Bug #51)', async () => {
    const char = await fetchDnDCharacter('https://www.dndbeyond.com/characters/47804290');
    assert.ok(char, 'Character retrieved');
    assert.strictEqual(char.initiativeBonus, 2, 'Initiative bonus is +2 (DEX mod)');

    assert.ok(char.savingThrows, 'Saving throws parsed');
    assert.strictEqual(char.savingThrows.str, 6, 'STR save: +3 mod + 3 prof = +6');
    assert.strictEqual(char.savingThrows.dex, 2, 'DEX save: +2 mod');
    assert.strictEqual(char.savingThrows.con, 7, 'CON save: +4 mod + 3 prof = +7');
    assert.ok(char.savingThrows.proficiencies?.includes('str'), 'STR proficient in saves');
    assert.ok(char.savingThrows.proficiencies?.includes('con'), 'CON proficient in saves');

    assert.ok(char.passives, 'Passives parsed');
    assert.ok(typeof char.passives.perception === 'number', 'Passive perception is a number');
    assert.ok(typeof char.passives.investigation === 'number', 'Passive investigation is a number');
    assert.ok(typeof char.passives.insight === 'number', 'Passive insight is a number');

    assert.ok(char.currencies, 'Currencies parsed');
    assert.strictEqual(char.currencies.gp, 770, 'GP parsed accurately');
  });
});
