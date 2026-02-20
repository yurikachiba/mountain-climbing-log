import { useState } from 'react';
import { useEntries } from '../hooks/useEntries';
import { useHead } from '../hooks/useHead';
import { useAiCache } from '../hooks/useAiCache';
import { hasApiKey } from '../utils/apiKey';
import {
  analyzeTone,
  detectTurningPoints,
  generateComprehensiveReport,
  analyzeElevationNarrative,
  analyzeCounterfactual,
  analyzeLifeStory,
  analyzeVitalPoint,
} from '../utils/openai';
import type { DiaryEntry } from '../types';
import { AiResultBody } from '../components/AiResultBody';

type AnalysisType =
  | 'tone' | 'turningPoints' | 'report'
  | 'elevation' | 'counterfactual'
  | 'lifeStory' | 'vitalPoint';

interface AnalysisItem {
  title: string;
  desc: string;
  fn: (entries: DiaryEntry[]) => Promise<string>;
}

interface AnalysisCategory {
  label: string;
  items: AnalysisType[];
}

const analysisMap: Record<AnalysisType, AnalysisItem> = {
  tone: {
    title: '語彙深度分析',
    desc: '語彙の深度・一人称変化・文体変化を定量的に解剖する',
    fn: analyzeTone,
  },
  turningPoints: {
    title: '転機検出',
    desc: 'トレンドシフトと実測データに基づく、構造的な変化の検出',
    fn: detectTurningPoints,
  },
  report: {
    title: '包括レポート',
    desc: '深層分析データを統合した、数値ベースの俯瞰レポート',
    fn: generateComprehensiveReport,
  },
  elevation: {
    title: '標高ナラティブ',
    desc: '各年を登山の旅として表現 — 登った年も、滑落した年も',
    fn: analyzeElevationNarrative,
  },
  counterfactual: {
    title: '反事実的因果',
    desc: '「もしあの日がなかったら？」— 転機の因果を逆算する',
    fn: analyzeCounterfactual,
  },
  lifeStory: {
    title: '人生の物語',
    desc: '全日記を一つの登山記として再構成 — 滑落も偽ピークも含む長編',
    fn: analyzeLifeStory,
  },
  vitalPoint: {
    title: '急所',
    desc: 'やさしいだけじゃない。痛いけど本質を突く、たった一つの指摘',
    fn: analyzeVitalPoint,
  },
};

// 各分析タイプのサンプリング上限（分析対象として使われる最大件数）
// 7種に絞った分、各分析のサンプル数を増やして深く分析
const sampleLimits: Record<AnalysisType, number> = {
  tone: 100,           // 前半50 + 後半50
  turningPoints: 120,  // データ駆動、多めにサンプル
  report: 80,          // 深層データ統合
  elevation: 100,      // 各年を厚めにカバー
  counterfactual: 100, // 転機検出に厚め
  lifeStory: 120,      // フラッグシップ、最大サンプル
  vitalPoint: 120,     // 繰り返しパターン検出に多めのデータ
};

