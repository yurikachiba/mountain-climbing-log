import { useState } from 'react';
import { useEntries } from '../hooks/useEntries';
import { useHead } from '../hooks/useHead';
import { useAiCache } from '../hooks/useAiCache';
import { hasApiKey } from '../utils/apiKey';
import { getAllEntries, getEntryCount } from '../db';
import {
  analyzeVitalPoint,
  analyzeTodaysEntry,
  analyzeExternalStandardsMastery,
  analyzeTodaysLandscape,
  analyzeNatureReflection,
  analyzeTimeChanges,
  analyzeCrossReading,
  detectAnalysisToday,
} from '../utils/claude';
import type { DiaryEntry } from '../types';
import { AiResultBody } from '../components/AiResultBody';
import { getAiLogsByType } from '../db';

type AnalysisType =
  | 'todaysEntry'
  | 'vitalPoint'
  | 'externalStandardsMastery'
  | 'todaysLandscape'
  | 'natureReflection'
  | 'timeChanges'
  | 'crossReading';

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
  natureReflection: {
    title: '自然の眼',
    desc: '今日の日記の中の比喩・メタファー・自然的イメージを拾い上げる。どんなレンズで世界を見ているかを、選ばれた言葉の構造から読む',
    fn: analyzeNatureReflection,
  },
  timeChanges: {
    title: '時間の地層',
    desc: '3日・1週間・1ヶ月・3ヶ月・半年・1年・3年・5年 — 8つの距離から今日を見る。変化の事実だけを、評価せずに描く',
    fn: analyzeTimeChanges,
  },
  crossReading: {
    title: '横断読み',
    desc: '他の分析結果を横断して読む。同じ急所が形を変えて繰り返し現れるところ、分析同士が気づかないまま指しているつながりを見つける',
    fn: async () => '', // 特殊ハンドリング — run() 内で analyzeCrossReading を直接呼ぶ
  },
};

const sampleLimits: Record<AnalysisType, number> = {
  todaysEntry: 30,      // 今日＋背景知識
  vitalPoint: 30,       // 今日＋存在テーマ密度
  externalStandardsMastery: 30, // 今日＋背景知識
  todaysLandscape: 30,  // 今日＋直近30日の背景
  natureReflection: 30, // 今日＋直近30日の比喩背景
  timeChanges: 9999,    // 全エントリから各時点を抽出（関数内でフィルタ）
  crossReading: 30,     // 今日＋他の分析結果をインプットにする
};

// 横断読みは他の分析結果をインプットにするため、すべて実行の最後に回す
const runLastTypes = new Set<AnalysisType>(['crossReading']);

