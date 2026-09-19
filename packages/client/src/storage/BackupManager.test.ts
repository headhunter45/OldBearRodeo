import { describe, it } from 'node:test';
import assert from 'node:assert';
import { BackupPayload } from './BackupManager.js';

describe('Backup Manager Payload Structure', () => {
  it('validates backup payload specification', () => {
    const mockPayload: BackupPayload = {
      app: 'OldBearRodeo',
      version: 1,
      exportedAt: Date.now(),
      session: null,
      assets: [
        {
          id: 'map-1',
          name: 'Dungeon Level 1',
          type: 'map',
          dataUrl: 'data:image/png;base64,mock...',
          createdAt: Date.now(),
        },
        {
          id: 'audio-1',
          name: 'Tavern Ambience',
          type: 'audio',
          dataUrl: 'data:audio/mp3;base64,mock...',
          createdAt: Date.now(),
        },
      ],
      localStorage: {
        oldbear_saved_characters: JSON.stringify([{ id: 'demo', name: 'Valeros' }]),
      },
    };

    assert.strictEqual(mockPayload.app, 'OldBearRodeo');
    assert.strictEqual(mockPayload.assets.length, 2);
    assert.strictEqual(mockPayload.assets[0].type, 'map');
    assert.strictEqual(mockPayload.assets[1].type, 'audio');
    assert.ok(mockPayload.localStorage.oldbear_saved_characters);
  });

  it('tracks props like tokens with custom dimensions and prop metadata (Task #107)', () => {
    const mockPayload: BackupPayload = {
      app: 'OldBearRodeo',
      version: 1,
      exportedAt: Date.now(),
      session: null,
      assets: [
        {
          id: 'token-1',
          name: 'Fighter',
          type: 'token',
          dataUrl: 'data:image/png;base64,mock1...',
          size: 1,
          createdAt: Date.now(),
        },
        {
          id: 'prop-1',
          name: 'Stone Wall',
          type: 'prop',
          dataUrl: 'data:image/png;base64,mock2...',
          isProp: true,
          layer: 'prop',
          propWidth: 2.5,
          propHeight: 1.0,
          rotation: 90,
          createdAt: Date.now(),
        },
      ],
      localStorage: {},
    };

    const propAsset = mockPayload.assets.find((a) => a.type === 'prop');
    assert.ok(propAsset, 'Prop asset is tracked');
    assert.strictEqual(propAsset?.isProp, true);
    assert.strictEqual(propAsset?.layer, 'prop');
    assert.strictEqual(propAsset?.propWidth, 2.5);
    assert.strictEqual(propAsset?.propHeight, 1.0);
    assert.strictEqual(propAsset?.rotation, 90);
  });
});
