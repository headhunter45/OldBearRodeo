import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createSession, getSession } from './session.js';
import { fetchDnDCharacter } from './dndbeyond.js';

describe('Session Management', () => {
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
    assert.ok(char.maxHp >= 28);
  });
});
