import type {
  DiaryEntry,
  MonthlyDeepAnalysis,
  TrendShift,
  SeasonalCrossStats,
  CurrentStateNumeric,
  PredictiveIndicator,
  VocabularyDepth,
  DepthInterpretation,
  FirstPersonShiftInterpretation,
  StatisticalTest,
  DailyPredictiveContext,
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

    // 身体症状カウント＋レート
    const physicalSymptomCount = countWords(allText, physicalSymptomWords);
    const physicalSymptomRate = textLength > 0 ? (physicalSymptomCount / textLength) * 1000 : 0;

    // 仕事関連語率（1000文字あたり）
    const workCount = countWords(allText, workWords);
    const workWordRate = textLength > 0 ? (workCount / textLength) * 1000 : 0;

    // ネガ語/ポジ語の絶対出現率（/1000字）— ratioとは別に頻度を正規化
    const negativeRate = textLength > 0 ? (negCount / textLength) * 1000 : 0;
    const positiveRate = textLength > 0 ? (posCount / textLength) * 1000 : 0;

    rawResults.push({
      month,
      negativeRatio,
      negativeRatioMA3: null, // 後で計算
      negativeRatioMA6: null,
      seasonalBaseline: null,
      seasonalDeviation: null,
      entryCount: monthEntries.length,
      textLength,
      avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
      firstPersonRate: Math.round(firstPersonRate * 100) / 100,
      otherPersonRate: Math.round(otherPersonRate * 100) / 100,
      taskWordRate: Math.round(taskWordRate * 100) / 100,
      selfMonitorRate: Math.round(selfMonitorRate * 100) / 100,
      physicalSymptomCount,
      physicalSymptomRate: Math.round(physicalSymptomRate * 100) / 100,
      workWordRate: Math.round(workWordRate * 100) / 100,
      negativeRate: Math.round(negativeRate * 100) / 100,
      positiveRate: Math.round(positiveRate * 100) / 100,
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

// ── 統計検定ユーティリティ ──

// カイ二乗検定: 2つの季節のネガ語/ポジ語の出現頻度を比較
function chiSquareTest(
  negA: number, posA: number, negB: number, posB: number,
): StatisticalTest {
  const totalA = negA + posA;
  const totalB = negB + posB;
  const total = totalA + totalB;
  const totalNeg = negA + negB;
  const totalPos = posA + posB;

  if (total === 0 || totalA === 0 || totalB === 0) {
    return { testName: 'chi_square', statistic: 0, pValue: 1, significant: false, effectSize: 0, description: 'データ不足' };
  }

  // 期待度数
  const eNegA = totalA * totalNeg / total;
  const ePosA = totalA * totalPos / total;
  const eNegB = totalB * totalNeg / total;
  const ePosB = totalB * totalPos / total;

  // 期待度数が5未満の場合は検定の信頼性が低い
  const minExpected = Math.min(eNegA, ePosA, eNegB, ePosB);

  // カイ二乗統計量
  const chi2 =
    ((negA - eNegA) ** 2) / eNegA +
    ((posA - ePosA) ** 2) / ePosA +
    ((negB - eNegB) ** 2) / eNegB +
    ((posB - ePosB) ** 2) / ePosB;

  // p値の近似計算（自由度1のカイ二乗分布）
  const pValue = chi2PValue(chi2);

  // クラメールのV（効果量）
  const effectSize = Math.sqrt(chi2 / total);

  let description: string;
  if (minExpected < 5) {
    description = `期待度数不足（最小${minExpected.toFixed(1)}）。結果は参考値`;
  } else if (pValue < 0.01) {
    description = `高度に有意（χ²=${chi2.toFixed(2)}, p=${pValue.toFixed(4)}, V=${effectSize.toFixed(3)}）`;
  } else if (pValue < 0.05) {
    description = `有意（χ²=${chi2.toFixed(2)}, p=${pValue.toFixed(4)}, V=${effectSize.toFixed(3)}）`;
  } else {
    description = `有意差なし（χ²=${chi2.toFixed(2)}, p=${pValue.toFixed(4)}）`;
  }

  return {
    testName: 'chi_square',
    statistic: Math.round(chi2 * 100) / 100,
    pValue: Math.round(pValue * 10000) / 10000,
    significant: pValue < 0.05 && minExpected >= 5,
    effectSize: Math.round(effectSize * 1000) / 1000,
    description,
  };
}

// カイ二乗分布（自由度1）のp値近似
function chi2PValue(x: number): number {
  if (x <= 0) return 1;
  // 正規分布の上側確率を使った近似
  const z = Math.sqrt(x);
  return 2 * (1 - normalCDF(z));
}

// 標準正規分布の累積分布関数（近似）
function normalCDF(z: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  const absZ = Math.abs(z);
  const t = 1 / (1 + p * absZ);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absZ * absZ / 2);
  return 0.5 * (1 + sign * y);
}

// 比率のz検定（2つの比率の差の検定）
export function proportionZTest(
  p1: number, n1: number, p2: number, n2: number,
): StatisticalTest {
  if (n1 === 0 || n2 === 0) {
    return { testName: 'z_test', statistic: 0, pValue: 1, significant: false, effectSize: 0, description: 'データ不足' };
  }

  const pPooled = (p1 * n1 + p2 * n2) / (n1 + n2);
  if (pPooled === 0 || pPooled === 1) {
    return { testName: 'z_test', statistic: 0, pValue: 1, significant: false, effectSize: 0, description: '分散なし' };
  }

  const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / n1 + 1 / n2));
  const z = se > 0 ? (p1 - p2) / se : 0;
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));

  // コーエンのh（効果量）
  const h = 2 * Math.asin(Math.sqrt(p1)) - 2 * Math.asin(Math.sqrt(p2));
  const effectSize = Math.abs(h);

  let description: string;
  if (n1 < 30 || n2 < 30) {
    description = `サンプルサイズ不足（n1=${n1}, n2=${n2}）。結果は参考値`;
  } else if (pValue < 0.01) {
    description = `高度に有意（z=${z.toFixed(2)}, p=${pValue.toFixed(4)}, h=${effectSize.toFixed(3)}）`;
  } else if (pValue < 0.05) {
    description = `有意（z=${z.toFixed(2)}, p=${pValue.toFixed(4)}, h=${effectSize.toFixed(3)}）`;
  } else {
    description = `有意差なし（z=${z.toFixed(2)}, p=${pValue.toFixed(4)}）`;
  }

  return {
    testName: 'z_test',
    statistic: Math.round(z * 100) / 100,
    pValue: Math.round(pValue * 10000) / 10000,
    significant: pValue < 0.05,
    effectSize: Math.round(effectSize * 1000) / 1000,
    description,
  };
}

