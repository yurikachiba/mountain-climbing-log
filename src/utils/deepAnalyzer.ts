import type {
  DiaryEntry,
  MonthlyDeepAnalysis,
  TrendShift,
  SeasonalCrossStats,
  CurrentStateNumeric,
  PredictiveIndicator,
  VocabularyDepth,
} from '../types';

// ── 辞書定義 ──

// ネガティブ語を深度別に分類
const lightNegativeWords = [
  '疲れ', 'だるい', '面倒', '嫌だ', '苦手', 'イライラ', 'ストレス',
  '重い', '暗い', '落ち込', '後悔', '失敗',
];

const deepNegativeWords = [
  '死にたい', '消えたい', '絶望', '無理', '限界', '逃げたい',
  '生きてる意味', '価値がない', '自分なんか', '無価値',
  '地獄', '惨め', '情けない',
];

const allNegativeWords = [
  '辛い', 'つらい', '苦しい', '悲しい', '寂しい', '怖い',
  '不安', '孤独', '絶望', '死にたい', '消えたい', '無理',
  '嫌だ', '嫌い', '最悪', '地獄', '痛い', '泣', '涙',
  '疲れ', '限界', '逃げたい', 'しんどい', 'だるい', '憂鬱',
  '鬱', '落ち込', '暗い', '重い', '苦手', '怒り', '腹が立つ',
  'イライラ', 'ストレス', '後悔', '失敗', '惨め', '情けない',
];

const allPositiveWords = [
  '嬉しい', '楽しい', '幸せ', '好き', '感謝', 'ありがとう',
  '笑', '元気', '希望', '安心', '心地よい', '穏やか',
  '面白い', '素敵', '美しい', '温かい', '優しい', '喜び',
  '達成', '成功', '前向き', '光', '明るい', '自由',
];

// selfDenialWords は emotionAnalyzer.ts 側で使用。deepAnalyzer は negativeWords の深度分類を使用

// 身体症状辞書
const physicalSymptomWords = [
  '頭痛', '偏頭痛', '吐き気', 'めまい', '動悸', '息苦しい',
  '不眠', '眠れない', '体が重い', '食欲がない', '食欲不振',
  '引き攣', '痙攣', '震え', '過呼吸', '幻嗅', '幻聴',
  '耳鳴り', '肩こり', '腰痛', '胃痛', '腹痛', '下痢',
  '蕁麻疹', '発疹', '微熱', '倦怠感', '脱力', '手汗',
  '冷や汗', '顔が引き攣', '体が固まる', '声が出ない',
  '過食', '拒食', '寝すぎ', '早朝覚醒', '中途覚醒',
];

// 仕事関連語
const workWords = [
  '仕事', '職場', '上司', '同僚', '部下', '会議', '締切',
  '残業', '出勤', '退勤', '業務', 'プロジェクト', 'タスク',
  '報告', '資料', '納期', '評価', '面談', '異動', '転職',
  '給料', '昇進', '降格', 'クビ', '解雇', 'ミス', '失注',
  'クレーム', '研修', '出張',
];

// 一人称辞書
const firstPersonWords = [
  '私', 'わたし', 'あたし', '僕', 'ぼく', '俺', 'おれ', '自分',
];

// 他者参照語
const otherPersonWords = [
  'あの人', 'この人', 'その人', '友達', '友人', '家族',
  '母', '父', '兄', '姉', '弟', '妹', '夫', '妻', '彼',
  '彼女', '先生', '医者', 'カウンセラー', '子供', 'こども',
];

// 自己モニタリング語（「調子」の追跡）
const selfMonitorWords = [
  '調子', '体調', '気分', '状態', 'コンディション', '具合',
  '波', '浮き沈み', '安定', '不安定', '回復', '悪化',
];

// タスク・計画関連語
const taskWords = [
  'やること', 'やらなきゃ', 'やらないと', '予定', '計画',
  '目標', 'TODO', 'やりたい', 'やろう', '決めた', '始める',
];

// ── ユーティリティ ──

function countWords(text: string, words: string[]): number {
  let count = 0;
  for (const word of words) {
    const matches = text.match(new RegExp(word, 'g'));
    if (matches) count += matches.length;
  }
  return count;
}

function splitSentences(text: string): string[] {
  return text.split(/[。！？\n]+/).filter(s => s.trim().length > 0);
}

