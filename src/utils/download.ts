/** Blob をファイルとしてダウンロードさせる */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** JSON データをファイルとしてダウンロード */
export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, filename);
}

/** テキストをファイルとしてダウンロード */
export function downloadText(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, filename);
}