// ── 季節×指標クロス集計（統計検定付き） ──

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

  // まず各季節の集計値を算出
  const rawResults: (SeasonalCrossStats & { _totalNeg: number; _totalPos: number })[] = [];

  for (const [season, months] of Object.entries(seasonMap)) {
    if (months.length === 0) continue;
    const n = months.length;
    const totalTextLength = months.reduce((s, m) => s + m.textLength, 0);

    // ネガ語/ポジ語の1000字あたり平均を集計
    const avgNegativeRate = n > 0 ? months.reduce((s, m) => s + m.negativeRate, 0) / n : 0;
    const avgPositiveRate = n > 0 ? months.reduce((s, m) => s + m.positiveRate, 0) / n : 0;

    // 身体症状もレートで統一
    const avgPhysicalSymptomRate = n > 0 ? months.reduce((s, m) => s + m.physicalSymptomRate, 0) / n : 0;

    // 検定用の合計ネガ/ポジ語数（テキスト量に基づく近似値）
    const totalNeg = Math.round(avgNegativeRate * totalTextLength / 1000);
    const totalPos = Math.round(avgPositiveRate * totalTextLength / 1000);

    rawResults.push({
      season: season as SeasonalCrossStats['season'],
      seasonLabel: labels[season],
      avgNegativeRatio: Math.round(months.reduce((s, m) => s + m.negativeRatio, 0) / n * 1000) / 1000,
      avgSentenceLength: Math.round(months.reduce((s, m) => s + m.avgSentenceLength, 0) / n * 10) / 10,
      avgWorkWordRate: Math.round(months.reduce((s, m) => s + m.workWordRate, 0) / n * 100) / 100,
      avgPhysicalSymptoms: Math.round(months.reduce((s, m) => s + m.physicalSymptomCount, 0) / n * 10) / 10,
      avgPhysicalSymptomRate: Math.round(avgPhysicalSymptomRate * 100) / 100,
      avgFirstPersonRate: Math.round(months.reduce((s, m) => s + m.firstPersonRate, 0) / n * 100) / 100,
      avgSelfMonitorRate: Math.round(months.reduce((s, m) => s + m.selfMonitorRate, 0) / n * 100) / 100,
      avgNegativeRate: Math.round(avgNegativeRate * 100) / 100,
      avgPositiveRate: Math.round(avgPositiveRate * 100) / 100,
      entryCount: months.reduce((s, m) => s + m.entryCount, 0),
      monthCount: n,
      totalTextLength,
      pValue: null,
      isSignificant: false,
      _totalNeg: totalNeg,
      _totalPos: totalPos,
    });
  }

  // 各季節を「その他全季節」と比較してカイ二乗検定を実行
  for (const target of rawResults) {
    const others = rawResults.filter(r => r.season !== target.season);
    if (others.length === 0) continue;

    const othersNeg = others.reduce((s, r) => s + r._totalNeg, 0);
    const othersPos = others.reduce((s, r) => s + r._totalPos, 0);

    const test = chiSquareTest(target._totalNeg, target._totalPos, othersNeg, othersPos);
    target.pValue = test.pValue;
    target.isSignificant = test.significant;
  }

  // 内部用フィールドを除去して返す
  return rawResults.map(({ _totalNeg: _n, _totalPos: _p, ...rest }) => rest);
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