function calcMovingAverage(values: (number | null)[], window: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < window - 1) return null;
    let sum = 0;
    let count = 0;
    for (let j = i - window + 1; j <= i; j++) {
      if (values[j] !== null) {
        sum += values[j]!;
        count++;
      }
    }
    return count > 0 ? sum / count : null;
  });
}

// ── 月次深層分析 ──

export function calcMonthlyDeepAnalysis(entries: DiaryEntry[]): MonthlyDeepAnalysis[] {
  // 月単位でグループ化
  const byMonth = new Map<string, DiaryEntry[]>();
  for (const entry of entries) {
    if (!entry.date) continue;
    const month = entry.date.substring(0, 7);
    const existing = byMonth.get(month) ?? [];
    existing.push(entry);
    byMonth.set(month, existing);
  }

  const months = [...byMonth.keys()].sort();
  const rawResults: MonthlyDeepAnalysis[] = [];

  for (const month of months) {
    const monthEntries = byMonth.get(month)!;
    const allText = monthEntries.map(e => e.content).join('\n');
    const textLength = allText.length;

    // ネガティブ/ポジティブ比率
    const negCount = countWords(allText, allNegativeWords);
    const posCount = countWords(allText, allPositiveWords);
    const total = negCount + posCount;
    const negativeRatio = total > 0 ? negCount / total : 0;

    // 平均文長
    const sentences = splitSentences(allText);
    const avgSentenceLength = sentences.length > 0
      ? sentences.reduce((s, sent) => s + sent.length, 0) / sentences.length
      : 0;

    // 一人称出現率（1000文字あたり）
    const firstPersonCount = countWords(allText, firstPersonWords);
    const firstPersonRate = textLength > 0 ? (firstPersonCount / textLength) * 1000 : 0;

    // 他者参照率（1000文字あたり）
    const otherPersonCount = countWords(allText, otherPersonWords);
    const otherPersonRate = textLength > 0 ? (otherPersonCount / textLength) * 1000 : 0;

    // タスク関連語率（1000文字あたり）
    const taskCount = countWords(allText, taskWords);
    const taskWordRate = textLength > 0 ? (taskCount / textLength) * 1000 : 0;

    // 自己モニタリング語率（1000文字あたり）
    const monitorCount = countWords(allText, selfMonitorWords);
    const selfMonitorRate = textLength > 0 ? (monitorCount / textLength) * 1000 : 0;

    // 身体症状カウント
    const physicalSymptomCount = countWords(allText, physicalSymptomWords);

    // 仕事関連語率（1000文字あたり）
    const workCount = countWords(allText, workWords);
    const workWordRate = textLength > 0 ? (workCount / textLength) * 1000 : 0;

    rawResults.push({
      month,
      negativeRatio,
      negativeRatioMA3: null, // 後で計算
      negativeRatioMA6: null,
      seasonalBaseline: null,
      seasonalDeviation: null,
      entryCount: monthEntries.length,
      avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
      firstPersonRate: Math.round(firstPersonRate * 100) / 100,
      otherPersonRate: Math.round(otherPersonRate * 100) / 100,
      taskWordRate: Math.round(taskWordRate * 100) / 100,
      selfMonitorRate: Math.round(selfMonitorRate * 100) / 100,
      physicalSymptomCount,
      workWordRate: Math.round(workWordRate * 100) / 100,
    });
  }

  // 移動平均を計算
  const negRatios = rawResults.map(r => r.negativeRatio);
  const ma3 = calcMovingAverage(negRatios, 3);
  const ma6 = calcMovingAverage(negRatios, 6);

  for (let i = 0; i < rawResults.length; i++) {
    rawResults[i].negativeRatioMA3 = ma3[i] !== null ? Math.round(ma3[i]! * 1000) / 1000 : null;
    rawResults[i].negativeRatioMA6 = ma6[i] !== null ? Math.round(ma6[i]! * 1000) / 1000 : null;
  }

  // 季節ベースラインを計算（同月の全年平均）
  const byCalendarMonth = new Map<number, number[]>();
  for (const r of rawResults) {
    const cm = parseInt(r.month.substring(5, 7), 10);
    const list = byCalendarMonth.get(cm) ?? [];
    list.push(r.negativeRatio);
    byCalendarMonth.set(cm, list);
  }

  for (const r of rawResults) {
    const cm = parseInt(r.month.substring(5, 7), 10);
    const sameMonthValues = byCalendarMonth.get(cm) ?? [];
    if (sameMonthValues.length >= 2) {
      const baseline = sameMonthValues.reduce((s, v) => s + v, 0) / sameMonthValues.length;
      r.seasonalBaseline = Math.round(baseline * 1000) / 1000;
      r.seasonalDeviation = Math.round((r.negativeRatio - baseline) * 1000) / 1000;
    }
  }

  return rawResults;
}

