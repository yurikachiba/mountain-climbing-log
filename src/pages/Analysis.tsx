import { useState } from 'react';
import { useEntries } from '../hooks/useEntries';
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
} from '../utils/openai';
import type { DiaryEntry } from '../types';

type AnalysisType =
  | 'summary' | 'tags' | 'tone'
  | 'turningPoints' | 'themes' | 'questions'
  | 'seasonal' | 'growth' | 'report';

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
    desc: '感情・生活に大きな変化が起きた時期を特定',
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
];

export function Analysis() {
  const { entries, loading } = useEntries();
  const [results, setResults] = useState<Record<string, string>>({});
  const [running, setRunning] = useState<AnalysisType | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allProgress, setAllProgress] = useState<{ done: number; total: number } | null>(null);

  async function run(type: AnalysisType) {
    if (!hasApiKey()) {
      setError('APIキーが設定されていません。設定ページで入力してください。');
      return;
    }
    setRunning(type);
    setError(null);
    try {
      const result = await analysisMap[type].fn(entries);
      setResults(prev => ({ ...prev, [type]: result }));
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
        setResults(prev => ({ ...prev, [type]: result }));
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

  if (loading) return <div className="page"><p className="loading-text">読み込み中...</p></div>;

  if (entries.length === 0) {
    return (
      <div className="page">
        <h1 className="page-title">AI分析</h1>
        <p className="empty-message">日記をインポートすると分析できます</p>
      </div>
    );
  }

  const isRunning = running !== null;
  const completedCount = Object.keys(results).length;

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
          {runningAll ? '一括分析中...' : 'すべて実行'}
        </button>
        {completedCount > 0 && (
          <span className="analysis-completed-count">
            {completedCount}/{Object.keys(analysisMap).length} 完了
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
            {cat.items.map(type => (
              <section key={type} className="analysis-section">
                <div className="analysis-header">
                  <div>
                    <h3>{analysisMap[type].title}</h3>
                    <p className="settings-desc">{analysisMap[type].desc}</p>
                  </div>
                  <div className="analysis-header-actions">
                    {results[type] && <span className="analysis-done-badge">完了</span>}
                    <button
                      onClick={() => run(type)}
                      disabled={isRunning}
                      className="btn btn-small"
                    >
                      {running === type ? '分析中...' : results[type] ? '再実行' : '実行'}
                    </button>
                  </div>
                </div>
                {results[type] && (
                  <div className="analysis-result">
                    {results[type].split('\n').map((line, i) => (
                      <p key={i}>{line || '\u00A0'}</p>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>
      ))}

      <p className="hint" style={{ marginTop: 48 }}>
        日記の一部がOpenAI APIに送信されます。ローカル分析はタイムラインページで確認できます。
      </p>
    </div>
  );
}