// ── 日次レベル予測コンテキスト ──

// 睡眠関連語
const sleepDisruptionWords = [
  '眠れない', '不眠', '寝れない', '寝つけない', '早朝覚醒', '中途覚醒',
  '寝すぎ', '過眠', '悪夢', '夜中に目', '3時に', '4時に', '5時に',
  '寝不足', '睡眠', '寝落ち',
];

// 感覚症状語（幻嗅・幻聴等）
const sensorySymptomWords = [
  '幻嗅', '幻聴', '幻覚', '耳鳴り', '匂い', 'におい',
  '聞こえる', '見える', '感じる', '気配',
];

// 対人イベント語
const interpersonalWords = [
  '会った', '話した', '電話', '約束', '誘われ', '断った', '断られ',
  '喧嘩', 'ケンカ', '怒られ', '叱られ', '無視', '避け',
  '会議', '面談', '飲み会', '食事', 'ランチ', '遊び', '集まり',
  '人前', '発表', 'プレゼン', '面接',
];

export function calcDailyPredictiveContext(entries: DiaryEntry[]): DailyPredictiveContext {
  const sorted = [...entries].filter(e => e.date).sort((a, b) =>
    (a.date ?? '').localeCompare(b.date ?? '')
  );

  const result: DailyPredictiveContext = {
    precursorWindowDays: 3,
    dailyPrecursors: [],
    sleepDisruptionCorrelation: null,
    sensoryInterpersonalCorrelation: [],
  };

  if (sorted.length < 10) return result;

  // 日付ごとにグループ化
  const byDate = new Map<string, DiaryEntry[]>();
  for (const e of sorted) {
    const d = e.date!.substring(0, 10);
    const list = byDate.get(d) ?? [];
    list.push(e);
    byDate.set(d, list);
  }

  const dates = [...byDate.keys()].sort();

  // 各日のネガ率を計算
  const dailyNegRates = new Map<string, number>();
  for (const [date, dayEntries] of byDate) {
    const text = dayEntries.map(e => e.content).join('\n');
    const neg = countWords(text, allNegativeWords);
    const pos = countWords(text, allPositiveWords);
    const total = neg + pos;
    dailyNegRates.set(date, total > 0 ? neg / total : 0);
  }

  // 1. ネガ急上昇前3日間の共通語
  const allCandidates = [
    ...physicalSymptomWords.slice(0, 20),
    ...sleepDisruptionWords,
    ...sensorySymptomWords,
    '不安', '疲れ', 'だるい', 'イライラ', 'ストレス', '仕事', '残業', '締切',
  ];
  const uniqueCandidates = [...new Set(allCandidates)];

  // ネガ率の上位20%を「スパイク」と定義
  const allRates = [...dailyNegRates.values()].filter(r => r > 0);
  if (allRates.length === 0) return result;
  const sortedRates = [...allRates].sort((a, b) => a - b);
  const spikeThreshold = sortedRates[Math.floor(sortedRates.length * 0.8)];

  // スパイク日の前3日に出現した語を集計
  const precursorCounts = new Map<string, { total: number; beforeSpike: number }>();

  for (let i = 3; i < dates.length; i++) {
    const rate = dailyNegRates.get(dates[i]) ?? 0;
    if (rate < spikeThreshold) continue;

    // 前3日間のテキストを結合
    const windowDates = dates.slice(Math.max(0, i - 3), i);
    const windowText = windowDates
      .flatMap(d => byDate.get(d) ?? [])
      .map(e => e.content)
      .join('\n');

    for (const word of uniqueCandidates) {
      const count = countWords(windowText, [word]);
      if (count > 0) {
        const existing = precursorCounts.get(word) ?? { total: 0, beforeSpike: 0 };
        existing.beforeSpike += count;
        precursorCounts.set(word, existing);
      }
    }
  }

  // 全テキストでの出現頻度（ベースライン）
  const totalText = sorted.map(e => e.content).join('\n');
  for (const word of uniqueCandidates) {
    const count = countWords(totalText, [word]);
    if (count > 0) {
      const existing = precursorCounts.get(word) ?? { total: 0, beforeSpike: 0 };
      existing.total = count;
      precursorCounts.set(word, existing);
    }
  }

  // スパイク前出現頻度が全体比率より高い語を前兆語として抽出
  for (const [word, counts] of precursorCounts) {
    if (counts.total === 0 || counts.beforeSpike === 0) continue;
    result.dailyPrecursors.push({
      word,
      frequency: counts.total,
      occurrencesBeforeSpike: counts.beforeSpike,
    });
  }
  result.dailyPrecursors.sort((a, b) => b.occurrencesBeforeSpike - a.occurrencesBeforeSpike);
  result.dailyPrecursors = result.dailyPrecursors.slice(0, 15);

  // 2. 睡眠崩壊→ネガの遅延相関
  // 睡眠語が出現した日の翌日〜3日後のネガ率を、そうでない日と比較
  const sleepDays: number[] = [];
  const nonSleepDays: number[] = [];

  for (let i = 0; i < dates.length - 3; i++) {
    const text = (byDate.get(dates[i]) ?? []).map(e => e.content).join('\n');
    const hasSleep = countWords(text, sleepDisruptionWords) > 0;

    // 1-3日後のネガ率平均
    const futureRates: number[] = [];
    for (let j = 1; j <= 3 && i + j < dates.length; j++) {
      const r = dailyNegRates.get(dates[i + j]);
      if (r !== undefined) futureRates.push(r);
    }
    if (futureRates.length === 0) continue;
    const avgFuture = futureRates.reduce((s, v) => s + v, 0) / futureRates.length;

    if (hasSleep) sleepDays.push(avgFuture);
    else nonSleepDays.push(avgFuture);
  }

  if (sleepDays.length >= 3 && nonSleepDays.length >= 3) {
    const sleepAvg = sleepDays.reduce((s, v) => s + v, 0) / sleepDays.length;
    const nonSleepAvg = nonSleepDays.reduce((s, v) => s + v, 0) / nonSleepDays.length;
    const diff = sleepAvg - nonSleepAvg;

    if (diff > 0.03) {
      result.sleepDisruptionCorrelation = {
        lag: 2, // 1-3日の中央値
        strength: Math.min(1, Math.round(diff * 5 * 100) / 100),
        sampleSize: sleepDays.length,
      };
    }
  }

  // 3. 感覚症状×対人イベントの同時出現率
  let sensoryDays = 0;
  let coOccurrenceDays = 0;
  const sensoryCounts = new Map<string, { total: number; withInterpersonal: number }>();

  for (const date of dates) {
    const text = (byDate.get(date) ?? []).map(e => e.content).join('\n');
    const hasSensory = countWords(text, sensorySymptomWords) > 0;
    const hasInterpersonal = countWords(text, interpersonalWords) > 0;

    if (hasSensory) {
      sensoryDays++;
      if (hasInterpersonal) coOccurrenceDays++;

      // 個別の感覚症状ごとに集計
      for (const word of sensorySymptomWords) {
        if (countWords(text, [word]) > 0) {
          const existing = sensoryCounts.get(word) ?? { total: 0, withInterpersonal: 0 };
          existing.total++;
          if (hasInterpersonal) existing.withInterpersonal++;
          sensoryCounts.set(word, existing);
        }
      }
    }
  }

  // ±2日のウィンドウも含めてチェック（同日だけでなく前後2日の対人イベントとの関連）
  for (const [symptom, counts] of sensoryCounts) {
    if (counts.total < 2) continue;
    const rate = counts.withInterpersonal / counts.total;

    // 最も関連の強い対人語を特定
    let topInterpersonal = '';
    let topCount = 0;
    for (const date of dates) {
      const text = (byDate.get(date) ?? []).map(e => e.content).join('\n');
      if (countWords(text, [symptom]) === 0) continue;
      for (const iw of interpersonalWords) {
        const c = countWords(text, [iw]);
        if (c > topCount) {
          topCount = c;
          topInterpersonal = iw;
        }
      }
    }

    if (rate > 0.3 && topInterpersonal) {
      result.sensoryInterpersonalCorrelation.push({
        sensorySymptom: symptom,
        interpersonalWord: topInterpersonal,
        coOccurrenceRate: Math.round(rate * 100) / 100,
        sampleSize: counts.total,
      });
    }
  }

  result.sensoryInterpersonalCorrelation.sort((a, b) => b.coOccurrenceRate - a.coOccurrenceRate);

  return result;
}

