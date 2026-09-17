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
});