// ── トレンドベースの転機検出 ──

export function detectTrendShifts(monthly: MonthlyDeepAnalysis[]): TrendShift[] {
  if (monthly.length < 4) return [];

  const shifts: TrendShift[] = [];
  const windowSize = 3; // 3ヶ月ウィンドウで前後比較

  // 全体の標準偏差を計算（閾値用）
  const allNegRatios = monthly.map(m => m.negativeRatio);
  const mean = allNegRatios.reduce((s, v) => s + v, 0) / allNegRatios.length;
  const variance = allNegRatios.reduce((s, v) => s + (v - mean) ** 2, 0) / allNegRatios.length;
  const stdDev = Math.sqrt(variance);
  const threshold = Math.max(0.05, stdDev * 0.8); // 最低5%変動、または0.8σ

  for (let i = windowSize; i <= monthly.length - windowSize; i++) {
    const before = monthly.slice(i - windowSize, i);
    const after = monthly.slice(i, i + windowSize);

    const avgBefore = before.reduce((s, m) => s + m.negativeRatio, 0) / windowSize;
    const avgAfter = after.reduce((s, m) => s + m.negativeRatio, 0) / windowSize;
    const diff = avgAfter - avgBefore;

    // 語彙変化スコア: 一人称率 + 自己モニタリング率 + 文長 の複合変化
    const fpBefore = before.reduce((s, m) => s + m.firstPersonRate, 0) / windowSize;
    const fpAfter = after.reduce((s, m) => s + m.firstPersonRate, 0) / windowSize;
    const slBefore = before.reduce((s, m) => s + m.avgSentenceLength, 0) / windowSize;
    const slAfter = after.reduce((s, m) => s + m.avgSentenceLength, 0) / windowSize;
    const smBefore = before.reduce((s, m) => s + m.selfMonitorRate, 0) / windowSize;
    const smAfter = after.reduce((s, m) => s + m.selfMonitorRate, 0) / windowSize;

    const vocabShift = Math.abs(fpAfter - fpBefore) / Math.max(fpBefore, 0.01) +
      Math.abs(slAfter - slBefore) / Math.max(slBefore, 1) +
      Math.abs(smAfter - smBefore) / Math.max(smBefore, 0.01);

    if (Math.abs(diff) > threshold || vocabShift > 1.5) {
      let type: TrendShift['type'];
      if (diff > threshold) type = 'deterioration';
      else if (diff < -threshold) type = 'recovery';
      else if (vocabShift > 1.5) type = 'vocabulary_shift';
      else type = 'plateau';

      const magnitude = stdDev > 0 ? Math.abs(diff) / stdDev : 0;

      // 近接するシフトをマージ（3ヶ月以内の同種シフト）
      const last = shifts[shifts.length - 1];
      if (last && last.type === type) {
        const lastEnd = monthly.findIndex(m => m.month === last.endMonth);
        if (i - lastEnd <= 3) {
          last.endMonth = after[after.length - 1].month;
          last.magnitude = Math.max(last.magnitude, magnitude);
          continue;
        }
      }

      const description = buildShiftDescription(type, diff, vocabShift, {
        fpBefore, fpAfter, slBefore, slAfter, smBefore, smAfter,
      });

      shifts.push({
        startMonth: before[0].month,
        endMonth: after[after.length - 1].month,
        type,
        magnitude: Math.round(magnitude * 100) / 100,
        metrics: {
          negRatioBefore: Math.round(avgBefore * 1000) / 1000,
          negRatioAfter: Math.round(avgAfter * 1000) / 1000,
          vocabShiftScore: Math.round(vocabShift * 100) / 100,
          sentenceLengthChange: Math.round((slAfter - slBefore) * 10) / 10,
          firstPersonChange: Math.round((fpAfter - fpBefore) * 100) / 100,
        },
        description,
      });
    }
  }

  return shifts;
}