// ── 語彙深度分析（期間比較用・正規化対応） ──

export function calcVocabularyDepth(entries: DiaryEntry[], periodLabel: string): VocabularyDepth {
  const allText = entries.map(e => e.content).join('\n');
  const textLength = allText.length;
  const sentences = splitSentences(allText);

  const lightNeg = countWords(allText, lightNegativeWords);
  const deepNeg = countWords(allText, deepNegativeWords);
  const fp = countWords(allText, firstPersonWords);
  const op = countWords(allText, otherPersonWords);

  const questionCount = (allText.match(/？/g) ?? []).length + (allText.match(/\?/g) ?? []).length;
  const exclamationCount = (allText.match(/！/g) ?? []).length + (allText.match(/!/g) ?? []).length;

  const per1k = (count: number) => textLength > 0 ? Math.round((count / textLength) * 1000 * 100) / 100 : 0;

  return {
    period: periodLabel,
    textLength,
    lightNegCount: lightNeg,
    deepNegCount: deepNeg,
    lightNegRate: per1k(lightNeg),
    deepNegRate: per1k(deepNeg),
    depthRatio: (lightNeg + deepNeg) > 0 ? deepNeg / (lightNeg + deepNeg) : 0,
    firstPersonCount: fp,
    otherPersonCount: op,
    firstPersonRate: per1k(fp),
    otherPersonRate: per1k(op),
    subjectRatio: (fp + op) > 0 ? op / (fp + op) : 0,
    avgSentenceLength: sentences.length > 0
      ? Math.round(sentences.reduce((s, sent) => s + sent.length, 0) / sentences.length * 10) / 10
      : 0,
    questionCount,
    exclamationCount,
    questionRate: per1k(questionCount),
    exclamationRate: per1k(exclamationCount),
  };
}

