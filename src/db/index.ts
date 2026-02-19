import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction } from 'idb';
import type { DiaryEntry, Fragment, AiCache, AiLog, Observation } from '../types';

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
  observations: {
    key: string;
    value: Observation;
    indexes: {
      'by-date': string;
      'by-created': string;
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

const DB_VERSION = 4;

type UpgradeTx = IDBPTransaction<ClimbingLogDB, ('entries' | 'fragments' | 'aiCache' | 'aiLogs' | 'observations')[], 'versionchange'>;

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

  // v3 → v4: 観測所（Observations）ストアを追加
  if (oldVersion < 4) {
    const obsStore = db.createObjectStore('observations', { keyPath: 'id' });
    obsStore.createIndex('by-date', 'date');
    obsStore.createIndex('by-created', 'createdAt');
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

// コンテンツの簡易ハッシュ（重複検出用）
async function contentHash(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// 重複検出キーを生成: sourceFile + date + content hash
async function deduplicationKey(entry: DiaryEntry): Promise<string> {
  const hash = await contentHash(entry.content);
  return `${entry.sourceFile ?? ''}|${entry.date ?? ''}|${hash}`;
}

/**
 * エントリを追加する。重複チェックを行い、同一 sourceFile+date+contentHash のエントリはスキップする。
 * @returns 実際に追加された件数
 */
export async function addEntries(entries: DiaryEntry[]): Promise<number> {
  const db = await getDB();

  // 既存エントリの重複キーセットを構築
  const existing = await db.getAll('entries');
  const existingKeys = new Set<string>();
  for (const e of existing) {
    existingKeys.add(await deduplicationKey(e));
  }

  // 新規エントリから重複を除外
  const toAdd: DiaryEntry[] = [];
  for (const entry of entries) {
    const key = await deduplicationKey(entry);
    if (!existingKeys.has(key)) {
      toAdd.push(entry);
      existingKeys.add(key); // バッチ内重複も防止
    }
  }

  if (toAdd.length > 0) {
    const tx = db.transaction('entries', 'readwrite');
    for (const entry of toAdd) {
      await tx.store.put(entry);
    }
    await tx.done;
  }

  return toAdd.length;
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
  observations: Observation[];
}> {
  const db = await getDB();
  const entries = await db.getAll('entries');
  const fragments = await db.getAll('fragments');
  const observations = await db.getAll('observations');
  return { entries, fragments, observations };
}

export async function importAllData(data: {
  entries: DiaryEntry[];
  fragments: Fragment[];
  observations?: Observation[];
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
  if (data.observations && data.observations.length > 0) {
    const tx3 = db.transaction('observations', 'readwrite');
    for (const obs of data.observations) {
      await tx3.store.put(obs);
    }
    await tx3.done;
  }
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

// --- 観測所（Observations）操作 ---

export async function addObservation(observation: Observation): Promise<void> {
  const db = await getDB();
  await db.put('observations', observation);
}

export async function getAllObservations(): Promise<Observation[]> {
  const db = await getDB();
  return db.getAllFromIndex('observations', 'by-date');
}

export async function getObservationsByDate(date: string): Promise<Observation[]> {
  const db = await getDB();
  return db.getAllFromIndex('observations', 'by-date', date);
}

export async function getObservationCount(): Promise<number> {
  const db = await getDB();
  return db.count('observations');
}

export async function deleteObservation(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('observations', id);
}
