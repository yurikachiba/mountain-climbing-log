import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, AreaChart, Area,
} from 'recharts';
import { useEntries } from '../hooks/useEntries';
import { useHead } from '../hooks/useHead';
import { analyzeEntries, analyzeEntriesEveryOtherDay, calcStabilityByYear, calcElevationEveryOtherDay } from '../utils/emotionAnalyzer';

export function Timeline() {
  const { entries, loading } = useEntries();

  useHead({
    title: '成長タイムライン ― 感情分析グラフ',
    description: '日記データから標高メタファー・安定指数・ネガティブ比率・自己否定語の推移をグラフで可視化。AIを使わずに端末内で完結するローカル感情分析。年ごとの成長の軌跡を追跡。感情頻出ワードランキングも表示。',
    keywords: '感情分析,タイムライン,成長グラフ,標高メタファー,安定指数,ネガティブ比率,感情推移,ローカル分析',
    path: '/timeline',
  });

  const analysis = useMemo(() => analyzeEntries(entries), [entries]);
  const dailyAnalysis = useMemo(() => analyzeEntriesEveryOtherDay(entries), [entries]);
  const stability = useMemo(() => calcStabilityByYear(analysis), [analysis]);
  const elevationDaily = useMemo(() => calcElevationEveryOtherDay(dailyAnalysis, entries), [dailyAnalysis, entries]);

  const elevationData = elevationDaily.map(e => ({
    date: e.date,
    '標高': e.elevation,
    '登攀': e.climb,
  }));

  const stabilityData = stability.map(s => ({
    year: s.year,
    '安定指数': s.score,
  }));

  const ratioData = dailyAnalysis.map(a => ({
    date: a.date,
    'ネガティブ比率': Math.round(a.negativeRatio * 100),
  }));

  const denialData = dailyAnalysis.map(a => ({
    date: a.date,
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

  // X軸の月初ラベルだけ表示するフォーマッタ
  const dateTickFormatter = (v: string) => {
    if (typeof v !== 'string' || v.length < 10) return '';
    const day = v.substring(8, 10);
    if (day === '01') {
      // YYYY-MM-DD → YY/MM
      return `${v.substring(2, 4)}/${v.substring(5, 7)}`;
    }
    return '';
  };

  // データ量に応じた tick 間隔を算出
  const calcTickInterval = (dataLength: number) => {
    if (dataLength <= 30) return 0;
    if (dataLength <= 90) return Math.floor(dataLength / 15);
    if (dataLength <= 365) return Math.floor(dataLength / 12);
    return Math.floor(dataLength / 10);
  };

  return (
    <div className="page">
      <h1 className="page-title">成長タイムライン</h1>

      {elevationData.length > 1 && (
        <section className="chart-section">
          <h2>標高 — どれだけ登ったか</h2>
          <p style={{ fontSize: '0.85em', color: 'var(--text-muted, #888)', marginBottom: 12 }}>
            書き続けた日は必ず登っている。ポジティブ比率・記述量・改善度から1日おきに算出
          </p>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={elevationData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis
                dataKey="date"
                fontSize={11}
                tickFormatter={dateTickFormatter}
                interval={calcTickInterval(elevationData.length)}
              />
              <YAxis
                fontSize={12}
                unit="m"
                tickCount={8}
                domain={['dataMin - 50', 'dataMax + 50']}
              />
              <Tooltip
                labelFormatter={(label) => `${label}`}
                formatter={(value, name) => {
                  if (value == null) return '-';
                  return name === '登攀' ? `+${value}m` : `${value}m`;
                }}
              />
              <Area
                type="monotone"
                dataKey="標高"
                stroke="#444"
                fill="#d0d0d0"
                strokeWidth={2}
                baseValue="dataMin"
              />
              <Area
                type="monotone"
                dataKey="登攀"
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
        <h2>ネガティブ比率の推移（1日おき %）</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={ratioData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis
              dataKey="date"
              fontSize={11}
              tickFormatter={dateTickFormatter}
              interval={calcTickInterval(ratioData.length)}
            />
            <YAxis domain={[0, 100]} fontSize={12} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="ネガティブ比率"
              stroke="#555"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section className="chart-section">
        <h2>自己否定語の推移（1日おき）</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={denialData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis
              dataKey="date"
              fontSize={11}
              tickFormatter={dateTickFormatter}
              interval={calcTickInterval(denialData.length)}
            />
            <YAxis fontSize={12} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="自己否定語"
              stroke="#555"
              strokeWidth={2}
              dot={false}
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