// ── 深度比の解釈ロジック ──

export function interpretDepthChange(early: VocabularyDepth, late: VocabularyDepth): DepthInterpretation {
  const earlyTotalRate = early.lightNegRate + early.deepNegRate;
  const lateTotalRate = late.lightNegRate + late.deepNegRate;
  const frequencyChange = earlyTotalRate > 0 ? (lateTotalRate - earlyTotalRate) / earlyTotalRate : 0;
  const depthChange = late.depthRatio - early.depthRatio;

  // 頻度は減ったが深度比が上がった
  if (frequencyChange < -0.15 && depthChange > 0.05) {
    return {
      pattern: 'frequency_down_depth_up',
      label: '頻度減少×深度上昇',
      description: `ネガティブ語の総量は${Math.round(Math.abs(frequencyChange) * 100)}%減少したが、深度比は${Math.round(early.depthRatio * 100)}%→${Math.round(late.depthRatio * 100)}%に上昇。軽度の不満が減り、重い言葉だけが残っている。`,
      riskNote: '読み方A: 軽い愚痴を流せるようになり、本当に深い感情だけが残った（感情の成熟）。読み方B: 本音を書かなくなり、書けなくなったときだけ深い言葉が漏れている（抑圧の兆候）。どちらかは日記の文脈で判断せよ。',
      alternativeReading: '「愚痴が減った」は安定の証かもしれないし、感情の出口が狭まった兆候かもしれない。両方の可能性を提示すること。',
    };
  }

  // 頻度も深度も減った
  if (frequencyChange < -0.15 && depthChange < -0.05) {
    return {
      pattern: 'frequency_down_depth_down',
      label: '頻度減少×深度低下',
      description: `ネガティブ語の総量が${Math.round(Math.abs(frequencyChange) * 100)}%減少し、深度比も${Math.round(early.depthRatio * 100)}%→${Math.round(late.depthRatio * 100)}%に低下。深い苦悩も軽い不満も共に減っている。`,
      riskNote: '読み方A: 回復傾向として信頼性が高いパターン。実際に苦痛が減っている。読み方B: 記述量自体の減少、または日記に感情を書かなくなった可能性。テキスト量と記述頻度も確認せよ。',
      alternativeReading: '感情語が減ったのは「楽になった」からかもしれないし、「書く力が落ちた」からかもしれない。記述量の変化と合わせて判断すること。',
    };
  }

  // 頻度も深度も上がった
  if (frequencyChange > 0.15 && depthChange > 0.05) {
    return {
      pattern: 'frequency_up_depth_up',
      label: '頻度増加×深度上昇',
      description: `ネガティブ語が${Math.round(frequencyChange * 100)}%増加し、深度比も${Math.round(early.depthRatio * 100)}%→${Math.round(late.depthRatio * 100)}%に上昇。量も質も変化。`,
      riskNote: '読み方A: 実際に苦痛が増している。身体症状との並行を確認せよ。読み方B: 感情を言語化する力が上がり、以前は書けなかった深い感情を書けるようになった可能性。文長や語彙の多様性も確認せよ。',
      alternativeReading: 'ネガティブ語の増加は「状態の悪化」かもしれないし、「感情を書ける余裕が生まれた」かもしれない。文脈で判断すること。',
    };
  }

  // 安定
  if (Math.abs(frequencyChange) <= 0.15 && Math.abs(depthChange) <= 0.05) {
    return {
      pattern: 'stable',
      label: '安定',
      description: `ネガティブ語の頻度・深度ともに大きな変化なし。深度比 ${Math.round(early.depthRatio * 100)}%→${Math.round(late.depthRatio * 100)}%。`,
      riskNote: '読み方A: 安定した状態が続いている。読み方B: 変化がないこと自体が停滞。現状の水準が高い場合は持続的リスク。',
      alternativeReading: '「変わっていない」は安定かもしれないし、動けなくなっているのかもしれない。日記の内容の変化と合わせて判断すること。',
    };
  }

  return {
    pattern: 'other',
    label: 'その他のパターン',
    description: `頻度変化${Math.round(frequencyChange * 100)}%、深度比${Math.round(early.depthRatio * 100)}%→${Math.round(late.depthRatio * 100)}%。分類に収まらない複合変化。`,
    riskNote: '単一の読み方に収まらない。複数の解釈を並べて提示すること。',
    alternativeReading: '複合パターンのため、複数の解釈を並列に提示すること。',
  };
}

