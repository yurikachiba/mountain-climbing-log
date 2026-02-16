import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { DiaryEntry, Fragment } from '../types';

interface ClimbingLogDB extends DBSchema {
  entries: {
    key: string;
    value: DiaryEntry;
    indexes: {
      'by-date': string;
      'by-imported': string;
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
}

let dbInstance: IDBPDatabase<ClimbingLogDB> | null = null;

async function getDB(): Promise<IDBPDatabase<ClimbingLogDB>> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB<ClimbingLogDB>('climbing-log', 1, {
    upgrade(db) {
      const entryStore = db.createObjectStore('entries', { keyPath: 'id' });
      entryStore.createIndex('by-date', 'date');
      entryStore.createIndex('by-imported', 'importedAt');

      const fragStore = db.createObjectStore('fragments', { keyPath: 'id' });
      fragStore.createIndex('by-entry', 'entryId');
      fragStore.createIndex('by-saved', 'savedAt');
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
