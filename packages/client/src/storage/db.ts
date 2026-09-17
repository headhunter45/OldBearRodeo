import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface StoredAsset {
  id: string;
  name: string;
  type: 'map' | 'token' | 'prop' | 'audio';
  dataUrl: string; // Base64 data URL or Blob URL
  width?: number;
  height?: number;
  ringColor?: string;
  fillColor?: string;
  speed?: number;
  maxHp?: number;
  createdAt: number;
}

interface OldBearDB extends DBSchema {
  assets: {
    key: string;
    value: StoredAsset;
    indexes: { 'by-type': string };
  };
  settings: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'OldBearRodeoDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<OldBearDB>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<OldBearDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('assets')) {
          const store = db.createObjectStore('assets', { keyPath: 'id' });
          store.createIndex('by-type', 'type');
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveAsset(asset: StoredAsset): Promise<void> {
  const db = await getDB();
  await db.put('assets', asset);
}

export async function getAssetsByType(type: 'map' | 'token' | 'prop' | 'audio'): Promise<StoredAsset[]> {
  const db = await getDB();
  return db.getAllFromIndex('assets', 'by-type', type);
}

export async function getAsset(id: string): Promise<StoredAsset | undefined> {
  const db = await getDB();
  return db.get('assets', id);
}

export async function deleteAsset(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('assets', id);
}

export async function saveSetting(key: string, value: any): Promise<void> {
  const db = await getDB();
  await db.put('settings', { key, value });
}

export async function getSetting<T>(key: string, defaultValue?: T): Promise<T | undefined> {
  const db = await getDB();
  const res = await db.get('settings', key);
  return res ? res.value : defaultValue;
}
