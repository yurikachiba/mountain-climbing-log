import { useState } from 'react';
import { useEntries } from '../hooks/useEntries';
import { useHead } from '../hooks/useHead';
import { useAiCache } from '../hooks/useAiCache';
import { hasApiKey } from '../utils/apiKey';
import {
  analyzeVitalPoint,
  analyzeTodaysEntry,
  analyzeExternalStandardsMastery,
  analyzeTodaysLandscape,
} from '../utils/openai';
import type { DiaryEntry } from '../types';
import { AiResultBody } from '../components/AiResultBody';

type AnalysisType =
  | 'todaysEntry'
  | 'vitalPoint'
  | 'externalStandardsMastery'
  | 'todaysLandscape';

interface AnalysisItem {
  title: string;
  desc: string;
  fn: (entries: DiaryEntry[], previousResult?: string) => Promise<string>;
}

interface AnalysisCategory {
  label: string;
  items: AnalysisType[];
}

const analysisMap: Record<AnalysisType, AnalysisItem> = {
  todaysEntry: {
    title: '今日',
    desc: '今日だけ。でもわかってる人が読む今日',
    fn: analyzeTodaysEntry,
  },
  vitalPoint: {
    title: '急所',
    desc: '今日の日記から本質を突く、たった一つの指摘',
    fn: analyzeVitalPoint,
  },
  externalStandardsMastery: {
    title: '外基準の統合',
    desc: '今日、内側を守ったまま外基準を道具として扱えているか。感情の地層を掘り、今日固有の最深部を言い当てる',
    fn: analyzeExternalStandardsMastery,
  },
  todaysLandscape: {
    title: '今日の景色',
    desc: 'フィルターなしで今日の全トピックをマッピング。不安だけでなく、好奇心も遊びも日常も',
    fn: analyzeTodaysLandscape,
  },
};

const sampleLimits: Record<AnalysisType, number> = {
  todaysEntry: 30,      // 今日＋背景知識
  vitalPoint: 30,       // 今日＋存在テーマ密度
  externalStandardsMastery: 30, // 今日＋背景知識
  todaysLandscape: 30,  // 今日＋直近30日の背景
};

const categories: AnalysisCategory[] = [
  {
    label: '今ここ',
    items: ['todaysEntry', 'todaysLandscape', 'vitalPoint', 'externalStandardsMastery'],
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
    title: 'AI分析',
    description: '4種類のAI分析。今日、今日の景色、外基準の統合、急所。フィルターなしの全景マッピングから深層構造分析まで。',
    keywords: 'AI日記分析,今日,今日の景色,急所,外基準の統合,直近分析',
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
      const prevResult = cache[type]?.result;
      const result = await analysisMap[type].fn(entries, prevResult);
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
        const prevResult = cache[type]?.result;
        const result = await analysisMap[type].fn(entries, prevResult);
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
  const validTypes = new Set(Object.keys(analysisMap));
  const completedCount = Object.keys(cache).filter(k => validTypes.has(k) && cache[k]?.result).length;
  const staleCount = Object.keys(cache).filter(k => validTypes.has(k) && cache[k]?.isStale).length;

  return (
    <div className="page">
      <h1 className="page-title">AI分析</h1>
      <p className="subtitle">直近の日記だけを見る。深く。</p>

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
