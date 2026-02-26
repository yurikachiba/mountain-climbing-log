import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { AiLog, AiCache } from '../types';
import { getAllAiLogs, getAllAiCache } from '../db';
import { useHead } from '../hooks/useHead';
import { AiResultBody } from '../components/AiResultBody';

// 現行のAnalysis.tsxと一致させる（4種類）
type AnalysisType = 'todaysEntry' | 'vitalPoint' | 'externalStandardsMastery' | 'todaysLandscape';

const typeLabels: Record<AnalysisType, string> = {
  todaysEntry: '今日',
  vitalPoint: '急所',
  externalStandardsMastery: '外基準の統合',
  todaysLandscape: '今日の景色',
};

const allTypes: AnalysisType[] = [
  'todaysEntry', 'todaysLandscape', 'vitalPoint', 'externalStandardsMastery',
];

// 現行タイプのセット（フィルタリング用）
const currentTypeSet = new Set<string>(allTypes);

function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${day} ${h}:${min}`;
}

export function AiLogs() {
  useHead({
    title: 'AI分析ログ ― 分析履歴',
    description: '過去のAI分析結果を一覧・閲覧・コピーできるログページ。分析タイプ別のフィルタリング、一括コピー機能搭載。分析の履歴を蓄積して変化を比較追跡。',
    keywords: 'AI分析ログ,分析履歴,日記分析結果,分析比較',
    path: '/ai-logs',
  });

  const [logs, setLogs] = useState<AiLog[]>([]);
  const [latestCaches, setLatestCaches] = useState<AiCache[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AnalysisType | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const location = useLocation();

  const handleItemCopy = async (log: AiLog) => {
    const label = typeLabels[log.type as AnalysisType] || log.type;
    const date = formatDate(log.analyzedAt);
    const text = `【${label}】${date}（${log.entryCount}件の日記）\n${log.result}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage('コピーしました');
      setTimeout(() => setCopyMessage(null), 2500);
    } catch {
      setCopyMessage('コピーに失敗しました');
      setTimeout(() => setCopyMessage(null), 2500);
    }
  };

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const [all, allCaches] = await Promise.all([getAllAiLogs(), getAllAiCache()]);
    // 新しい順に並べる
    all.reverse();
    // 現行タイプのみ、各タイプごとに最新の1件だけを保持
    const latestByType = new Map<string, AiLog>();
    for (const log of all) {
      if (!currentTypeSet.has(log.type)) continue;
      if (!latestByType.has(log.type)) {
        latestByType.set(log.type, log);
      }
    }
    setLogs(Array.from(latestByType.values()));
    setLatestCaches(allCaches.filter(c => currentTypeSet.has(c.type) && c.result));
    setLoading(false);
  }, []);

  // ページ遷移のたびに最新データを取得する
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs, location.key]);

  if (loading) {
    return (
      <div className="page">
        <p className="loading-text">読み込み中...</p>
      </div>
    );
  }

  const filtered = filter === 'all'
    ? logs
    : logs.filter(l => l.type === filter);

  const handleBulkCopy = async () => {
    if (filtered.length === 0) return;
    const text = filtered.map(log => {
      const label = typeLabels[log.type as AnalysisType] || log.type;
      const date = formatDate(log.analyzedAt);
      return `【${label}】${date}（${log.entryCount}件の日記）\n${log.result}`;
    }).join('\n\n---\n\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage(`${filtered.length}件のログをコピーしました`);
      setTimeout(() => setCopyMessage(null), 2500);
    } catch {
      setCopyMessage('コピーに失敗しました');
      setTimeout(() => setCopyMessage(null), 2500);
    }
  };

  const handleCopyLatestResults = async () => {
    if (latestCaches.length === 0) return;
    const parts = latestCaches.map(c => {
      const label = typeLabels[c.type as AnalysisType] || c.type;
      const date = formatDate(c.analyzedAt);
      return `【${label}】${date}（${c.entryCount}件の日記）\n${c.result}`;
    });
    try {
      await navigator.clipboard.writeText(parts.join('\n\n---\n\n'));
      setCopyMessage(`${parts.length}件の最新結果をコピーしました`);
      setTimeout(() => setCopyMessage(null), 2500);
    } catch {
      setCopyMessage('コピーに失敗しました');
      setTimeout(() => setCopyMessage(null), 2500);
    }
  };

  const latestResultCount = latestCaches.length;

  // 存在するタイプを収集
  const existingTypes = new Set(logs.map(l => l.type));

  return (
    <div className="page">
      <h1 className="page-title">AI分析ログ</h1>
      <p className="subtitle">各分析タイプの最新結果を表示しています</p>

      {logs.length === 0 ? (
        <div className="ailogs-empty">
          <p className="empty-message">まだ分析ログがありません</p>
          <p className="hint">
            <Link to="/analysis">AI分析</Link>ページで分析を実行すると、結果がここに蓄積されます。
          </p>
        </div>
      ) : (
        <>
          <div className="ailogs-filter">
            <select
              className="custom-select"
              value={filter}
              onChange={e => setFilter(e.target.value as AnalysisType | 'all')}
            >
              <option value="all">すべて ({logs.length})</option>
              {allTypes
                .filter(t => existingTypes.has(t))
                .map(t => (
                  <option key={t} value={t}>
                    {typeLabels[t]}
                  </option>
                ))}
            </select>
            <span className="ailogs-count">
              {filtered.length}件表示
            </span>
            <button
              className="btn btn-small"
              onClick={handleBulkCopy}
              disabled={filtered.length === 0}
            >
              一括コピー
            </button>
            <button
              className="btn btn-small"
              onClick={handleCopyLatestResults}
              disabled={latestResultCount === 0}
            >
              最新結果を一括コピー
            </button>
          </div>

          <div className="ailogs-list">
            {filtered.map(log => {
              const isExpanded = expandedId === log.id;
              return (
                <section key={log.id} className="ailogs-item">
                  <button
                    className="ailogs-item-header"
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  >
                    <div className="ailogs-item-info">
                      <span className="ailogs-type-badge">
                        {typeLabels[log.type as AnalysisType] || log.type}
                      </span>
                      <span className="ailogs-date">
                        {formatDate(log.analyzedAt)}
                      </span>
                    </div>
                    <div className="ailogs-item-meta">
                      <span className="ailogs-entry-count">
                        {log.entryCount}件の日記
                      </span>
                      <span className="ailogs-expand-icon">
                        {isExpanded ? '−' : '+'}
                      </span>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="ailogs-item-body">
                      <div className="ailogs-body-meta">
                        <span className="ailogs-body-date">
                          分析日時: {formatDate(log.analyzedAt)}
                        </span>
                        <span className="ailogs-body-count">
                          エントリ数: {log.entryCount}
                        </span>
                        <button
                          className="btn btn-small"
                          onClick={(e) => { e.stopPropagation(); handleItemCopy(log); }}
                        >
                          コピー
                        </button>
                      </div>
                      <AiResultBody text={log.result} />
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}

      <p className="hint" style={{ marginTop: 48 }}>
        分析ログは端末のブラウザに保存されています。データを消去しない限り消えません。
      </p>

      {copyMessage && (
        <div className="toast" onClick={() => setCopyMessage(null)}>
          {copyMessage}
        </div>
      )}
    </div>
  );
}
