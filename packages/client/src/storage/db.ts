import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface StoredAsset {
  id: string;
  name: string;
  type: 'map' | 'token' | 'prop' | 'audio';
  dataUrl: string; // Base64 data URL or Blob URL
  fileSize?: number;
  fileHash?: string;
  width?: number;
  height?: number;
  ringColor?: string;
  fillColor?: string;
  speed?: number;
  maxHp?: number;
  armorClass?: number;
  size?: number;
  monsterData?: any;
  character?: any;
  isProp?: boolean;
  layer?: 'token' | 'prop';
  propWidth?: number;
  propHeight?: number;
  rotation?: number;
  locked?: boolean;
  clipCircle?: boolean;
  clipShape?: string;
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

export function computeContentHash(content: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < content.length; i++) {
    const ch = content.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

export async function findDuplicateAsset(fileSize: number, hash: string): Promise<StoredAsset | null> {
  const db = await getDB();
  const all = await db.getAll('assets');
  return (
    all.find((a) => (a.fileSize === fileSize && a.fileHash === hash) || (a.fileHash && a.fileHash === hash)) ||
    null
  );
}

export async function getAllAssets(): Promise<StoredAsset[]> {
  const db = await getDB();
  return db.getAll('assets');
}

export const ASSET_UPDATED_EVENT = 'oldbear:asset-updated';

export function notifyAssetUpdated(asset?: StoredAsset) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ASSET_UPDATED_EVENT, { detail: { asset } }));
  }
}

export async function saveAsset(asset: StoredAsset): Promise<void> {
  const db = await getDB();
  if (!asset.fileHash && asset.dataUrl) {
    asset.fileHash = computeContentHash(asset.dataUrl);
  }
  await db.put('assets', asset);
  notifyAssetUpdated(asset);
}

export async function updateAsset(id: string, updates: Partial<StoredAsset>): Promise<void> {
  const db = await getDB();
  const existing = await db.get('assets', id);
  if (existing) {
    const updated = { ...existing, ...updates };
    await db.put('assets', updated);
    notifyAssetUpdated(updated);
  }
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
  notifyAssetUpdated();
}

export async function deleteMultipleAssets(ids: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('assets', 'readwrite');
  for (const id of ids) {
    await tx.store.delete(id);
  }
  await tx.done;
  notifyAssetUpdated();
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
