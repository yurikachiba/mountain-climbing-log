import type { DiaryEntry } from '../types';
import { extractDate, extractDateFromFilename, DATE_LINE_REGEX } from './dateExtractor';

/** 日付文字列を YYYY-MM-DD に正規化（タイムスタンプ混入・セパレータ混在でも安全） */
function toDateOnly(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  // YYYY-MM-DD (10文字) より長ければタイムスタンプ → 切り詰め
  const d = dateStr.length > 10 ? dateStr.substring(0, 10) : dateStr;
  // セパレータを正規化（. や / を - に統一）
  const normalized = d.replace(/[/.]/g, '-');
  // YYYY-MM-DD 形式かどうか簡易チェック（正規化できなければ null で extractDate にフォールバック）
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function generateId(): string {
  return crypto.randomUUID();
}

// テキスト内の区切り（日付行など）でエントリを分割
function splitByDates(text: string): { date: string | null; content: string }[] {
  const dateLineRegex = DATE_LINE_REGEX;
  const lines = text.split('\n');
  const entries: { date: string | null; content: string }[] = [];
  let current: string[] = [];
  let currentDate: string | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();
    // 日付行は短い（日付 + 曜日等で40文字以内）。長い行は本文中の日付参照
    if (trimmedLine.length <= 40 && dateLineRegex.test(trimmedLine)) {
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
    return data
      .filter((item: Record<string, unknown>) => {
        // content / text / body のいずれかが文字列として存在するエントリのみ取り込む
        // JSON.stringify フォールバックで非日記データが混入するのを防止
        const raw = item.content ?? item.text ?? item.body;
        return raw != null && String(raw).trim().length > 0;
      })
      .map((item: Record<string, unknown>) => ({
        id: generateId(),
        date: toDateOnly(item.date as string) ?? extractDate(String(item.content ?? '')) ?? null,
        content: String(item.content ?? item.text ?? item.body),
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
    // content / text / body がないオブジェクトは日記データではないのでスキップ
    const raw = data.content ?? data.text ?? data.body;
    if (raw == null || String(raw).trim().length === 0) {
      return [];
    }
    return [{
      id: generateId(),
      date: toDateOnly(data.date) ?? extractDate(String(data.content ?? '')) ?? null,
      content: String(raw),
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
