import { useState } from 'react';
import { useEntries } from '../hooks/useEntries';
import { useHead } from '../hooks/useHead';
import { useAiCache } from '../hooks/useAiCache';
import { hasApiKey } from '../utils/apiKey';
import {
  summarizeByPeriod,
  extractEmotionTags,
  analyzeTone,
  detectTurningPoints,
  extractRecurringThemes,
  generateReflectiveQuestions,
  analyzeSeasonalEmotions,
  analyzeGrowth,
  generateComprehensiveReport,
  analyzeElevationNarrative,
  declareStrengths,
  analyzeCounterfactual,
} from '../utils/openai';
import type { DiaryEntry } from '../types';

type AnalysisType =
  | 'summary' | 'tags' | 'tone'
  | 'turningPoints' | 'themes' | 'questions'
  | 'seasonal' | 'growth' | 'report'
  | 'elevation' | 'strengths' | 'counterfactual';

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
  summary: {
    title: '年代別要約',
    desc: '年ごとの傾向を500字以内で要約',
    fn: summarizeByPeriod,
  },
  tags: {
    title: '頻出感情タグ',
    desc: '日記全体から感情タグを抽出',
    fn: extractEmotionTags,
  },
  tone: {
    title: '文章トーン分析',
    desc: '前期と後期でトーンの変化を比較',
    fn: analyzeTone,
  },
  turningPoints: {
    title: '転機検出',
    desc: '変化の時期を特定し、標高変動と「未来からの一行」を付与',
    fn: detectTurningPoints,
  },
  themes: {
    title: '繰り返すテーマ',
    desc: '時期を超えて繰り返し現れるモチーフを抽出',
    fn: extractRecurringThemes,
  },
  questions: {
    title: '自分への問い',
    desc: '日記のパターンから内省的な問いかけを生成',
    fn: generateReflectiveQuestions,
  },
  seasonal: {
    title: '季節×感情マップ',
    desc: '春夏秋冬ごとの感情傾向を分析',
    fn: analyzeSeasonalEmotions,
  },
  growth: {
    title: '成長の軌跡',
    desc: '初期・中期・後期の3期間で変化を追跡',
    fn: analyzeGrowth,
  },
  report: {
    title: '包括レポート',
    desc: '日記全体を俯瞰した統合分析レポート',
    fn: generateComprehensiveReport,
  },
  elevation: {
    title: '標高ナラティブ',
    desc: '各年を登山の標高として表現 — どれだけ登ったかの物語',
    fn: analyzeElevationNarrative,
  },
  strengths: {
    title: '強みの宣言',
    desc: 'データに基づく客観的な強みの明文化。遠慮なし',
    fn: declareStrengths,
  },
  counterfactual: {
    title: '反事実的因果',
    desc: '「もしこの転機がなかったら？」— 因果のロープを可視化',
    fn: analyzeCounterfactual,
  },
};

const categories: AnalysisCategory[] = [
  {
    label: '基本分析',
    items: ['summary', 'tags', 'tone'],
  },
  {
    label: '深層分析',
    items: ['turningPoints', 'themes', 'questions'],
  },
  {
    label: '俯瞰分析',
    items: ['seasonal', 'growth', 'report'],
  },
  {
    label: '物語分析',
    items: ['elevation', 'strengths', 'counterfactual'],
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
    title: 'AI分析（12種類）',
    description: 'OpenAI APIを使って日記を客観的に分析する12種類の機能。年代別要約、頻出感情タグ、文章トーン分析、転機検出、反復テーマ、内省質問、季節別感情、成長分析、包括レポート、標高ナラティブ、強みの宣言、反事実的因果。ユーザー自身のAPIキー使用でプライバシー保護。',
    keywords: 'AI日記分析,感情タグ,トーン分析,転機検出,成長分析,OpenAI,日記AI,標高ナラティブ,自己分析',
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
    const allTypes = categories.flatMap(c => c.items);
    setAllProgress({ done: 0, total: allTypes.length });

    for (let i = 0; i < allTypes.length; i++) {
      const type = allTypes[i];
      setRunning(type);
      try {
        const result = await analysisMap[type].fn(entries);
        await save(type, result, count);
      } catch (err) {
        setError(err instanceof Error ? err.message : `${analysisMap[type].title}の分析に失敗しました`);
        break;
      }
      setAllProgress({ done: i + 1, total: allTypes.length });
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
      <p className="subtitle">分析だけ。人格は禁止。</p>

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
                      {result.split('\n').map((line, i) => (
                        <p key={i}>{line || '\u00A0'}</p>
                      ))}
                      {cachedAt && (
                        <p className="analysis-meta" style={{ fontSize: '0.75em', color: 'var(--text-muted, #888)', marginTop: 8 }}>
                          分析日時: {formatDate(cachedAt)} / エントリ数: {cachedCount}
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
