import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, AreaChart, Area,
  Legend, ReferenceLine,
} from 'recharts';
import { useEntries } from '../hooks/useEntries';
import { useHead } from '../hooks/useHead';
import { analyzeEntries, analyzeEntriesEveryOtherDay, calcStabilityByYear, calcElevationEveryOtherDay } from '../utils/emotionAnalyzer';
import {
  calcMonthlyDeepAnalysis,
  detectTrendShifts,
  calcSeasonalCrossStats,
  calcCurrentStateNumeric,
  calcPredictiveIndicators,
} from '../utils/deepAnalyzer';

const mutedStyle = { fontSize: '0.85em', color: 'var(--text-muted, #888)', marginBottom: 12 };

// 月次データ用のX軸フォーマッター
const monthTick = (v: string) => {
  const [y, m] = v.split('-');
  return m === '01' || m === '07' ? `${y}/${m}` : '';
};

export function Timeline() {
  const { entries, loading } = useEntries();

  useHead({
    title: '深層タイムライン ― 感情分析・予測ダッシュボード',
    description: '移動平均・季節補正・語彙深度・身体症状相関・予測シグナルを含む多層感情分析。日記データから統計的に有意な変化を検出。',
    keywords: '感情分析,タイムライン,移動平均,季節補正,予測,身体症状,語彙深度,深層分析',
    path: '/timeline',
  });

  // 既存の分析（月単位 + 1日おき）
  const analysis = useMemo(() => analyzeEntries(entries), [entries]);
  const dailyAnalysis = useMemo(() => analyzeEntriesEveryOtherDay(entries), [entries]);
  const stability = useMemo(() => calcStabilityByYear(analysis), [analysis]);
  const elevationDaily = useMemo(() => calcElevationEveryOtherDay(dailyAnalysis, entries), [dailyAnalysis, entries]);

  // 深層分析
  const monthlyDeep = useMemo(() => calcMonthlyDeepAnalysis(entries), [entries]);
  const trendShifts = useMemo(() => detectTrendShifts(monthlyDeep), [monthlyDeep]);
  const seasonalStats = useMemo(() => calcSeasonalCrossStats(monthlyDeep), [monthlyDeep]);
  const currentState = useMemo(() => calcCurrentStateNumeric(monthlyDeep), [monthlyDeep]);
  const predictive = useMemo(() => calcPredictiveIndicators(monthlyDeep, entries), [monthlyDeep, entries]);

  // 1日おきチャートデータ
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

  // 深層分析チャートデータ（月次）
  const negRatioData = monthlyDeep.map(m => ({
    month: m.month,
    '実測値': Math.round(m.negativeRatio * 100),
    '3ヶ月移動平均': m.negativeRatioMA3 !== null ? Math.round(m.negativeRatioMA3 * 100) : null,
    '6ヶ月移動平均': m.negativeRatioMA6 !== null ? Math.round(m.negativeRatioMA6 * 100) : null,
    '季節ベースライン': m.seasonalBaseline !== null ? Math.round(m.seasonalBaseline * 100) : null,
  }));

  const seasonalDeviationData = monthlyDeep
    .filter(m => m.seasonalDeviation !== null)
    .map(m => ({
      month: m.month,
      '季節補正後偏差': Math.round(m.seasonalDeviation! * 100),
    }));

  const vocabData = monthlyDeep.map(m => ({
    month: m.month,
    '一人称率': m.firstPersonRate,
    '他者参照率': m.otherPersonRate,
    '自己モニタリング率': m.selfMonitorRate,
  }));

  const bodyWorkData = monthlyDeep.map(m => ({
    month: m.month,
    '身体症状(/1000字)': m.physicalSymptomRate,
    '仕事語率': m.workWordRate,
  }));

  const sentenceLengthData = monthlyDeep.map(m => ({
    month: m.month,
    '平均文長': m.avgSentenceLength,
  }));

  const seasonalBarData = seasonalStats.map(s => ({
    season: s.seasonLabel,
    'ネガ率(%)': Math.round(s.avgNegativeRatio * 100),
    '身体症状(/月)': s.avgPhysicalSymptoms,
    '仕事語率': s.avgWorkWordRate,
    '自己モニタリング率': s.avgSelfMonitorRate,
  }));

  // 全期間の頻出感情ワードTop15
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
        <h1 className="page-title">深層タイムライン</h1>
        <p className="empty-message">日記をインポートすると分析結果が表示されます</p>
      </div>
    );
  }

  if (analysis.length === 0) {
    return (
      <div className="page">
        <h1 className="page-title">深層タイムライン</h1>
        <p className="empty-message">日付のあるエントリが必要です</p>
      </div>
    );
  }

  // X軸の月初ラベルだけ表示するフォーマッタ（main側の改善を採用）
  const dateTickFormatter = (v: string) => {
    if (typeof v !== 'string' || v.length < 10) return '';
    const day = v.substring(8, 10);
    if (day === '01') {
      return `${v.substring(2, 4)}/${v.substring(5, 7)}`;
    }
    return '';
  };

  // データ量に応じた tick 間隔を算出（main側の改善を採用）
  const calcTickInterval = (dataLength: number) => {
    if (dataLength <= 30) return 0;
    if (dataLength <= 90) return Math.floor(dataLength / 15);
    if (dataLength <= 365) return Math.floor(dataLength / 12);
    return Math.floor(dataLength / 10);
  };

  const trendLabel = currentState?.negRatioTrend === 'improving' ? '改善傾向'
    : currentState?.negRatioTrend === 'worsening' ? '悪化傾向' : '安定';
  const riskColor = currentState?.riskLevel === 'elevated' ? '#c0392b'
    : currentState?.riskLevel === 'moderate' ? '#d4a017' : '#27ae60';

  return (
    <div className="page">
      <h1 className="page-title">深層タイムライン</h1>

      {/* ── 現在地ダッシュボード ── */}
      {currentState && (
        <section className="chart-section" style={{ background: 'var(--bg-secondary, #f5f5f5)', padding: 20, borderRadius: 8, marginBottom: 24 }}>
          <h2>現在地 ― 数値で見る</h2>
          <p style={mutedStyle}>直近3ヶ月の実測値に基づく現在地評価。主観ではなくデータが語る。</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginTop: 12 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2em', fontWeight: 'bold' }}>{currentState.overallStability}</div>
              <div style={{ fontSize: '0.8em', color: 'var(--text-muted, #888)' }}>複合安定度 /100</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2em', fontWeight: 'bold' }}>{Math.round(currentState.recentNegRatio * 100)}%</div>
              <div style={{ fontSize: '0.8em', color: 'var(--text-muted, #888)' }}>ネガ率（全期間平均 {Math.round(currentState.historicalNegRatio * 100)}%）</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2em', fontWeight: 'bold' }}>{trendLabel}</div>
              <div style={{ fontSize: '0.8em', color: 'var(--text-muted, #888)' }}>ネガ率トレンド</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2em', fontWeight: 'bold', color: riskColor }}>{currentState.riskLevel === 'elevated' ? '要注意' : currentState.riskLevel === 'moderate' ? '注意' : '低'}</div>
              <div style={{ fontSize: '0.8em', color: 'var(--text-muted, #888)' }}>リスクレベル</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2em', fontWeight: 'bold' }}>{currentState.recentPhysicalSymptoms}</div>
              <div style={{ fontSize: '0.8em', color: 'var(--text-muted, #888)' }}>身体症状/月（全期間 {currentState.historicalPhysicalSymptoms}）</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2em', fontWeight: 'bold' }}>{currentState.recentAvgSentenceLength}字</div>
              <div style={{ fontSize: '0.8em', color: 'var(--text-muted, #888)' }}>平均文長（全期間 {currentState.historicalAvgSentenceLength}字）</div>
            </div>
          </div>

          {/* 予測シグナル */}
          {predictive.activeSignals.length > 0 && (
            <div style={{ marginTop: 16, padding: 12, border: '1px solid var(--border, #ddd)', borderRadius: 6 }}>
              <div style={{ fontWeight: 'bold', marginBottom: 8 }}>予測シグナル</div>
              {predictive.activeSignals.map((sig, i) => (
                <div key={i} style={{ fontSize: '0.85em', marginBottom: 4, color: sig.severity === 'warning' ? '#c0392b' : sig.severity === 'caution' ? '#d4a017' : 'var(--text, #333)' }}>
                  {sig.severity === 'warning' ? '!! ' : sig.severity === 'caution' ? '! ' : '- '}
                  {sig.signal}: {sig.evidence}
                </div>
              ))}
            </div>
          )}

          {/* 前兆語 */}
          {predictive.precursorWords.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: '0.85em', color: 'var(--text-muted, #888)', marginBottom: 4 }}>
                過去パターンから抽出した前兆語（ネガ率急上昇前に出現傾向）:
              </div>
              <div style={{ fontSize: '0.85em' }}>
                {predictive.precursorWords.slice(0, 8).map(p =>
                  `${p.word}(${p.correlation.toFixed(1)})`
                ).join(' / ')}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── トレンドシフト検出結果 ── */}
      {trendShifts.length > 0 && (
        <section className="chart-section">
          <h2>検出された転機（トレンドベース）</h2>
          <p style={mutedStyle}>3ヶ月移動ウィンドウで検出した統計的に有意な変化。単発の文章ではなく、傾向として確認済み。</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {trendShifts.map((shift, i) => (
              <div key={i} style={{ padding: 10, border: '1px solid var(--border, #ddd)', borderRadius: 6, fontSize: '0.85em' }}>
                <div style={{ fontWeight: 'bold' }}>
                  {shift.startMonth} ~ {shift.endMonth}
                  {' '}
                  <span style={{ color: shift.type === 'deterioration' ? '#c0392b' : shift.type === 'recovery' ? '#27ae60' : '#7f8c8d', fontWeight: 'normal' }}>
                    [{shift.type === 'deterioration' ? '悪化' : shift.type === 'recovery' ? '回復' : shift.type === 'vocabulary_shift' ? '語彙変化' : '横ばい'}]
                  </span>
                  {' '}
                  <span style={{ color: 'var(--text-muted, #888)', fontWeight: 'normal' }}>
                    ({shift.magnitude}σ)
                  </span>
                </div>
                <div style={{ color: 'var(--text-muted, #666)', marginTop: 4 }}>{shift.description}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 標高（1日おき） ── */}
      {elevationData.length > 1 && (
        <section className="chart-section">
          <h2>標高 — どれだけ登ったか</h2>
          <p style={mutedStyle}>
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

      {/* ── 安定指数 ── */}
      {stabilityData.length > 1 && (
        <section className="chart-section">
          <h2>安定指数の推移（年単位 0-100）</h2>
          <p style={mutedStyle}>ポジティブ比率・感情の安定性・自己否定語の少なさから算出</p>
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

      {/* ── ネガティブ比率（1日おき） ── */}
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

      {/* ── ネガティブ比率 + 移動平均（月次トレンド） ── */}
      {negRatioData.length > 1 && (
        <section className="chart-section">
          <h2>ネガティブ比率 ― 移動平均付き（月単位トレンド %）</h2>
          <p style={mutedStyle}>
            灰色の点 = 月次実測値。実線 = 3ヶ月移動平均（トレンド）。破線 = 6ヶ月移動平均（長期傾向）。点線 = 季節ベースライン。
          </p>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={negRatioData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="month" fontSize={11} tickFormatter={monthTick} interval={0} />
              <YAxis domain={[0, 100]} fontSize={12} unit="%" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="実測値" stroke="#bbb" strokeWidth={1} dot={{ r: 2, fill: '#999' }} />
              <Line type="monotone" dataKey="3ヶ月移動平均" stroke="#333" strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="6ヶ月移動平均" stroke="#666" strokeWidth={2} strokeDasharray="8 4" dot={false} connectNulls />
              <Line type="monotone" dataKey="季節ベースライン" stroke="#aaa" strokeWidth={1} strokeDasharray="3 3" dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* ── 季節補正後偏差 ── */}
      {seasonalDeviationData.length > 3 && (
        <section className="chart-section">
          <h2>季節補正後のネガティブ偏差（月単位）</h2>
          <p style={mutedStyle}>
            季節の平均を差し引いた偏差。0より上 = その季節の平均より悪い。0より下 = 平均より良い。季節変動を除いた「真の変化」が見える。
          </p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={seasonalDeviationData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="month" fontSize={11} tickFormatter={monthTick} interval={0} />
              <YAxis fontSize={12} unit="pt" />
              <Tooltip formatter={(value) => `${Number(value) > 0 ? '+' : ''}${value}pt`} />
              <ReferenceLine y={0} stroke="#333" />
              <Bar dataKey="季節補正後偏差" fill="#888" name="季節補正後偏差" />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* ── 季節×指標クロス集計 ── */}
      {seasonalBarData.length > 1 && (
        <section className="chart-section">
          <h2>季節×指標クロス集計</h2>
          <p style={mutedStyle}>
            季節ごとの主要指標比較。ネガ率・身体症状・仕事語率・自己モニタリング率を定量比較。
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={seasonalBarData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="season" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar dataKey="ネガ率(%)" fill="#555" />
              <Bar dataKey="身体症状(/月)" fill="#888" />
              <Bar dataKey="仕事語率" fill="#aaa" />
              <Bar dataKey="自己モニタリング率" fill="#ccc" />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* ── 語彙構造の推移 ── */}
      {vocabData.length > 1 && (
        <section className="chart-section">
          <h2>語彙構造の推移（/1000字）</h2>
          <p style={mutedStyle}>
            一人称率の変化 = 内向/外向の移行。自己モニタリング語の消失 = 自分を観察する余裕の変化。他者参照の増加 = 社会的役割意識の変化。
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={vocabData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="month" fontSize={11} tickFormatter={monthTick} interval={0} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="一人称率" stroke="#333" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="他者参照率" stroke="#888" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="自己モニタリング率" stroke="#bbb" strokeWidth={2} strokeDasharray="4 2" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* ── 身体症状 + 仕事語 ── */}
      {bodyWorkData.length > 1 && (
        <section className="chart-section">
          <h2>身体症状と仕事語の推移</h2>
          <p style={mutedStyle}>
            身体症状（頭痛・不眠・動悸等）と仕事関連語の共起パターン。両者が同時に上昇する月はストレス負荷が高い。
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={bodyWorkData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="month" fontSize={11} tickFormatter={monthTick} interval={0} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="身体症状(/1000字)" stroke="#555" strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="仕事語率" stroke="#aaa" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* ── 平均文長の推移 ── */}
      {sentenceLengthData.length > 1 && (
        <section className="chart-section">
          <h2>平均文長の推移（字/文）</h2>
          <p style={mutedStyle}>
            文が短くなる = 思考が断片化している可能性。長くなる = 内省の深化、または整理が進んでいる。
          </p>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={sentenceLengthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="month" fontSize={11} tickFormatter={monthTick} interval={0} />
              <YAxis fontSize={12} unit="字" />
              <Tooltip formatter={(value) => `${value}字`} />
              <Line type="monotone" dataKey="平均文長" stroke="#555" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* ── 自己否定語（1日おき） ── */}
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

      {/* ── 感情頻出ワード ── */}
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