const categories: AnalysisCategory[] = [
  {
    label: '構造分析',
    items: ['tone', 'turningPoints', 'report'],
  },
  {
    label: '物語分析',
    items: ['elevation', 'counterfactual', 'lifeStory'],
  },
  {
    label: '本質分析',
    items: ['vitalPoint'],
  },
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

export function Analysis() {
  useHead({
    title: 'AI分析（7種類）',
    description: '鋭い分析だけを残した7種類のAI分析。語彙深度分析、転機検出、包括レポート、標高ナラティブ、反事実的因果、人生の物語、急所。深層データ統合・定量根拠に基づく分析。',
    keywords: 'AI日記分析,語彙深度,転機検出,標高ナラティブ,反事実的因果,急所,人生の物語,深層分析',
    path: '/analysis',
  });

  const { entries, count, loading } = useEntries();
  const { cache, loading: cacheLoading, save } = useAiCache();
  const [running, setRunning] = useState<AnalysisType | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allProgress, setAllProgress] = useState<{ done: number; total: number } | null>(null);


  // キャッシュから結果を取得（表示用）
  function getResult(type: AnalysisType): string | undefined {
    return cache[type]?.result;
  }

  function isStale(type: AnalysisType): boolean {
    return cache[type]?.isStale ?? false;
  }

  async function run(type: AnalysisType) {
    if (!hasApiKey()) {
      setError('APIキーが設定されていません。設定ページで入力してください。');
      return;
    }
    setRunning(type);
    setError(null);
    try {
      const result = await analysisMap[type].fn(entries);
      await save(type, result, count);
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析に失敗しました');
    } finally {
      setRunning(null);
    }
  }

  async function runAll() {
    if (!hasApiKey()) {
      setError('APIキーが設定されていません。設定ページで入力してください。');
      return;
    }
    setRunningAll(true);
    setError(null);
    const types = categories.flatMap(c => c.items);
    setAllProgress({ done: 0, total: types.length });

    for (let i = 0; i < types.length; i++) {
      const type = types[i];
      setRunning(type);
      try {
        const result = await analysisMap[type].fn(entries);
        await save(type, result, count);
      } catch (err) {
        setError(err instanceof Error ? err.message : `${analysisMap[type].title}の分析に失敗しました`);
        break;
      }
      setAllProgress({ done: i + 1, total: types.length });
    }
    setRunning(null);
    setRunningAll(false);
    setAllProgress(null);
  }

  if (loading || cacheLoading) return <div className="page"><p className="loading-text">読み込み中...</p></div>;

  if (entries.length === 0) {
    return (
      <div className="page">
        <h1 className="page-title">AI分析</h1>
        <p className="empty-message">日記をインポートすると分析できます</p>
      </div>
    );
  }

  const isRunning = running !== null;
  const completedCount = Object.keys(cache).filter(k => cache[k]?.result).length;
  const staleCount = Object.values(cache).filter(c => c.isStale).length;

  return (
    <div className="page">
      <h1 className="page-title">AI分析</h1>
      <p className="subtitle">あなたの日記を、静かに見つめます。</p>

      {!hasApiKey() && (
        <p className="hint" style={{ color: 'var(--danger)' }}>
          設定ページでOpenAI APIキーを入力してください
        </p>
      )}

      {error && <p className="error-text">{error}</p>}

      <div className="analysis-toolbar">
        <button
          onClick={runAll}
          disabled={isRunning}
          className="btn btn-primary"
        >
          {runningAll ? '一括分析中...' : staleCount > 0 ? 'すべて再分析' : 'すべて実行'}
        </button>
        {completedCount > 0 && (
          <span className="analysis-completed-count">
            {completedCount}/{Object.keys(analysisMap).length} 完了
            {staleCount > 0 && ` (${staleCount}件 更新あり)`}
          </span>
        )}
        {allProgress && (
          <div className="analysis-progress">
            <div className="analysis-progress-bar">
              <div
                className="analysis-progress-fill"
                style={{ width: `${(allProgress.done / allProgress.total) * 100}%` }}
              />
            </div>
            <span className="analysis-progress-text">
              {allProgress.done}/{allProgress.total}
            </span>
          </div>
        )}
      </div>

      {categories.map(cat => (
        <div key={cat.label} className="analysis-category">
          <h2 className="analysis-category-title">{cat.label}</h2>
          <div className="analysis-list">
            {cat.items.map(type => {
              const result = getResult(type);
              const stale = isStale(type);
              const cachedAt = cache[type]?.analyzedAt;
              const cachedCount = cache[type]?.entryCount;
              return (
                <section key={type} className="analysis-section">
                  <div className="analysis-header">
                    <div>
                      <h3>{analysisMap[type].title}</h3>
                      <p className="settings-desc">{analysisMap[type].desc}</p>
                    </div>
                    <div className="analysis-header-actions">
                      {result && !stale && <span className="analysis-done-badge">完了</span>}
                      {result && stale && <span className="analysis-done-badge" style={{ background: 'var(--warning, #b8860b)', color: '#fff' }}>更新あり</span>}
                      <button
                        onClick={() => run(type)}
                        disabled={isRunning}
                        className="btn btn-small"
                      >
                        {running === type ? '分析中...' : result ? '再実行' : '実行'}
                      </button>
                    </div>
                  </div>
                  {result && (
                    <div className="analysis-result">
                      {stale && (
                        <p className="analysis-stale-notice" style={{ fontSize: '0.8em', color: 'var(--warning, #b8860b)', marginBottom: 8 }}>
                          データが更新されています。再実行で最新の分析結果を取得できます。
                        </p>
                      )}
                      <AiResultBody text={result} />
                      {cachedAt && (
                        <p className="analysis-meta" style={{ fontSize: '0.75em', color: 'var(--text-muted, #888)', marginTop: 8 }}>
                          分析日時: {formatDate(cachedAt)}
                          {cachedCount != null && cachedCount > sampleLimits[type]
                            ? ` / 全${cachedCount}件中、代表${sampleLimits[type]}件を分析`
                            : ` / ${cachedCount}件を分析`}
                        </p>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      ))}

      <p className="hint" style={{ marginTop: 48 }}>
        日記の一部がOpenAI APIに送信されます。ローカル分析はタイムラインページで確認できます。
      </p>
      <p className="hint">
        分析結果はこの端末のブラウザに保存されます。過去の分析ログも蓄積されています。
      </p>
    </div>
  );
}
