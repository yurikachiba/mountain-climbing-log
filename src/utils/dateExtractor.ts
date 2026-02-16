// 日付自動抽出ユーティリティ
// 日本語・英語の日付パターンに対応

const patterns: { regex: RegExp; extract: (m: RegExpMatchArray) => string | null }[] = [
  // 2024-01-15, 2024/01/15
  {
    regex: /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/,
    extract: (m) => toISO(m[1], m[2], m[3]),
  },
  // 2024年1月15日
  {
    regex: /(\d{4})年(\d{1,2})月(\d{1,2})日/,
    extract: (m) => toISO(m[1], m[2], m[3]),
  },
  // 令和6年1月15日 (令和元年=2019)
  {
    regex: /令和(\d{1,2})年(\d{1,2})月(\d{1,2})日/,
    extract: (m) => toISO(String(2018 + Number(m[1])), m[2], m[3]),
  },
  // 平成31年1月15日 (平成元年=1989)
  {
    regex: /平成(\d{1,2})年(\d{1,2})月(\d{1,2})日/,
    extract: (m) => toISO(String(1988 + Number(m[1])), m[2], m[3]),
  },
  // January 15, 2024 / Jan 15, 2024
  {
    regex: /(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})/i,
    extract: (m) => {
      const monthStr = m[0].match(/[A-Za-z]+/)?.[0];
      if (!monthStr) return null;
      const month = monthToNum(monthStr);
      if (!month) return null;
      return toISO(m[2], String(month), m[1]);
    },
  },
  // 15 January 2024
  {
    regex: /(\d{1,2})\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i,
    extract: (m) => {
      const monthStr = m[0].match(/[A-Za-z]+/)?.[0];
      if (!monthStr) return null;
      const month = monthToNum(monthStr);
      if (!month) return null;
      return toISO(m[2], String(month), m[1]);
    },
  },
];

function toISO(y: string, m: string, d: string): string | null {
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (year < 1900 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function monthToNum(s: string): number | null {
  const map: Record<string, number> = {
    january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3,
    april: 4, apr: 4, may: 5, june: 6, jun: 6, july: 7, jul: 7,
    august: 8, aug: 8, september: 9, sep: 9, october: 10, oct: 10,
    november: 11, nov: 11, december: 12, dec: 12,
  };
  return map[s.toLowerCase()] ?? null;
}

export function extractDate(text: string): string | null {
  // 最初の数行から日付を探す
  const lines = text.split('\n').slice(0, 5);
  const searchText = lines.join(' ');

  for (const pattern of patterns) {
    const match = searchText.match(pattern.regex);
    if (match) {
      const result = pattern.extract(match);
      if (result) return result;
    }
  }
  return null;
}

export function extractDateFromFilename(filename: string): string | null {
  // ファイル名から日付抽出 e.g. 2024-01-15.txt, diary_20240115.md
  const m1 = filename.match(/(\d{4})[-_]?(\d{2})[-_]?(\d{2})/);
  if (m1) return toISO(m1[1], m1[2], m1[3]);
  return null;
}
