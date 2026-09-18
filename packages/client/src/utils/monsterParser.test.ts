import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  isTetraCubeMonsterFile,
  parseTetraCubeMonster,
  getNextNumberedTokenName,
  createMonsterToken,
} from './monsterParser.js';

const SAMPLE_ANKHEG_JSON = JSON.stringify({
  name: 'Ankheg',
  size: 'Large',
  type: 'monstrosity',
  tag: '',
  alignment: 'unaligned',
  armorClass: 14,
  armorType: 'natural armor',
  hitDice: 6,
  hpText: '39 (6d10 + 6)',
  speed: '30 ft., burrow 10 ft.',
  strPoints: 17,
  dexPoints: 11,
  conPoints: 13,
  intPoints: 1,
  wisPoints: 13,
  chaPoints: 6,
  senses: 'darkvision 60 ft., tremorsense 60 ft., passive Perception 13',
  languages: '—',
  challenge: '2',
  xp: '450',
  actions: [
    {
      name: 'Bite',
      desc: 'Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 10 (2d6 + 3) slashing damage plus 3 (1d6) acid damage.',
    },
    {
      name: 'Acid Spray (Recharge 6)',
      desc: 'The ankheg spits acid in a line that is 30 ft. long and 5 ft. wide. Each creature must make a DC 13 Dexterity saving throw, taking 14 (4d6) acid damage.',
    },
  ],
  reactions: [
    {
      name: 'Chitinous Shield',
      desc: 'As a reaction when hit, the ankheg curls into its shell adding +2 to AC.',
    },
  ],
});

describe('TetraCube Monster Parser & Dual-Drop Logic (Bug #73)', () => {
  it('identifies valid TetraCube monster file by filename and JSON schema', () => {
    assert.strictEqual(isTetraCubeMonsterFile('{}', 'goblin.monster'), true);
    assert.strictEqual(isTetraCubeMonsterFile(SAMPLE_ANKHEG_JSON, 'ankheg.json'), true);
    assert.strictEqual(isTetraCubeMonsterFile('{"not": "a monster"}', 'backup.json'), false);
  });

  it('parses monster stats, AC, HP, speed, and actions correctly', () => {
    const result = parseTetraCubeMonster(SAMPLE_ANKHEG_JSON);
    assert.strictEqual(result.character.name, 'Ankheg');
    assert.strictEqual(result.defaultSize, 2, 'Large size maps to 2x2 grid');
    assert.strictEqual(result.hp, 39, 'HP parsed from 39 (6d10 + 6)');
    assert.strictEqual(result.ac, 14, 'AC parsed accurately');
    assert.strictEqual(result.speed, 30, 'Speed parsed as 30 ft');
    assert.strictEqual(result.character.stats.str, 17);
    assert.strictEqual(result.character.stats.dex, 11);

    // Check actions
    const bite = result.character.actions?.find((a) => a.name === 'Bite');
    assert.ok(bite, 'Bite action exists');
    assert.strictEqual(bite.toHitModifier, 5, 'Bite has +5 to hit');
    assert.strictEqual(bite.reach, '5 ft.', 'Bite reach is 5 ft.');
    assert.ok(bite.damage?.includes('2d6+3'), 'Bite damage contains 2d6+3');

    // Check reactions
    const shieldReact = result.character.actions?.find((a) => a.name === 'Chitinous Shield');
    assert.ok(shieldReact, 'Chitinous Shield reaction exists');
    assert.strictEqual(shieldReact.activationType, 'reaction', 'Shield has reaction activationType');
  });

  it('auto-numbers tokens correctly starting with Ankheg 1, Ankheg 2, Ankheg 3', () => {
    const emptyTokens: any[] = [];
    assert.strictEqual(getNextNumberedTokenName('Ankheg', emptyTokens), 'Ankheg 1');

    const oneToken = [{ name: 'Ankheg 1' }] as any;
    assert.strictEqual(getNextNumberedTokenName('Ankheg', oneToken), 'Ankheg 2');

    const twoTokens = [{ name: 'Ankheg 1' }, { name: 'Ankheg 2' }] as any;
    assert.strictEqual(getNextNumberedTokenName('Ankheg', twoTokens), 'Ankheg 3');

    const unnumberedToken = [{ name: 'Ankheg' }] as any;
    assert.strictEqual(getNextNumberedTokenName('Ankheg', unnumberedToken), 'Ankheg 2');
  });

  it('creates ready-to-fight Token with full statblock and auto-numbering', () => {
    const parsed = parseTetraCubeMonster(SAMPLE_ANKHEG_JSON);
    const existingTokens = [{ name: 'Ankheg 1' }] as any;
    const token = createMonsterToken(parsed.asset, 'map-1', 500, 600, existingTokens);

    assert.strictEqual(token.name, 'Ankheg 2', 'Auto-numbered to Ankheg 2');
    assert.strictEqual(token.currentHp, 39);
    assert.strictEqual(token.maxHp, 39);
    assert.strictEqual(token.size, 2);
    assert.strictEqual(token.speed, 30);
    assert.ok(token.character, 'Token has attached character sheet');
    assert.strictEqual(token.character.name, 'Ankheg 2');
    assert.ok(token.character.actions && token.character.actions.length >= 2);
  });
});
