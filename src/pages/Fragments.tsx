import { useState, useEffect, useRef, useCallback } from 'react';
import type { DiaryEntry, Fragment } from '../types';
import { getAllFragments, addFragments, getFragmentEntryIds, getAllEntries, getEntryCount } from '../db';
import { extractFragments, ApiOverloadError } from '../utils/claude';
import { hasApiKey } from '../utils/apiKey';
import { useHead } from '../hooks/useHead';

const BATCH_SIZE = 5;

export function Fragments() {
  useHead({
    title: '宝物庫',
    description: '日記の中で光っている一文をAIが自動で見つけて集めるページ。過去の日記から印象的な一文だけを抜き出し、いつでも読み返せます。',
    keywords: 'お気に入り日記,日記断片,名文保存,宝物庫,AI抽出',
    path: '/fragments',
  });

  const [fragments, setFragments] = useState<Fragment[]>([]);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const cancelRef = useRef(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  async function acquireWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch {
      // Wake Lock API 非対応 or 権限拒否 — 無視して続行
    }
  }

  function releaseWakeLock() {
    wakeLockRef.current?.release();
    wakeLockRef.current = null;
  }

  const load = useCallback(async () => {
    setLoading(true);
    const all = await getAllFragments();
    // スキップマーカー（source: 'auto-skip'）を除外して表示用のみ取得
    const visible = all.filter(f => f.source !== 'auto-skip');
    // 日記の日付順（新しい順）でソート、日付不明は末尾
    setFragments(visible.sort((a, b) => {
      const da = a.entryDate ?? '';
      const db = b.entryDate ?? '';
      if (da && db) return db.localeCompare(da);
      if (da) return -1;
      if (db) return 1;
      return b.savedAt.localeCompare(a.savedAt);
    }));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // タブが再びアクティブになったら Wake Lock を再取得
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible' && collecting) {
        acquireWakeLock();
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [collecting]);

  async function handleCollectAll() {
    if (collecting) return;
    setError(null);
    setCollecting(true);
    cancelRef.current = false;
    await acquireWakeLock();

    try {
      const [allEntries, existingIds, totalCount] = await Promise.all([
        getAllEntries(),
        getFragmentEntryIds(),
        getEntryCount(),
      ]);

      // 取得件数と db.count() の照合 — 不一致があればユーザーに警告
      if (allEntries.length < totalCount) {
        console.warn(
          `[Fragments] エントリ取得数の不一致: 取得=${allEntries.length}, DB件数=${totalCount}`,
        );
        setError(
          `⚠ 日記の取得が不完全です（${allEntries.length} / ${totalCount}件）。ブラウザを再起動してから再度お試しください。`,
        );
        setCollecting(false);
        return;
      }

      const notProcessed = allEntries.filter(e => !existingIds.has(e.id));
      const unprocessed = notProcessed
        .filter(e => e.content.trim().length > 30)
        .reverse(); // 新しい日記から優先的に処理する（getAllEntries は日付昇順のため reverse）

      const skippedShort = notProcessed.length - unprocessed.length;
      const alreadyProcessed = totalCount - notProcessed.length;

      if (unprocessed.length === 0) {
        const details: string[] = [];
        if (alreadyProcessed > 0) details.push(`収集済み ${alreadyProcessed}件`);
        if (skippedShort > 0) details.push(`短文除外 ${skippedShort}件`);
        setError(`すべての日記から収集済みです（全${totalCount}件${details.length > 0 ? '、' + details.join('、') : ''}）`);
        setCollecting(false);
        return;
      }

      setProgress({ done: 0, total: unprocessed.length });

      const BATCH_RETRY_FALLBACKS = [15_000, 30_000, 60_000]; // Retry-After がないときのフォールバック
      let skippedCount = 0;

      for (let i = 0; i < unprocessed.length; i += BATCH_SIZE) {
        if (cancelRef.current) break;
        const batch = unprocessed.slice(i, i + BATCH_SIZE);

        let succeeded = false;
        for (let retry = 0; retry <= BATCH_RETRY_FALLBACKS.length; retry++) {
          try {
            await processBatch(batch);
            succeeded = true;
            break;
          } catch (e) {
            if (!(e instanceof ApiOverloadError)) throw e; // 429/529以外はそのまま上に投げる
            if (retry < BATCH_RETRY_FALLBACKS.length && !cancelRef.current) {
              // APIの Retry-After があればそれを優先、なければフォールバック値
              const waitMs = e.retryAfterMs > 0
                ? Math.min(Math.max(e.retryAfterMs, 5_000), 120_000)
                : BATCH_RETRY_FALLBACKS[retry];
              const waitSec = Math.ceil(waitMs / 1000);
              setError(`APIが混雑中… ${waitSec}秒待ってリトライします`);
              await new Promise(r => setTimeout(r, waitMs));
              setError(null);
            }
          }
        }
        if (!succeeded) {
          skippedCount += batch.length;
        }

        setProgress({ done: Math.min(i + BATCH_SIZE, unprocessed.length), total: unprocessed.length });
      }

      await load();

      if (skippedCount > 0) {
        setError(`APIの混雑により${skippedCount}件の日記をスキップしました。時間を置いて再度お試しください。`);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      releaseWakeLock();
      setCollecting(false);
    }
  }

  async function processBatch(entries: DiaryEntry[]) {
    const results = await extractFragments(entries);
    const foundEntryIds = new Set(results.map(r => r.entryId));
    const now = new Date().toISOString();

    // 抽出結果とスキップマーカーをまとめて1トランザクションで書き込む
    const toSave: Fragment[] = results.map(r => ({
      id: crypto.randomUUID(),
      entryId: r.entryId,
      text: r.text,
      savedAt: now,
      source: 'auto',
      entryDate: r.entryDate,
    }));
    for (const entry of entries) {
      if (!foundEntryIds.has(entry.id)) {
        toSave.push({
          id: crypto.randomUUID(),
          entryId: entry.id,
          text: '',
          savedAt: now,
          source: 'auto-skip',
          entryDate: entry.date,
        });
      }
    }
    await addFragments(toSave);
  }

  function handleCancel() {
    cancelRef.current = true;
  }

  async function handleCopy(id: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(prev => prev === id ? null : prev), 1500);
  }

  async function handleCopyAll() {
    if (fragments.length === 0) return;
    const text = fragments.map(f => {
      const date = f.entryDate ? f.entryDate.replace(/-/g, '.') : '日付不明';
      return `${f.text}\n${date}`;
    }).join('\n\n');
    await navigator.clipboard.writeText(text);
    setCopiedId('__all__');
    setTimeout(() => setCopiedId(prev => prev === '__all__' ? null : prev), 1500);
  }

  if (loading) return <div className="page"><p className="loading-text">読み込み中...</p></div>;

  const hasKey = hasApiKey();

  return (
    <div className="page">
      <h1 className="page-title">宝物庫</h1>
      <p className="subtitle">日記の中の、光っている一文</p>

      {/* 収集コントロール */}
      <div className="treasure-controls">
        {!hasKey ? (
          <p className="treasure-hint">
            設定ページでAPIキーを登録すると、日記から自動で光る一文を集められます。
          </p>
        ) : collecting ? (
          <div className="treasure-progress">
            <div className="treasure-progress-bar-bg">
              <div
                className="treasure-progress-bar"
                style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="treasure-progress-text">
              {progress.done} / {progress.total} 件の日記から光を集めています...
            </p>
            <p className="treasure-progress-hint">
              画面を表示したままにしてください
            </p>
            <button onClick={handleCancel} className="btn btn-small">中断する</button>
          </div>
        ) : (
          <button onClick={handleCollectAll} className="btn btn-primary">
            すべての日記から光を集める
          </button>
        )}
        {error && <p className="treasure-error">{error}</p>}
      </div>

      {/* フラグメント一覧 */}
      {fragments.length === 0 ? (
        <div className="treasure-empty">
          <p className="treasure-empty-text">まだ何も集まっていません</p>
          <p className="treasure-empty-hint">
            ボタンを押すと、日記の中から光っている一文をAIが見つけてきます。
          </p>
        </div>
      ) : (
        <>
          <div className="treasure-bulk-actions">
            <button onClick={handleCopyAll} className="btn btn-small">
              {copiedId === '__all__' ? 'コピーしました！' : 'すべてコピー'}
            </button>
            <span className="treasure-count">{fragments.length}件</span>
          </div>
          <div className="treasure-list">
            {fragments.map(f => (
              <div key={f.id} className="treasure-card">
                <blockquote className="treasure-text">{f.text}</blockquote>
                <div className="treasure-meta">
                  <span className="treasure-date">
                    {f.entryDate
                      ? f.entryDate.replace(/-/g, '.')
                      : '日付不明'}
                  </span>
                  <button
                    onClick={() => handleCopy(f.id, f.text)}
                    className="treasure-copy"
                    aria-label="コピー"
                  >
                    {copiedId === f.id ? '!' : '\u2398'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
