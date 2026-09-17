import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseDiceExpression } from './ChatPanel.js';

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
});