function buildShiftDescription(
  type: TrendShift['type'],
  negDiff: number,
  vocabShift: number,
  rates: { fpBefore: number; fpAfter: number; slBefore: number; slAfter: number; smBefore: number; smAfter: number },
): string {
  const parts: string[] = [];

  if (type === 'deterioration') {
    parts.push(`ネガ率が${Math.round(Math.abs(negDiff) * 100)}pt上昇`);
  } else if (type === 'recovery') {
    parts.push(`ネガ率が${Math.round(Math.abs(negDiff) * 100)}pt低下`);
  }

  if (vocabShift > 1.5) {
    if (rates.fpAfter > rates.fpBefore * 1.3) {
      parts.push('一人称の増加（内向化）');
    } else if (rates.fpAfter < rates.fpBefore * 0.7) {
      parts.push('一人称の減少（外向化・役割意識の強化）');
    }
    if (rates.smAfter < rates.smBefore * 0.5) {
      parts.push('自己モニタリング語の消失');
    } else if (rates.smAfter > rates.smBefore * 1.5) {
      parts.push('自己モニタリング語の増加');
    }
    if (Math.abs(rates.slAfter - rates.slBefore) > 10) {
      parts.push(rates.slAfter > rates.slBefore ? '文章の長文化' : '文章の短文化');
    }
  }

  return parts.join('。') || '変化検出';
}

// ── 季節×指標クロス集計 ──

export function calcSeasonalCrossStats(monthly: MonthlyDeepAnalysis[]): SeasonalCrossStats[] {
  const seasonMap: Record<string, MonthlyDeepAnalysis[]> = {
    spring: [], summer: [], autumn: [], winter: [],
  };

  for (const m of monthly) {
    const cm = parseInt(m.month.substring(5, 7), 10);
    if (cm >= 3 && cm <= 5) seasonMap.spring.push(m);
    else if (cm >= 6 && cm <= 8) seasonMap.summer.push(m);
    else if (cm >= 9 && cm <= 11) seasonMap.autumn.push(m);
    else seasonMap.winter.push(m);
  }

  const labels: Record<string, string> = {
    spring: '春（3-5月）',
    summer: '夏（6-8月）',
    autumn: '秋（9-11月）',
    winter: '冬（12-2月）',
  };

  const results: SeasonalCrossStats[] = [];

  for (const [season, months] of Object.entries(seasonMap)) {
    if (months.length === 0) continue;
    const n = months.length;
    results.push({
      season: season as SeasonalCrossStats['season'],
      seasonLabel: labels[season],
      avgNegativeRatio: Math.round(months.reduce((s, m) => s + m.negativeRatio, 0) / n * 1000) / 1000,
      avgSentenceLength: Math.round(months.reduce((s, m) => s + m.avgSentenceLength, 0) / n * 10) / 10,
      avgWorkWordRate: Math.round(months.reduce((s, m) => s + m.workWordRate, 0) / n * 100) / 100,
      avgPhysicalSymptoms: Math.round(months.reduce((s, m) => s + m.physicalSymptomCount, 0) / n * 10) / 10,
      avgFirstPersonRate: Math.round(months.reduce((s, m) => s + m.firstPersonRate, 0) / n * 100) / 100,
      avgSelfMonitorRate: Math.round(months.reduce((s, m) => s + m.selfMonitorRate, 0) / n * 100) / 100,
      entryCount: months.reduce((s, m) => s + m.entryCount, 0),
      monthCount: n,
    });
  }

  return results;
}

// ── 数値ベースの現在地評価 ──

