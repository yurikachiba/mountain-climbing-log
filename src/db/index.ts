import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction } from 'idb';
import type { DiaryEntry, Fragment, AiCache, AiLog } from '../types';

// --- スキーマ定義 ---
// 最新のスキーマを反映する。マイグレーションで段階的にここへ到達する。

interface ClimbingLogDB extends DBSchema {
  entries: {
    key: string;
    value: DiaryEntry;
    indexes: {
      'by-date': string;
      'by-imported': string;
      'by-favorite': number;
    };
  };
  fragments: {
    key: string;
    value: Fragment;
    indexes: {
      'by-entry': string;
      'by-saved': string;
    };
  };
  aiCache: {
    key: string; // AnalysisType
    value: AiCache;
  };
  aiLogs: {
    key: string; // UUID
    value: AiLog;
    indexes: {
      'by-type': string;
      'by-analyzed': string;
    };
  };
}

// --- マイグレーション ---
//
// 新しいバージョンを追加する手順:
//   1. DB_VERSION を +1
//   2. runMigrations() 内に if (oldVersion < N) ブロックを追加
//
// upgrade() は oldVersion → newVersion まで一度に実行される。
// 例: v1のユーザーがv3のアプリを開くと oldVersion=1 で呼ばれ、
//     v2とv3のブロックが順番に両方実行される。

const DB_VERSION = 3;

type UpgradeTx = IDBPTransaction<ClimbingLogDB, ('entries' | 'fragments' | 'aiCache' | 'aiLogs')[], 'versionchange'>;

function runMigrations(
  db: IDBPDatabase<ClimbingLogDB>,
  oldVersion: number,
  tx: UpgradeTx,
): void {
  // v0 → v1: 初期スキーマ作成
  if (oldVersion < 1) {
    const entryStore = db.createObjectStore('entries', { keyPath: 'id' });
    entryStore.createIndex('by-date', 'date');
    entryStore.createIndex('by-imported', 'importedAt');

    const fragStore = db.createObjectStore('fragments', { keyPath: 'id' });
    fragStore.createIndex('by-entry', 'entryId');
    fragStore.createIndex('by-saved', 'savedAt');
  }

  // v1 → v2: entries に by-favorite インデックスを追加
  if (oldVersion < 2) {
    const entryStore = tx.objectStore('entries');
    entryStore.createIndex('by-favorite', 'isFavorite');
  }

  // v2 → v3: AIキャッシュとAIログのストアを追加
  if (oldVersion < 3) {
    db.createObjectStore('aiCache', { keyPath: 'type' });

    const logStore = db.createObjectStore('aiLogs', { keyPath: 'id' });
    logStore.createIndex('by-type', 'type');
    logStore.createIndex('by-analyzed', 'analyzedAt');
  }

  // --- 次のマイグレーションはここに追加 ---
}

// --- DB接続 ---

let dbInstance: IDBPDatabase<ClimbingLogDB> | null = null;

async function getDB(): Promise<IDBPDatabase<ClimbingLogDB>> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB<ClimbingLogDB>('climbing-log', DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, tx) {
      runMigrations(db, oldVersion, tx);
    },
  });
  return dbInstance;
}

export async function addEntries(entries: DiaryEntry[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('entries', 'readwrite');
  for (const entry of entries) {
    await tx.store.put(entry);
  }
  await tx.done;
}

export async function getAllEntries(): Promise<DiaryEntry[]> {
  const db = await getDB();
  return db.getAllFromIndex('entries', 'by-date');
}

export async function getEntry(id: string): Promise<DiaryEntry | undefined> {
  const db = await getDB();
  return db.get('entries', id);
}

export async function updateEntry(entry: DiaryEntry): Promise<void> {
  const db = await getDB();
  await db.put('entries', entry);
}

export async function deleteAllEntries(): Promise<void> {
  const db = await getDB();
  await db.clear('entries');
  await db.clear('fragments');
}

export async function getRandomEntry(): Promise<DiaryEntry | undefined> {
  const db = await getDB();
  const all = await db.getAll('entries');
  if (all.length === 0) return undefined;
  return all[Math.floor(Math.random() * all.length)];
}

export async function addFragment(fragment: Fragment): Promise<void> {
  const db = await getDB();
  await db.put('fragments', fragment);
}

export async function getAllFragments(): Promise<Fragment[]> {
  const db = await getDB();
  return db.getAllFromIndex('fragments', 'by-saved');
}

export async function deleteFragment(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('fragments', id);
}

export async function getEntryCount(): Promise<number> {
  const db = await getDB();
  return db.count('entries');
}

export async function exportAllData(): Promise<{
  entries: DiaryEntry[];
  fragments: Fragment[];
}> {
  const db = await getDB();
  const entries = await db.getAll('entries');
  const fragments = await db.getAll('fragments');
  return { entries, fragments };
}

export async function importAllData(data: {
  entries: DiaryEntry[];
  fragments: Fragment[];
}): Promise<void> {
  const db = await getDB();
  const tx1 = db.transaction('entries', 'readwrite');
  for (const entry of data.entries) {
    await tx1.store.put(entry);
  }
  await tx1.done;
  const tx2 = db.transaction('fragments', 'readwrite');
  for (const frag of data.fragments) {
    await tx2.store.put(frag);
  }
  await tx2.done;
}

// --- AIキャッシュ操作 ---

export async function getAiCache(type: string): Promise<AiCache | undefined> {
  const db = await getDB();
  return db.get('aiCache', type);
}

export async function getAllAiCache(): Promise<AiCache[]> {
  const db = await getDB();
  return db.getAll('aiCache');
}

export async function putAiCache(cache: AiCache): Promise<void> {
  const db = await getDB();
  await db.put('aiCache', cache);
}

export async function markAllAiCacheStale(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('aiCache', 'readwrite');
  let cursor = await tx.store.openCursor();
  while (cursor) {
    await cursor.update({ ...cursor.value, isStale: true });
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function clearAllAiCache(): Promise<void> {
  const db = await getDB();
  await db.clear('aiCache');
}

// --- AIログ操作 ---

export async function addAiLog(log: AiLog): Promise<void> {
  const db = await getDB();
  await db.put('aiLogs', log);
}

export async function getAllAiLogs(): Promise<AiLog[]> {
  const db = await getDB();
  return db.getAllFromIndex('aiLogs', 'by-analyzed');
}

export async function getAiLogsByType(type: string): Promise<AiLog[]> {
  const db = await getDB();
  return db.getAllFromIndex('aiLogs', 'by-type', type);
}
