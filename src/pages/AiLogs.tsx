import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { AiLog } from '../types';
import { getAllAiLogs } from '../db';
import { useHead } from '../hooks/useHead';

type AnalysisType =
  | 'summary' | 'tags' | 'tone'
  | 'turningPoints' | 'themes' | 'questions'
  | 'seasonal' | 'growth' | 'report'
  | 'elevation' | 'strengths' | 'counterfactual';

const typeLabels: Record<AnalysisType, string> = {
  summary: '年代別要約',
  tags: '頻出感情タグ',
  tone: '文章トーン分析',
  turningPoints: '転機検出',
  themes: '繰り返すテーマ',
  questions: '自分への問い',
  seasonal: '季節×感情マップ',
  growth: '成長の軌跡',
  report: '包括レポート',
  elevation: '標高ナラティブ',
  strengths: '強みの宣言',
  counterfactual: '反事実的因果',
};

const allTypes: AnalysisType[] = [
  'summary', 'tags', 'tone',
  'turningPoints', 'themes', 'questions',
  'seasonal', 'growth', 'report',
  'elevation', 'strengths', 'counterfactual',
];

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
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AnalysisType | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

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

  useEffect(() => {
    (async () => {
      const all = await getAllAiLogs();
      // 新しい順に並べる
      all.reverse();
      // 各タイプごとに最新の1件だけを保持
      const latestByType = new Map<string, AiLog>();
      for (const log of all) {
        if (!latestByType.has(log.type)) {
          latestByType.set(log.type, log);
        }
      }
      setLogs(Array.from(latestByType.values()));
      setLoading(false);
    })();
  }, []);

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
                      {log.result.split('\n').map((line, i) => (
                        <p key={i}>{line || '\u00A0'}</p>
                      ))}
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
