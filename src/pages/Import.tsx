import { useRef, useState } from 'react';
import { importFile } from '../utils/importer';
import { addEntries } from '../db';

export function Import() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<{ count: number; files: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const allEntries = [];
      const fileNames: string[] = [];

      for (const file of Array.from(files)) {
        const text = await file.text();
        const entries = importFile(text, file.name);
        allEntries.push(...entries);
        fileNames.push(file.name);
      }

      await addEntries(allEntries);
      setResult({ count: allEntries.length, files: fileNames });
    } catch (err) {
      setError(err instanceof Error ? err.message : '読み込みに失敗しました');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">インポート</h1>
      <p className="hint">txt / md / json ファイルを選択</p>

      <div className="import-area">
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.md,.json"
          multiple
          onChange={handleFiles}
          className="file-input"
          id="file-input"
        />
        <label htmlFor="file-input" className="file-label">
          ファイルを選択
        </label>
      </div>

      {importing && <p className="loading-text">インポート中...</p>}

      {error && <p className="error-text">{error}</p>}

      {result && (
        <div className="result-card">
          <p>{result.count} 件のエントリをインポートしました</p>
          <ul className="file-list">
            {result.files.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="format-help">
        <h2>対応フォーマット</h2>
        <div className="format-example">
          <h3>テキスト / Markdown</h3>
          <pre>{`2024年3月15日
今日は外に出た。
久しぶりの太陽だった。

2024年3月20日
少しだけ話せた。`}</pre>
        </div>
        <div className="format-example">
          <h3>JSON</h3>
          <pre>{`[
  { "date": "2024-03-15", "content": "今日は外に出た。" },
  { "date": "2024-03-20", "content": "少しだけ話せた。" }
]`}</pre>
        </div>
      </div>
    </div>
  );
}
