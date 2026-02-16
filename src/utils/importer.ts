import type { DiaryEntry } from '../types';
import { extractDate, extractDateFromFilename } from './dateExtractor';

function generateId(): string {
  return crypto.randomUUID();
}

// テキスト内の区切り（日付行など）でエントリを分割
function splitByDates(text: string): { date: string | null; content: string }[] {
  const dateLineRegex = /^(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{4}年\d{1,2}月\d{1,2}日|令和\d{1,2}年\d{1,2}月\d{1,2}日|平成\d{1,2}年\d{1,2}月\d{1,2}日)/;
  const lines = text.split('\n');
  const entries: { date: string | null; content: string }[] = [];
  let current: string[] = [];
  let currentDate: string | null = null;

  for (const line of lines) {
    if (dateLineRegex.test(line.trim())) {
      if (current.length > 0 && current.some(l => l.trim())) {
        entries.push({ date: currentDate, content: current.join('\n').trim() });
      }
      currentDate = extractDate(line);
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0 && current.some(l => l.trim())) {
    entries.push({ date: currentDate, content: current.join('\n').trim() });
  }

  return entries;
}

export function parseTextFile(text: string, filename: string): DiaryEntry[] {
  const now = new Date().toISOString();
  const segments = splitByDates(text);

  // 日付区切りが1つしかなければ単一エントリ
  if (segments.length <= 1) {
    const date = extractDate(text) ?? extractDateFromFilename(filename);
    return [{
      id: generateId(),
      date,
      content: text.trim(),
      sourceFile: filename,
      importedAt: now,
      comments: [],
      isFavorite: false,
    }];
  }

  return segments.map(seg => ({
    id: generateId(),
    date: seg.date,
    content: seg.content,
    sourceFile: filename,
    importedAt: now,
    comments: [],
    isFavorite: false,
  }));
}

export function parseJsonFile(text: string, filename: string): DiaryEntry[] {
  const now = new Date().toISOString();
  const data = JSON.parse(text);

  // 配列の場合
  if (Array.isArray(data)) {
    return data.map((item: Record<string, unknown>) => ({
      id: generateId(),
      date: (item.date as string) ?? extractDate(String(item.content ?? '')) ?? null,
      content: String(item.content ?? item.text ?? item.body ?? JSON.stringify(item)),
      sourceFile: filename,
      importedAt: now,
      comments: [],
      isFavorite: false,
    }));
  }

  // 単一オブジェクト
  if (typeof data === 'object' && data !== null) {
    // entries キーがある場合
    if (Array.isArray(data.entries)) {
      return parseJsonFile(JSON.stringify(data.entries), filename);
    }
    return [{
      id: generateId(),
      date: data.date ?? extractDate(String(data.content ?? '')) ?? null,
      content: String(data.content ?? data.text ?? data.body ?? JSON.stringify(data)),
      sourceFile: filename,
      importedAt: now,
      comments: [],
      isFavorite: false,
    }];
  }

  return [];
}

export function importFile(text: string, filename: string): DiaryEntry[] {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'json') {
    return parseJsonFile(text, filename);
  }
  return parseTextFile(text, filename);
}