const categories: AnalysisCategory[] = [
  {
    label: '今ここ',
    items: ['todaysEntry', 'todaysLandscape', 'vitalPoint', 'externalStandardsMastery', 'natureReflection'],
  },
  {
    label: '時間',
    items: ['timeChanges'],
  },
  {
    label: '横断',
    items: ['crossReading'],
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
    description: '7種類のAI分析。今日、今日の景色、急所、外基準の統合、自然の眼、時間の地層、横断読み。フィルターなしの全景マッピングから比喩の構造分析、分析横断のパターン検出まで。',
    keywords: 'AI日記分析,今日,今日の景色,急所,外基準の統合,自然の眼,時間の地層,横断読み,直近分析',
    path: '/analysis',
  });

  const { entries, loading, refresh: refreshEntries } = useEntries();
  const { cache, loading: cacheLoading, save } = useAiCache();
  const [running, setRunning] = useState<AnalysisType | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allProgress, setAllProgress] = useState<{ done: number; total: number } | null>(null);


  // キャッシュから結果を取得（表示用）
  function getResult(type: AnalysisType): string | undefined {
    return cache[type]?.result;
  }

  // 横断読みに必要な他の分析結果を収集する（日付不一致のキャッシュは除外）
  function collectAnalysisResultsForDate(currentDate?: string): Record<string, string> {
    const otherTypes: AnalysisType[] = ['todaysEntry', 'vitalPoint', 'externalStandardsMastery', 'todaysLandscape', 'natureReflection', 'timeChanges'];
    const results: Record<string, string> = {};
    for (const t of otherTypes) {
      const c = cache[t];
      if (!c?.result) continue;
      // analyzedForDate がある場合、現在の「今日」と一致するもののみ使う
      if (currentDate && c.analyzedForDate && c.analyzedForDate !== currentDate) continue;
      results[t] = c.result;
    }
    return results;
  }

  async function run(type: AnalysisType) {
    if (!hasApiKey()) {
      setError('APIキーが設定されていません。設定ページで入力してください。');
      return;
    }
    setRunning(type);
    setError(null);
    try {
      // 分析実行前にDBから最新エントリを取得（ステートが古い可能性があるため）
      const freshEntries = await getAllEntries();
      const freshCount = await getEntryCount();
      const today = detectAnalysisToday(freshEntries);

      // 急所の場合、過去ログから問い追跡用の結果を取得
      if (type === 'vitalPoint') {
        const prevResult = cache[type]?.result;
        const pastLogs = await getAiLogsByType('vitalPoint');
        const pastResults = pastLogs
          .sort((a, b) => b.analyzedAt.localeCompare(a.analyzedAt))
          .map(log => log.result);
        const result = await analyzeVitalPoint(freshEntries, prevResult, pastResults);
        await save(type, result, freshCount, today?.date, today?.count);
      } else if (type === 'crossReading') {
        // 横断読みは他の分析結果をインプットにする
        // キャッシュ汚染防止: 現在の「今日」と一致する分析結果のみ使う
        const analysisResults = collectAnalysisResultsForDate(today?.date);
        if (Object.keys(analysisResults).length === 0) {
          setError('横断読みには他の分析結果が必要です。先に他の分析を実行してください。');
          return;
        }
        const result = await analyzeCrossReading(freshEntries, analysisResults);
        await save(type, result, freshCount, today?.date, today?.count);
      } else {
        const prevResult = cache[type]?.result;
        const result = await analysisMap[type].fn(freshEntries, prevResult);
        await save(type, result, freshCount, today?.date, today?.count);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析に失敗しました');
    } finally {
      setRunning(null);
      refreshEntries();
    }
  }

  async function runAll() {
    if (!hasApiKey()) {
      setError('APIキーが設定されていません。設定ページで入力してください。');
      return;
    }
    setRunningAll(true);
    setError(null);

    // 分析実行前にDBから最新エントリを取得（ステートが古い可能性があるため）
    const freshEntries = await getAllEntries();
    const freshCount = await getEntryCount();
    const today = detectAnalysisToday(freshEntries);

    const mainTypes = categories.flatMap(c => c.items).filter(t => !runLastTypes.has(t));
    const lastTypes = categories.flatMap(c => c.items).filter(t => runLastTypes.has(t));
    const allTypes = [...mainTypes, ...lastTypes];
    setAllProgress({ done: 0, total: allTypes.length });

    // 横断読み用に各分析結果をローカルに収集（cache のクロージャは古いため）
    const collectedResults: Record<string, string> = {};
    const errors: string[] = [];

    for (let i = 0; i < mainTypes.length; i++) {
      const type = mainTypes[i];
      setRunning(type);
      try {
        const prevResult = cache[type]?.result;
        let result: string;
        if (type === 'vitalPoint') {
          const pastLogs = await getAiLogsByType('vitalPoint');
          const pastResults = pastLogs
            .sort((a, b) => b.analyzedAt.localeCompare(a.analyzedAt))
            .map(log => log.result);
          result = await analyzeVitalPoint(freshEntries, prevResult, pastResults);
        } else {
          result = await analysisMap[type].fn(freshEntries, prevResult);
        }
        await save(type, result, freshCount, today?.date, today?.count);
        if (result) collectedResults[type] = result;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : `${analysisMap[type].title}の分析に失敗しました`);
      }
      setAllProgress({ done: i + 1, total: allTypes.length });
    }

    // 横断読みを最後に実行（他の分析結果を収集済み）
    if (lastTypes.length > 0 && Object.keys(collectedResults).length > 0) {
      for (let i = 0; i < lastTypes.length; i++) {
        const type = lastTypes[i];
        setRunning(type);
        try {
          if (type === 'crossReading') {
            const result = await analyzeCrossReading(freshEntries, collectedResults);
            await save(type, result, freshCount, today?.date, today?.count);
          }
        } catch (err) {
          errors.push(err instanceof Error ? err.message : `${analysisMap[type].title}の分析に失敗しました`);
        }
        setAllProgress({ done: mainTypes.length + i + 1, total: allTypes.length });
      }
    }

    if (errors.length > 0) {
      setError(`${errors.length}件の分析でエラー: ${errors.join(' / ')}`);
    }

    setRunning(null);
    setRunningAll(false);
    setAllProgress(null);
    refreshEntries();
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

  // 現在の「今日」を検出し、キャッシュの日付不一致を stale 扱いにする
  const currentToday = detectAnalysisToday(entries);
  const staleCount = Object.keys(cache).filter(k => {
    if (!validTypes.has(k)) return false;
    const c = cache[k];
    if (!c) return false;
    if (c.isStale) return true;
    // analyzedForDate がある場合、現在の「今日」と不一致なら stale
    if (currentToday && c.analyzedForDate && c.analyzedForDate !== currentToday.date) return true;
    return false;
  }).length;

  return (
    <div className="page">
      <h1 className="page-title">AI分析</h1>
      <p className="subtitle">直近の日記だけを見る。深く。</p>

      {!hasApiKey() && (
        <p className="hint" style={{ color: 'var(--danger)' }}>
          設定ページでAnthropic APIキーを入力してください
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
              const c = cache[type];
              const stale = c?.isStale || (currentToday && c?.analyzedForDate && c.analyzedForDate !== currentToday.date);
              const cachedAt = c?.analyzedAt;
              const cachedCount = c?.entryCount;
              const forDate = c?.analyzedForDate;
              const todayCount = c?.todayEntryCount;
              const dateMismatch = currentToday && forDate && forDate !== currentToday.date;
              return (
                <section key={type} className="analysis-section">
                  <div className="analysis-header">
                    <div>
                      <h3>{analysisMap[type].title}</h3>
                      <p className="settings-desc">{analysisMap[type].desc}</p>
                    </div>
                    <div className="analysis-header-actions">
                      {result && !stale && <span className="analysis-done-badge">完了</span>}
                      {result && stale && <span className="analysis-done-badge" style={{ background: dateMismatch ? 'var(--danger, #c0392b)' : 'var(--warning, #b8860b)', color: '#fff' }}>{dateMismatch ? '日付不一致' : '更新あり'}</span>}
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
                      {dateMismatch && (
                        <p className="analysis-stale-notice" style={{ fontSize: '0.8em', color: 'var(--danger, #c0392b)', marginBottom: 8, fontWeight: 'bold' }}>
                          この結果は {forDate} の分析です（最新の日記は {currentToday?.date}）。再実行してください。
                        </p>
                      )}
                      {!dateMismatch && stale && (
                        <p className="analysis-stale-notice" style={{ fontSize: '0.8em', color: 'var(--warning, #b8860b)', marginBottom: 8 }}>
                          データが更新されています。再実行で最新の分析結果を取得できます。
                        </p>
                      )}
                      <AiResultBody text={result} />
                      {cachedAt && (
                        <p className="analysis-meta" style={{ fontSize: '0.75em', color: 'var(--text-muted, #888)', marginTop: 8 }}>
                          分析日時: {formatDate(cachedAt)}
                          {forDate && ` / 対象日: ${forDate}`}
                          {todayCount != null && ` / 「今日」のエントリ: ${todayCount}件`}
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
        日記の一部がAnthropic Claude APIに送信されます。ローカル分析はタイムラインページで確認できます。
      </p>
      <p className="hint">
        分析結果はこの端末のブラウザに保存されます。過去の分析ログも蓄積されています。
      </p>
    </div>
  );
}
