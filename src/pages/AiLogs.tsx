import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { AiLog } from '../types';
import { getAllAiLogs } from '../db';

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
  const [logs, setLogs] = useState<AiLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AnalysisType | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const all = await getAllAiLogs();
      // 新しい順に並べる
      all.reverse();
      setLogs(all);
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

  // タイプ別の件数を集計
  const typeCounts: Record<string, number> = {};
  for (const log of logs) {
    typeCounts[log.type] = (typeCounts[log.type] || 0) + 1;
  }

  return (
    <div className="page">
      <h1 className="page-title">AI分析ログ</h1>
      <p className="subtitle">過去の分析結果をすべて閲覧できます</p>

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
                .filter(t => typeCounts[t])
                .map(t => (
                  <option key={t} value={t}>
                    {typeLabels[t]} ({typeCounts[t]})
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