export function calcCurrentStateNumeric(monthly: MonthlyDeepAnalysis[]): CurrentStateNumeric | null {
  if (monthly.length < 3) return null;

  const recent3 = monthly.slice(-3);
  const historical = monthly.slice(0, -3);

  if (historical.length < 3) return null;

  const avg = (arr: MonthlyDeepAnalysis[], fn: (m: MonthlyDeepAnalysis) => number) =>
    arr.reduce((s, m) => s + fn(m), 0) / arr.length;

  const recentNegRatio = avg(recent3, m => m.negativeRatio);

  // 直近のMAを取得（存在すれば）
  const lastMA = recent3[recent3.length - 1].negativeRatioMA3;

  // ネガ率のトレンド判定: 直近3ヶ月の線形回帰の傾き
  const recentValues = recent3.map(m => m.negativeRatio);
  const slope = linearSlope(recentValues);
  let negRatioTrend: CurrentStateNumeric['negRatioTrend'];
  if (slope < -0.02) negRatioTrend = 'improving';
  else if (slope > 0.02) negRatioTrend = 'worsening';
  else negRatioTrend = 'stable';

  // 複合安定度スコア（0-100）
  const negScore = Math.max(0, 40 - recentNegRatio * 80); // ネガ率低→高スコア
  const symptomScore = Math.max(0, 20 - avg(recent3, m => m.physicalSymptomCount) * 2);
  const stabilityScore = Math.max(0, 20 - calcLocalVolatility(recent3.map(m => m.negativeRatio)) * 100);
  const writingScore = Math.min(20, avg(recent3, m => m.entryCount) * 2);
  const overallStability = Math.round(Math.min(100, negScore + symptomScore + stabilityScore + writingScore));

  // リスクレベル
  let riskLevel: CurrentStateNumeric['riskLevel'];
  if (recentNegRatio > 0.6 || avg(recent3, m => m.physicalSymptomCount) > 5) {
    riskLevel = 'elevated';
  } else if (recentNegRatio > 0.4 || negRatioTrend === 'worsening') {
    riskLevel = 'moderate';
  } else {
    riskLevel = 'low';
  }

  return {
    recentNegRatio: Math.round(recentNegRatio * 1000) / 1000,
    recentNegRatioMA: lastMA ?? recentNegRatio,
    recentSelfDenialRate: Math.round(avg(recent3, m => m.physicalSymptomCount) * 100) / 100,
    recentAvgSentenceLength: Math.round(avg(recent3, m => m.avgSentenceLength) * 10) / 10,
    recentFirstPersonRate: Math.round(avg(recent3, m => m.firstPersonRate) * 100) / 100,
    recentPhysicalSymptoms: Math.round(avg(recent3, m => m.physicalSymptomCount) * 10) / 10,
    recentWorkWordRate: Math.round(avg(recent3, m => m.workWordRate) * 100) / 100,
    historicalNegRatio: Math.round(avg(historical, m => m.negativeRatio) * 1000) / 1000,
    historicalSelfDenialRate: Math.round(avg(historical, m => m.physicalSymptomCount) * 100) / 100,
    historicalAvgSentenceLength: Math.round(avg(historical, m => m.avgSentenceLength) * 10) / 10,
    historicalFirstPersonRate: Math.round(avg(historical, m => m.firstPersonRate) * 100) / 100,
    historicalPhysicalSymptoms: Math.round(avg(historical, m => m.physicalSymptomCount) * 10) / 10,
    negRatioTrend,
    overallStability,
    riskLevel,
  };
}

function linearSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }
  const denom = n * sumXX - sumX * sumX;
  return denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
}