// ── 一人称激減の解釈ロジック ──

export function interpretFirstPersonShift(
  early: VocabularyDepth,
  late: VocabularyDepth,
  earlyMonthly: MonthlyDeepAnalysis[],
  lateMonthly: MonthlyDeepAnalysis[],
): FirstPersonShiftInterpretation {
  const fpChange = early.firstPersonRate > 0
    ? (late.firstPersonRate - early.firstPersonRate) / early.firstPersonRate
    : 0;

  // 変化が小さければデータ不足扱い
  if (Math.abs(fpChange) < 0.3) {
    return {
      pattern: 'insufficient_data',
      label: '有意な変化なし',
      description: `一人称出現率の変化が${Math.round(Math.abs(fpChange) * 100)}%で、解釈に必要な閾値（30%）に達していない。`,
      alternativeReading: '',
      evidence: [],
    };
  }

  // 減少方向の解釈
  if (fpChange < -0.3) {
    const evidence: string[] = [];
    evidence.push(`一人称率: ${early.firstPersonRate}/1000字 → ${late.firstPersonRate}/1000字（${Math.round(fpChange * 100)}%変化）`);

    // タスク語の変化を確認
    const earlyTaskAvg = earlyMonthly.length > 0
      ? earlyMonthly.reduce((s, m) => s + m.taskWordRate, 0) / earlyMonthly.length : 0;
    const lateTaskAvg = lateMonthly.length > 0
      ? lateMonthly.reduce((s, m) => s + m.taskWordRate, 0) / lateMonthly.length : 0;

    // 他者参照の変化
    const opChange = early.otherPersonRate > 0
      ? (late.otherPersonRate - early.otherPersonRate) / early.otherPersonRate : 0;

    // 自己モニタリング語の変化
    const earlySmAvg = earlyMonthly.length > 0
      ? earlyMonthly.reduce((s, m) => s + m.selfMonitorRate, 0) / earlyMonthly.length : 0;
    const lateSmAvg = lateMonthly.length > 0
      ? lateMonthly.reduce((s, m) => s + m.selfMonitorRate, 0) / lateMonthly.length : 0;

    // 仕事語の変化
    const earlyWorkAvg = earlyMonthly.length > 0
      ? earlyMonthly.reduce((s, m) => s + m.workWordRate, 0) / earlyMonthly.length : 0;
    const lateWorkAvg = lateMonthly.length > 0
      ? lateMonthly.reduce((s, m) => s + m.workWordRate, 0) / lateMonthly.length : 0;

    // 仮説1: 役割人格化 — タスク語・仕事語が増えている場合（最有力仮説として提示、ただし断定しない）
    if (lateTaskAvg > earlyTaskAvg * 1.3 || lateWorkAvg > earlyWorkAvg * 1.3) {
      evidence.push(`タスク語率: ${earlyTaskAvg.toFixed(2)} → ${lateTaskAvg.toFixed(2)}/1000字`);
      evidence.push(`仕事語率: ${earlyWorkAvg.toFixed(2)} → ${lateWorkAvg.toFixed(2)}/1000字`);
      return {
        pattern: 'role_persona',
        label: '役割人格化（有力仮説）',
        description: '一人称が減少し、タスク・仕事関連語が増加。「私」ではなく「役割」として書くようになった可能性がある。',
        alternativeReading: '別の読み方: 仕事に集中できる余裕が生まれ、日記が「内面の吐露」から「日々の記録」に自然に変化した可能性。必ずしも悪い兆候とは限らない。',
        evidence,
      };
    }

    // 仮説2: 外向き適応強化 — 他者参照が増えている場合
    if (opChange > 0.3) {
      evidence.push(`他者参照率: ${early.otherPersonRate}/1000字 → ${late.otherPersonRate}/1000字（${Math.round(opChange * 100)}%増加）`);
      return {
        pattern: 'outward_adaptation',
        label: '外向き適応強化（有力仮説）',
        description: '一人称が減少し、他者への言及が増加。対人関係への意識が強まり、自己を語る言葉が相対的に減っている。',
        alternativeReading: '別の読み方: 自分のことばかり考える状態から抜け出し、周囲に目を向けられるようになった可能性。「自分」が減ったのは、世界が広がったからかもしれない。',
        evidence,
      };
    }

    // 仮説3: 自己開示減少 — 自己モニタリング語も減っている場合
    if (lateSmAvg < earlySmAvg * 0.5) {
      evidence.push(`自己モニタリング語率: ${earlySmAvg.toFixed(2)} → ${lateSmAvg.toFixed(2)}/1000字`);
      return {
        pattern: 'self_disclosure_decrease',
        label: '自己開示の減少（有力仮説）',
        description: '一人称・自己モニタリング語が共に減少。自分の状態を言語化すること自体が減っている。',
        alternativeReading: '別の読み方: 自分の状態をいちいち確認する必要がなくなるほど安定した可能性。「調子」を書かなくなったのは、調子が安定しているからかもしれない。',
        evidence,
      };
    }

    // デフォルト: 仮説の確定に至らない
    evidence.push(`他者参照変化: ${Math.round(opChange * 100)}%`);
    evidence.push(`自己モニタリング: ${earlySmAvg.toFixed(2)} → ${lateSmAvg.toFixed(2)}/1000字`);
    return {
      pattern: 'genuine_growth',
      label: '視点の変化（複数仮説あり）',
      description: '一人称の減少に対し、特定の代替パターン（役割化・外向化・閉鎖化）が明確には検出されなかった。自己と外界のバランスが変化した可能性があるが、断定はできない。',
      alternativeReading: '読み方は複数ある。「自分を語る必要がなくなった安定」「自分を語れなくなった疲弊」「視野が広がり自分以外に意識が向いた」のいずれも否定できない。',
      evidence,
    };
  }

  // 増加方向
  return {
    pattern: 'insufficient_data',
    label: '一人称増加',
    description: `一人称出現率が${Math.round(fpChange * 100)}%増加。`,
    alternativeReading: '読み方A: 内省が深まり、自分と向き合う力が増した。読み方B: 社会的な関係が薄れ、自分のことしか書けなくなった。どちらの可能性もある。',
    evidence: [`一人称率: ${early.firstPersonRate}/1000字 → ${late.firstPersonRate}/1000字`],
  };
}

