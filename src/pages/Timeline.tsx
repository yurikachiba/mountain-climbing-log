import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, AreaChart, Area,
} from 'recharts';
import { useEntries } from '../hooks/useEntries';
import { useHead } from '../hooks/useHead';
import { analyzeEntries, calcStabilityByYear, calcElevationByYear, calcElevationByMonth } from '../utils/emotionAnalyzer';

export function Timeline() {
  const { entries, loading } = useEntries();

  useHead({
    title: '成長タイムライン ― 感情分析グラフ',
    description: '日記データから標高メタファー・安定指数・ネガティブ比率・自己否定語の推移をグラフで可視化。AIを使わずに端末内で完結するローカル感情分析。年ごとの成長の軌跡を追跡。感情頻出ワードランキングも表示。',
    keywords: '感情分析,タイムライン,成長グラフ,標高メタファー,安定指数,ネガティブ比率,感情推移,ローカル分析',
    path: '/timeline',
  });

  const analysis = useMemo(() => analyzeEntries(entries), [entries]);
  const stability = useMemo(() => calcStabilityByYear(analysis), [analysis]);
  const elevation = useMemo(() => calcElevationByYear(stability, entries), [stability, entries]);
  const elevationMonthly = useMemo(() => calcElevationByMonth(analysis, entries), [analysis, entries]);

  const elevationData = elevationMonthly.map(e => ({
    month: e.month,
    '標高': e.elevation,
    '月間登攀': e.climb,
  }));

  const stabilityData = stability.map(s => ({
    year: s.year,
    '安定指数': s.score,
  }));

  const ratioData = analysis.map(a => ({
    month: a.month,
    'ネガティブ比率': Math.round(a.negativeRatio * 100),
  }));

  const denialData = analysis.map(a => ({
    month: a.month,
    '自己否定語': a.selfDenialCount,
  }));

  // 全期間の頻出感情ワードTop10
  const allWords = new Map<string, number>();
  for (const a of analysis) {
    for (const w of a.topEmotionWords) {
      allWords.set(w.word, (allWords.get(w.word) ?? 0) + w.count);
    }
  }
  const topWords = [...allWords.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word, count]) => ({ word, count }));

  if (loading) return <div className="page"><p className="loading-text">読み込み中...</p></div>;

  if (entries.length === 0) {
    return (
      <div className="page">
        <h1 className="page-title">成長タイムライン</h1>
        <p className="empty-message">日記をインポートすると分析結果が表示されます</p>
      </div>
    );
  }

  if (analysis.length === 0) {
    return (
      <div className="page">
        <h1 className="page-title">成長タイムライン</h1>
        <p className="empty-message">日付のあるエントリが必要です</p>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">成長タイムライン</h1>

      {elevationData.length > 1 && (
        <section className="chart-section">
          <h2>標高 — どれだけ登ったか</h2>
          <p style={{ fontSize: '0.85em', color: 'var(--text-muted, #888)', marginBottom: 12 }}>
            書き続けた月は必ず登っている。ポジティブ比率・記述量・改善度から月単位で算出
          </p>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={elevationData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis
                dataKey="month"
                fontSize={11}
                tickFormatter={(v: string) => {
                  const [y, m] = v.split('-');
                  return m === '01' || m === '07' ? `${y}/${m}` : '';
                }}
                interval={0}
              />
              <YAxis
                fontSize={12}
                unit="m"
                tickCount={10}
              />
              <Tooltip
                labelFormatter={(label: string) => label}
                formatter={(value: number, name: string) => {
                  if (value == null) return '-';
                  return name === '月間登攀' ? `+${value}m` : `${value}m`;
                }}
              />
              <Area
                type="monotone"
                dataKey="標高"
                stroke="#444"
                fill="#d0d0d0"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="月間登攀"
                stroke="#999"
                fill="transparent"
                strokeWidth={1}
                strokeDasharray="4 2"
              />
            </AreaChart>
          </ResponsiveContainer>
        </section>
      )}

      {stabilityData.length > 1 && (
        <section className="chart-section">
          <h2>安定指数の推移（年単位 0-100）</h2>
          <p style={{ fontSize: '0.85em', color: 'var(--text-muted, #888)', marginBottom: 12 }}>
            ポジティブ比率・感情の安定性・自己否定語の少なさから算出
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stabilityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="year" fontSize={12} />
              <YAxis domain={[0, 100]} fontSize={12} />
              <Tooltip />
              <Bar dataKey="安定指数" fill="#666" name="安定指数" />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      <section className="chart-section">
        <h2>ネガティブ比率の推移（月単位 %）</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={ratioData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis dataKey="month" fontSize={12} />
            <YAxis domain={[0, 100]} fontSize={12} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="ネガティブ比率"
              stroke="#555"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section className="chart-section">
        <h2>自己否定語の推移（月単位）</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={denialData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis dataKey="month" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="自己否定語"
              stroke="#555"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section className="chart-section">
        <h2>感情頻出ワード（全期間）</h2>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={topWords} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis type="number" fontSize={12} />
            <YAxis dataKey="word" type="category" width={80} fontSize={12} />
            <Tooltip />
            <Bar dataKey="count" fill="#888" name="出現回数" />
          </BarChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}