function calcLocalVolatility(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// ── 予測指標 ──

export function calcPredictiveIndicators(
  monthly: MonthlyDeepAnalysis[],
  entries: DiaryEntry[],
): PredictiveIndicator {
  const precursorWords: PredictiveIndicator['precursorWords'] = [];
  const activeSignals: PredictiveIndicator['activeSignals'] = [];
  const symptomCorrelations: PredictiveIndicator['symptomCorrelations'] = [];

  // 1. 前兆語の抽出: ネガ率が急上昇した月の「前月」に頻出した語を特定
  const candidatePrecursors = [
    ...physicalSymptomWords.slice(0, 15),
    '不安', '眠れない', '疲れ', 'だるい', 'イライラ', 'ストレス',
    '仕事', '残業', '締切',
  ];

  for (let i = 1; i < monthly.length; i++) {
    const curr = monthly[i];
    const prev = monthly[i - 1];
    const spike = curr.negativeRatio - prev.negativeRatio;

    if (spike > 0.15) { // ネガ率が15pt以上急上昇
      // 前月のテキストから前兆語をカウント
      const prevEntries = entries.filter(e => e.date?.startsWith(prev.month));
      const prevText = prevEntries.map(e => e.content).join('\n');

      for (const word of candidatePrecursors) {
        const count = countWords(prevText, [word]);
        if (count > 0) {
          const existing = precursorWords.find(p => p.word === word);
          if (existing) {
            existing.correlation = Math.min(1, existing.correlation + 0.2);
          } else {
            precursorWords.push({ word, leadDays: 30, correlation: 0.3 });
          }
        }
      }
    }
  }

  // 相関が高い順にソート、上位10個
  precursorWords.sort((a, b) => b.correlation - a.correlation);
  precursorWords.splice(10);

  // 2. 直近のリスクシグナル検出
  if (monthly.length >= 2) {
    const latest = monthly[monthly.length - 1];
    const prev = monthly[monthly.length - 2];

    // 身体症状の増加
    if (latest.physicalSymptomCount > prev.physicalSymptomCount * 1.5 && latest.physicalSymptomCount >= 3) {
      activeSignals.push({
        signal: '身体症状の増加',
        severity: latest.physicalSymptomCount >= 5 ? 'warning' : 'caution',
        evidence: `前月${prev.physicalSymptomCount}件→今月${latest.physicalSymptomCount}件`,
      });
    }

    // 一人称率の急変
    if (Math.abs(latest.firstPersonRate - prev.firstPersonRate) > prev.firstPersonRate * 0.5) {
      activeSignals.push({
        signal: latest.firstPersonRate > prev.firstPersonRate ? '内向性の増大' : '自己参照の減少',
        severity: 'watch',
        evidence: `一人称率 ${prev.firstPersonRate.toFixed(1)}→${latest.firstPersonRate.toFixed(1)}（/1000字）`,
      });
    }

    // 文章の極端な短文化
    if (latest.avgSentenceLength < prev.avgSentenceLength * 0.6) {
      activeSignals.push({
        signal: '文章の短文化',
        severity: 'caution',
        evidence: `平均文長 ${prev.avgSentenceLength.toFixed(0)}→${latest.avgSentenceLength.toFixed(0)}字`,
      });
    }

    // 記述頻度の激減
    if (latest.entryCount < prev.entryCount * 0.3 && prev.entryCount >= 5) {
      activeSignals.push({
        signal: '記述頻度の急減',
        severity: 'caution',
        evidence: `前月${prev.entryCount}件→今月${latest.entryCount}件`,
      });
    }

    // 自己モニタリング語の消失（④の指摘）
    if (prev.selfMonitorRate > 0.5 && latest.selfMonitorRate < 0.1) {
      activeSignals.push({
        signal: '自己モニタリング語の消失',
        severity: 'watch',
        evidence: `「調子」等の語が消失（${prev.selfMonitorRate.toFixed(1)}→${latest.selfMonitorRate.toFixed(1)}/1000字）`,
      });
    }

    // 前兆語の検出（直近テキスト内）
    const latestEntries = entries.filter(e => e.date?.startsWith(latest.month));
    const latestText = latestEntries.map(e => e.content).join('\n');
    for (const p of precursorWords.slice(0, 5)) {
      if (countWords(latestText, [p.word]) > 0) {
        activeSignals.push({
          signal: `前兆語「${p.word}」を検出`,
          severity: p.correlation > 0.6 ? 'caution' : 'watch',
          evidence: `過去のネガ率急上昇前に出現傾向（相関 ${p.correlation.toFixed(1)}）`,
        });
      }
    }
  }

  // 3. 身体症状と感情の遅延相関
  if (monthly.length >= 4) {
    // 身体症状が多い月の1-2ヶ月後のネガ率を比較
    const highSymptomMonths: number[] = [];
    const avgSymptoms = monthly.reduce((s, m) => s + m.physicalSymptomCount, 0) / monthly.length;

    for (let i = 0; i < monthly.length - 2; i++) {
      if (monthly[i].physicalSymptomCount > avgSymptoms * 1.5) {
        highSymptomMonths.push(i);
      }
    }

    if (highSymptomMonths.length >= 2) {
      // 1ヶ月遅延の相関
      let lag1Sum = 0;
      for (const idx of highSymptomMonths) {
        if (idx + 1 < monthly.length) {
          lag1Sum += monthly[idx + 1].negativeRatio - monthly[idx].negativeRatio;
        }
      }
      const lag1Avg = lag1Sum / highSymptomMonths.length;

      if (lag1Avg > 0.03) {
        symptomCorrelations.push({
          symptom: '身体症状全般',
          emotionalLag: 30,
          strength: Math.min(1, Math.round(lag1Avg * 10 * 100) / 100),
        });
      }
    }
  }

  return { precursorWords, activeSignals, symptomCorrelations };
}

// ── 語彙深度分析（期間比較用） ──

export function calcVocabularyDepth(entries: DiaryEntry[], periodLabel: string): VocabularyDepth {
  const allText = entries.map(e => e.content).join('\n');
  const sentences = splitSentences(allText);

  const lightNeg = countWords(allText, lightNegativeWords);
  const deepNeg = countWords(allText, deepNegativeWords);
  const fp = countWords(allText, firstPersonWords);
  const op = countWords(allText, otherPersonWords);

  const questionCount = (allText.match(/？/g) ?? []).length + (allText.match(/\?/g) ?? []).length;
  const exclamationCount = (allText.match(/！/g) ?? []).length + (allText.match(/!/g) ?? []).length;

  return {
    period: periodLabel,
    lightNegCount: lightNeg,
    deepNegCount: deepNeg,
    depthRatio: (lightNeg + deepNeg) > 0 ? deepNeg / (lightNeg + deepNeg) : 0,
    firstPersonCount: fp,
    otherPersonCount: op,
    subjectRatio: (fp + op) > 0 ? op / (fp + op) : 0,
    avgSentenceLength: sentences.length > 0
      ? Math.round(sentences.reduce((s, sent) => s + sent.length, 0) / sentences.length * 10) / 10
      : 0,
    questionCount,
    exclamationCount,
  };
}

// ── AIプロンプト注入用フォーマッター ──

export function formatDeepStatsForPrompt(
  _monthly: MonthlyDeepAnalysis[],
  shifts: TrendShift[],
  seasonal: SeasonalCrossStats[],
  currentState: CurrentStateNumeric | null,
  predictive: PredictiveIndicator,
): string {
  const lines: string[] = [];

  // 1. トレンドベースの転機データ
  if (shifts.length > 0) {
    lines.push('【実測データ: トレンドベースの変化検出】');
    lines.push('以下は3ヶ月移動ウィンドウで検出した統計的に有意な変化。単発の文章ではなく、傾向として確認済み：');
    for (const s of shifts) {
      lines.push(`  ${s.startMonth}〜${s.endMonth}: ${s.description}（変化量 ${s.magnitude}σ）`);
      lines.push(`    ネガ率 ${Math.round(s.metrics.negRatioBefore * 100)}%→${Math.round(s.metrics.negRatioAfter * 100)}% / 一人称変化 ${s.metrics.firstPersonChange > 0 ? '+' : ''}${s.metrics.firstPersonChange} / 文長変化 ${s.metrics.sentenceLengthChange > 0 ? '+' : ''}${s.metrics.sentenceLengthChange}字`);
    }
    lines.push('→ 転機判定はこのデータに基づくこと。単一の文章から転機を推測するな。');
    lines.push('');
  }

  // 2. 季節クロス集計
  if (seasonal.length > 0) {
    lines.push('【実測データ: 季節×指標クロス集計】');
    for (const s of seasonal) {
      lines.push(`  ${s.seasonLabel}（${s.monthCount}ヶ月分）:`);
      lines.push(`    ネガ率 ${Math.round(s.avgNegativeRatio * 100)}% / 仕事語率 ${s.avgWorkWordRate}/1000字 / 身体症状 ${s.avgPhysicalSymptoms}件/月 / 一人称率 ${s.avgFirstPersonRate}/1000字 / 自己モニタリング率 ${s.avgSelfMonitorRate}/1000字`);
    }
    lines.push('→ 季節分析はこの数値に基づくこと。「春は芽吹き」のような詩的表現に逃げるな。数字が語る季節を見ろ。');
    lines.push('');
  }

  // 3. 現在地の数値評価
  if (currentState) {
    lines.push('【実測データ: 現在地の数値評価】');
    lines.push(`  直近3ヶ月ネガ率: ${Math.round(currentState.recentNegRatio * 100)}%（全期間平均: ${Math.round(currentState.historicalNegRatio * 100)}%）`);
    lines.push(`  3ヶ月移動平均: ${Math.round(currentState.recentNegRatioMA * 100)}%`);
    lines.push(`  トレンド: ${currentState.negRatioTrend === 'improving' ? '改善傾向' : currentState.negRatioTrend === 'worsening' ? '悪化傾向' : '安定'}`);
    lines.push(`  複合安定度: ${currentState.overallStability}/100`);
    lines.push(`  リスクレベル: ${currentState.riskLevel}`);
    lines.push(`  一人称率: ${currentState.recentFirstPersonRate}/1000字（全期間: ${currentState.historicalFirstPersonRate}/1000字）`);
    lines.push(`  身体症状: ${currentState.recentPhysicalSymptoms}件/月（全期間: ${currentState.historicalPhysicalSymptoms}件/月）`);
    lines.push(`  平均文長: ${currentState.recentAvgSentenceLength}字（全期間: ${currentState.historicalAvgSentenceLength}字）`);
    lines.push('→ 「穏やか」「不安定」の判定はこの数値に基づくこと。AIの主観で判定するな。');
    lines.push('');
  }

  // 4. 予測シグナル
  if (predictive.activeSignals.length > 0) {
    lines.push('【実測データ: 予測シグナル】');
    for (const sig of predictive.activeSignals) {
      const icon = sig.severity === 'warning' ? '⚠' : sig.severity === 'caution' ? '△' : '○';
      lines.push(`  ${icon} ${sig.signal}: ${sig.evidence}`);
    }
    lines.push('');
  }

  if (predictive.symptomCorrelations.length > 0) {
    lines.push('【実測データ: 身体症状と感情の遅延相関】');
    for (const corr of predictive.symptomCorrelations) {
      lines.push(`  ${corr.symptom}: 約${corr.emotionalLag}日後にネガ率変動（相関強度 ${corr.strength}）`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// 語彙深度の比較テキスト生成（AIプロンプト注入用）
export function formatVocabularyDepthForPrompt(early: VocabularyDepth, late: VocabularyDepth): string {
  const lines: string[] = [];
  lines.push('【実測データ: 語彙深度の変化】');
  lines.push(`  前期（${early.period}）:`);
  lines.push(`    軽度ネガ語 ${early.lightNegCount}回 / 深度ネガ語 ${early.deepNegCount}回 / 深度比 ${Math.round(early.depthRatio * 100)}%`);
  lines.push(`    一人称 ${early.firstPersonCount}回 / 他者参照 ${early.otherPersonCount}回 / 他者比率 ${Math.round(early.subjectRatio * 100)}%`);
  lines.push(`    平均文長 ${early.avgSentenceLength}字 / 疑問文 ${early.questionCount}回 / 感嘆文 ${early.exclamationCount}回`);
  lines.push(`  後期（${late.period}）:`);
  lines.push(`    軽度ネガ語 ${late.lightNegCount}回 / 深度ネガ語 ${late.deepNegCount}回 / 深度比 ${Math.round(late.depthRatio * 100)}%`);
  lines.push(`    一人称 ${late.firstPersonCount}回 / 他者参照 ${late.otherPersonCount}回 / 他者比率 ${Math.round(late.subjectRatio * 100)}%`);
  lines.push(`    平均文長 ${late.avgSentenceLength}字 / 疑問文 ${late.questionCount}回 / 感嘆文 ${late.exclamationCount}回`);

  // 変化の解釈ガイド
  const depthChange = late.depthRatio - early.depthRatio;
  const subjectChange = late.subjectRatio - early.subjectRatio;

  lines.push('  変化のポイント:');
  if (Math.abs(depthChange) > 0.1) {
    lines.push(depthChange > 0
      ? '    → ネガティブ語が「深く」なっている（軽い不満→深い苦悩）。単純な「ポジティブ増＝成長」判定は危険'
      : '    → ネガティブ語が「浅く」なっている（深い苦悩→軽い不満）。これは回復の可能性');
  }
  if (Math.abs(subjectChange) > 0.1) {
    lines.push(subjectChange > 0
      ? '    → 他者参照が増加。社会的役割意識の強化、または本音を書かなくなった可能性'
      : '    → 一人称優位に変化。内省の深化、または社会的撤退の可能性');
  }
  lines.push('→ ポジティブ語の増加＝成長と安易に結論づけるな。上記データで質を検証せよ。');
  lines.push('');

  return lines.join('\n');
}
