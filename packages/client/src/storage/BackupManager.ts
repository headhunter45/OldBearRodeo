import { getDB, StoredAsset } from './db.js';
import { GameSession } from '@oldbear/shared';

export interface BackupPayload {
  app: 'OldBearRodeo';
  version: 1;
  exportedAt: number;
  session?: GameSession | null;
  assets: StoredAsset[];
  localStorage: Record<string, string>;
}

export async function exportAllData(session?: GameSession | null): Promise<Blob> {
  const db = await getDB();
  const assets = await db.getAll('assets');

  const storageMap: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('oldbear_') || key.startsWith('obr_'))) {
      const val = localStorage.getItem(key);
      if (val !== null) {
        storageMap[key] = val;
      }
    }
  }

  const payload: BackupPayload = {
    app: 'OldBearRodeo',
    version: 1,
    exportedAt: Date.now(),
    session: session || null,
    assets,
    localStorage: storageMap,
  };

  const json = JSON.stringify(payload, null, 2);
  return new Blob([json], { type: 'application/json' });
}

export function downloadBackupFile(blob: Blob, customName?: string) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = customName || `oldbear-rodeo-backup-${dateStr}.json`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importAllData(
  jsonString: string
): Promise<{ assetCount: number; charCount: number; session?: GameSession | null }> {
  const data = JSON.parse(jsonString) as BackupPayload;

  if (data.app !== 'OldBearRodeo' || !Array.isArray(data.assets)) {
    throw new Error('Invalid backup file: Not a recognized OldBearRodeo backup.');
  }

  // Restore IndexedDB assets
  const db = await getDB();
  const tx = db.transaction('assets', 'readwrite');
  for (const asset of data.assets) {
    if (asset && asset.id) {
      await tx.store.put(asset);
    }
  }
  await tx.done;

  // Restore LocalStorage
  let charCount = 0;
  if (data.localStorage && typeof data.localStorage === 'object') {
    for (const [key, value] of Object.entries(data.localStorage)) {
      try {
        localStorage.setItem(key, value);
        if (key.includes('character')) {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) charCount += parsed.length;
        }
      } catch (e) {
        console.warn(`Failed to restore localStorage key ${key}:`, e);
      }
    }
  }

  return {
    assetCount: data.assets.length,
    charCount,
    session: data.session,
  };
}