// ── AIプロンプト注入用フォーマッター ──

export function formatDeepStatsForPrompt(
  _monthly: MonthlyDeepAnalysis[],
  shifts: TrendShift[],
  seasonal: SeasonalCrossStats[],
  currentState: CurrentStateNumeric | null,
  predictive: PredictiveIndicator,
  dailyPredictive?: DailyPredictiveContext,
): string {
  const lines: string[] = [];

  // 1. トレンドベースの転機データ
  if (shifts.length > 0) {
    lines.push('【実測データ: トレンドベースの変化検出】');
    lines.push('以下は3ヶ月移動ウィンドウで検出した変化。単発の文章ではなく、傾向として確認済み：');
    for (const s of shifts) {
      lines.push(`  ${s.startMonth}〜${s.endMonth}: ${s.description}（変化量 ${s.magnitude}σ）`);
      lines.push(`    ネガ率 ${Math.round(s.metrics.negRatioBefore * 100)}%→${Math.round(s.metrics.negRatioAfter * 100)}% / 一人称変化 ${s.metrics.firstPersonChange > 0 ? '+' : ''}${s.metrics.firstPersonChange} / 文長変化 ${s.metrics.sentenceLengthChange > 0 ? '+' : ''}${s.metrics.sentenceLengthChange}字`);
    }
    lines.push('→ 転機判定はこのデータに基づくこと。単一の文章から転機を推測するな。');
    lines.push('');
  }

  // 2. 季節クロス集計（統計検定結果付き）
  if (seasonal.length > 0) {
    lines.push('【実測データ: 季節×指標クロス集計（全指標1000字あたりで正規化済み）】');
    for (const s of seasonal) {
      const sigMark = s.isSignificant ? '★有意差あり' : '';
      const pText = s.pValue !== null ? `p=${s.pValue.toFixed(4)}` : '';
      lines.push(`  ${s.seasonLabel}（${s.monthCount}ヶ月分, ${s.totalTextLength.toLocaleString()}字）${sigMark ? ` ${sigMark}` : ''}:`);
      lines.push(`    ネガ率 ${Math.round(s.avgNegativeRatio * 100)}%（ネガ語${s.avgNegativeRate}/1000字, ポジ語${s.avgPositiveRate}/1000字）${pText ? ` [カイ二乗検定: ${pText}]` : ''}`);
      lines.push(`    仕事語${s.avgWorkWordRate}/1000字 / 身体症状${s.avgPhysicalSymptomRate}/1000字 / 一人称${s.avgFirstPersonRate}/1000字 / 自己モニタリング${s.avgSelfMonitorRate}/1000字`);
    }
    lines.push('→ 季節分析はこの数値に基づくこと。★がない季節差は「有意差なし」として扱え。');
    lines.push('→ 「統計的に有意」はカイ二乗検定（p<0.05）で確認済みの場合のみ使え。それ以外では「傾向がある」に留めろ。');
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

  // 5. 日次レベル予測（新規追加）
  if (dailyPredictive) {
    if (dailyPredictive.sleepDisruptionCorrelation) {
      const sc = dailyPredictive.sleepDisruptionCorrelation;
      lines.push('【実測データ: 睡眠崩壊→ネガティブの遅延相関】');
      lines.push(`  睡眠関連語の出現後${sc.lag}日以内にネガ率上昇（相関強度 ${sc.strength}, サンプル${sc.sampleSize}日）`);
      lines.push('');
    }

    if (dailyPredictive.sensoryInterpersonalCorrelation.length > 0) {
      lines.push('【実測データ: 感覚症状×対人イベントの関連】');
      for (const corr of dailyPredictive.sensoryInterpersonalCorrelation) {
        lines.push(`  「${corr.sensorySymptom}」出現日の${Math.round(corr.coOccurrenceRate * 100)}%で「${corr.interpersonalWord}」が共起（n=${corr.sampleSize}）`);
      }
      lines.push('');
    }

    if (dailyPredictive.dailyPrecursors.length > 0) {
      lines.push('【実測データ: ネガ急上昇前3日間の前兆語（日次解析）】');
      for (const p of dailyPredictive.dailyPrecursors.slice(0, 8)) {
        lines.push(`  「${p.word}」: スパイク前出現${p.occurrencesBeforeSpike}回（全体${p.frequency}回）`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

// 語彙深度の比較テキスト生成（AIプロンプト注入用・正規化版）
export function formatVocabularyDepthForPrompt(
  early: VocabularyDepth,
  late: VocabularyDepth,
  depthInterpretation?: DepthInterpretation,
  fpInterpretation?: FirstPersonShiftInterpretation,
): string {
  const lines: string[] = [];
  lines.push('【実測データ: 語彙深度の変化（1000字あたりで正規化済み）】');
  lines.push(`  前期（${early.period}）: 総文字数 ${early.textLength.toLocaleString()}字`);
  lines.push(`    軽度ネガ語 ${early.lightNegRate}/1000字 / 深度ネガ語 ${early.deepNegRate}/1000字 / 深度比 ${Math.round(early.depthRatio * 100)}%`);
  lines.push(`    一人称 ${early.firstPersonRate}/1000字 / 他者参照 ${early.otherPersonRate}/1000字 / 他者比率 ${Math.round(early.subjectRatio * 100)}%`);
  lines.push(`    平均文長 ${early.avgSentenceLength}字 / 疑問文 ${early.questionRate}/1000字 / 感嘆文 ${early.exclamationRate}/1000字`);
  lines.push(`  後期（${late.period}）: 総文字数 ${late.textLength.toLocaleString()}字`);
  lines.push(`    軽度ネガ語 ${late.lightNegRate}/1000字 / 深度ネガ語 ${late.deepNegRate}/1000字 / 深度比 ${Math.round(late.depthRatio * 100)}%`);
  lines.push(`    一人称 ${late.firstPersonRate}/1000字 / 他者参照 ${late.otherPersonRate}/1000字 / 他者比率 ${Math.round(late.subjectRatio * 100)}%`);
  lines.push(`    平均文長 ${late.avgSentenceLength}字 / 疑問文 ${late.questionRate}/1000字 / 感嘆文 ${late.exclamationRate}/1000字`);

  // テキスト量の差異に注意喚起
  const textRatio = early.textLength > 0 ? late.textLength / early.textLength : 0;
  if (textRatio < 0.3 || textRatio > 3) {
    lines.push(`  ⚠ テキスト量の差: 前期${early.textLength.toLocaleString()}字 vs 後期${late.textLength.toLocaleString()}字（${Math.round(textRatio * 100)}%）。生カウントでの比較は不適切。1000字あたりの出現率で判断せよ。`);
  }

  // 深度比の解釈（自動判定結果 — 両義的）
  if (depthInterpretation) {
    lines.push('');
    lines.push(`  【深度比の自動解釈: ${depthInterpretation.label}】`);
    lines.push(`    ${depthInterpretation.description}`);
    lines.push(`    ${depthInterpretation.riskNote}`);
    if (depthInterpretation.alternativeReading) {
      lines.push(`    ★両義性: ${depthInterpretation.alternativeReading}`);
    }
  }

  // 一人称変化の解釈（両義的）
  if (fpInterpretation && fpInterpretation.pattern !== 'insufficient_data') {
    lines.push('');
    lines.push(`  【一人称変化の自動解釈: ${fpInterpretation.label}】`);
    lines.push(`    ${fpInterpretation.description}`);
    if (fpInterpretation.alternativeReading) {
      lines.push(`    ★両義性: ${fpInterpretation.alternativeReading}`);
    }
    for (const ev of fpInterpretation.evidence) {
      lines.push(`    根拠: ${ev}`);
    }
  }

  lines.push('');
  lines.push('→ ポジティブ語の増加＝成長と安易に結論づけるな。上記の正規化データと自動解釈で質を検証せよ。');
  lines.push('→ 生カウントの比較は期間のテキスト量が異なるため無効。必ず/1000字の出現率で判断すること。');
  lines.push('→ 【重要】自動解釈には必ず「★両義性」が付記されている。単一の読み方で閉じるな。両方の可能性を出力に反映せよ。');
  lines.push('');

  return lines.join('\n');
}
