import { describe, it } from 'node:test';
import assert from 'node:assert';
import { nameGen, generateRandomName } from './nameGenerator.js';

describe('Fantasy Name Generator', () => {
  it('generates 10 names by default with first and surname', () => {
    const names = nameGen();
    assert.strictEqual(names.length, 10);
    for (const name of names) {
      assert.strictEqual(typeof name, 'string');
      assert.ok(name.includes(' '), `Name "${name}" should contain a space separating first and surname`);
      const parts = name.split(' ');
      assert.strictEqual(parts.length, 2);
      assert.ok(parts[0].length >= 3, `First name "${parts[0]}" should be at least 3 chars`);
      assert.ok(parts[1].length >= 3, `Surname "${parts[1]}" should be at least 3 chars`);
    }
  });

  it('generates male and female specific names', () => {
    const maleNames = nameGen(5, 'male');
    assert.strictEqual(maleNames.length, 5);

    const femaleNames = nameGen(5, 'female');
    assert.strictEqual(femaleNames.length, 5);

    const singleRandom = generateRandomName();
    assert.strictEqual(typeof singleRandom, 'string');
    assert.ok(singleRandom.length > 5);
  });
});
