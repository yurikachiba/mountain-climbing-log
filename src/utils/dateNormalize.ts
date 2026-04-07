/**
 * 日付文字列の正規化ユーティリティ
 *
 * entry.date はインポート元によって YYYY-MM-DD / YYYY.MM.DD / YYYY/MM/DD /
 * YYYY-MM-DDThh:mm:ssZ など複数フォーマットが混在し得る。
 * substring で切り出す前に必ずここを通すことで、常に YYYY-MM-DD を得る。
 */

/** 日付文字列を YYYY-MM-DD に正規化する */
export function toDateOnly(dateStr: string): string {
  const d = dateStr.length > 10 ? dateStr.substring(0, 10) : dateStr;
  return d.replace(/[/.]/g, '-');
}

/** 正規化した YYYY-MM 部分を返す */
export function toMonthKey(dateStr: string): string {
  return toDateOnly(dateStr).substring(0, 7);
}

/** 正規化した YYYY 部分を返す */
export function toYearKey(dateStr: string): string {
  return toDateOnly(dateStr).substring(0, 4);
}

/** 日付ソート比較関数（フォーマット混在でも安全） */
export function compareDateOnly(a: string, b: string): number {
  const ad = toDateOnly(a);
  const bd = toDateOnly(b);
  return ad < bd ? -1 : ad > bd ? 1 : 0;
}
