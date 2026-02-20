import type { DiaryEntry, EmotionAnalysis, EmotionAnalysisDaily, StabilityIndex, ElevationPoint, ElevationPointMonthly, ElevationPointDaily, ResilienceMetrics } from '../types';

// 感情ワード辞書（日本語）
const negativeWords = [
  '辛い', 'つらい', '苦しい', '悲しい', '寂しい', '怖い',
  '不安', '孤独', '絶望', '死にたい', '消えたい', '無理',
  '嫌だ', '嫌い', '最悪', '地獄', '痛い', '泣', '涙',
  '疲れ', '限界', '逃げたい', 'しんどい', 'だるい', '憂鬱',
  '鬱', '落ち込', '暗い', '重い', '苦手', '怒り', '腹が立つ',
  'イライラ', 'ストレス', '後悔', '失敗', '惨め', '情けない',
];

const selfDenialWords = [
  '自分が嫌', '自分なんか', '価値がない', 'どうせ', '無価値',
  '存在意義', '生きてる意味', 'いらない人間', '迷惑',
  'ダメな', '何もできない', '役に立たない', '自己嫌悪',
  '自分のせい', '自分が悪い', '能力がない', '才能がない',
];

const positiveWords = [
  '嬉しい', '楽しい', '幸せ', '好き', '感謝', 'ありがとう',
  '笑', '元気', '希望', '安心', '心地よい', '穏やか',
  '面白い', '素敵', '美しい', '温かい', '優しい', '喜び',
  '達成', '成功', '前向き', '光', '明るい', '自由',
];

function countOccurrences(text: string, words: string[]): number {
  let count = 0;
  for (const word of words) {
    const regex = new RegExp(word, 'g');
    const matches = text.match(regex);
    if (matches) count += matches.length;
  }
  return count;
}

function getEmotionWordCounts(text: string): { word: string; count: number }[] {
  const allWords = [...negativeWords, ...positiveWords];
  const counts: { word: string; count: number }[] = [];
  for (const word of allWords) {
    const regex = new RegExp(word, 'g');
    const matches = text.match(regex);
    if (matches && matches.length > 0) {
      counts.push({ word, count: matches.length });
    }
  }
  return counts.sort((a, b) => b.count - a.count);
}

export function analyzeEntries(entries: DiaryEntry[]): EmotionAnalysis[] {
  // 月単位でグループ化
  const byMonth = new Map<string, DiaryEntry[]>();

  for (const entry of entries) {
    if (!entry.date) continue;
    const month = entry.date.substring(0, 7); // YYYY-MM
    const existing = byMonth.get(month) ?? [];
    existing.push(entry);
    byMonth.set(month, existing);
  }

  const results: EmotionAnalysis[] = [];

  for (const [month, monthEntries] of byMonth) {
    const allText = monthEntries.map(e => e.content).join('\n');
    const negCount = countOccurrences(allText, negativeWords);
    const posCount = countOccurrences(allText, positiveWords);
    const total = negCount + posCount;
    const negativeRatio = total > 0 ? negCount / total : 0;
    const selfDenialCount = countOccurrences(allText, selfDenialWords);
    const topEmotionWords = getEmotionWordCounts(allText).slice(0, 10);

    results.push({
      month,
      negativeRatio,
      selfDenialCount,
      topEmotionWords,
    });
  }

  return results.sort((a, b) => a.month.localeCompare(b.month));
}

// 年単位の安定指数を算出（0-100）
export function calcStabilityByYear(monthlyAnalysis: EmotionAnalysis[]): StabilityIndex[] {
  // 年ごとにグループ化
  const byYear = new Map<string, EmotionAnalysis[]>();
  for (const a of monthlyAnalysis) {
    const year = a.month.substring(0, 4);
    const list = byYear.get(year) ?? [];
    list.push(a);
    byYear.set(year, list);
  }

  const results: StabilityIndex[] = [];

  for (const [year, months] of byYear) {
    if (months.length === 0) continue;

    // 1. ポジティブ比率（ネガティブ比率の反転）の平均
    const avgNegRatio = months.reduce((s, m) => s + m.negativeRatio, 0) / months.length;
    const positiveRatio = 1 - avgNegRatio;

    // 2. 感情のばらつき（ネガティブ比率の標準偏差）
    const variance = months.length > 1
      ? months.reduce((s, m) => s + (m.negativeRatio - avgNegRatio) ** 2, 0) / months.length
      : 0;
    const volatility = Math.sqrt(variance);

    // 3. 月平均自己否定語数
    const selfDenialAvg = months.reduce((s, m) => s + m.selfDenialCount, 0) / months.length;

    // スコア算出:
    // - ポジティブ比率が高い → +（最大40点）
    // - ばらつきが小さい → +（最大30点）
    // - 自己否定語が少ない → +（最大30点）
    const positiveScore = positiveRatio * 40;
    const stabilityScore = Math.max(0, 30 - volatility * 150); // σ=0.2で0点
    const denialScore = Math.max(0, 30 - selfDenialAvg * 3); // 月10回で0点

    const score = Math.round(Math.min(100, Math.max(0, positiveScore + stabilityScore + denialScore)));

    results.push({ year, score, positiveRatio, volatility, selfDenialAvg });
  }

  return results.sort((a, b) => a.year.localeCompare(b.year));
}

// 年単位の累積標高を算出
// 思想: 安定度50が中立点。50超なら登る、50未満なら落ちる。
// 書き続けたことには少しだけ価値があるが、それだけでは登れない。
// 最悪の年は滑落する。嘘をつかない。
export function calcElevationByYear(
  stability: StabilityIndex[],
  entries: DiaryEntry[],
): ElevationPoint[] {
  if (stability.length === 0) return [];

  // 年ごとのエントリ数
  const countByYear = new Map<string, number>();
  for (const e of entries) {
    if (!e.date) continue;
    const y = e.date.substring(0, 4);
    countByYear.set(y, (countByYear.get(y) ?? 0) + 1);
  }

  const sorted = [...stability].sort((a, b) => a.year.localeCompare(b.year));
  const results: ElevationPoint[] = [];
  let cumulative = 1000; // 基準点 1000m

  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    const entryCount = countByYear.get(s.year) ?? 0;

    // 書いた量による控えめなボーナス（最大30m）— 書いただけでは救われない
    const writingBonus = Math.min(30, Math.max(0, entryCount * 0.3));

    // 安定度スコアによる変動: 50が中立点
    // score 100 → +150m, score 50 → 0m, score 0 → -150m
    const stabilityDelta = (s.score - 50) * 3;

    // 前年比の変化ボーナス/ペナルティ
    let changeDelta = 0;
    if (i > 0) {
      const prev = sorted[i - 1];
      const scoreDiff = s.score - prev.score;
      // 改善も悪化もそのまま反映（最大±30m）
      changeDelta = Math.max(-30, Math.min(30, scoreDiff * 0.5));
    }

    // 年間変動量（マイナスあり）
    const rawClimb = writingBonus + stabilityDelta + changeDelta;
    const climb = Math.round(Math.max(-150, Math.min(250, rawClimb)));
    const isSlide = climb < 0;

    cumulative += climb;
    results.push({ year: s.year, elevation: cumulative, climb, isSlide });
  }

  return results;
}

// 月単位の累積標高を算出（滑落あり）
// ネガ率50%が中立。それ以上なら落ちる、以下なら登る。
export function calcElevationByMonth(
  monthlyAnalysis: EmotionAnalysis[],
  entries: DiaryEntry[],
): ElevationPointMonthly[] {
  if (monthlyAnalysis.length === 0) return [];

  // 月ごとのエントリ数
  const countByMonth = new Map<string, number>();
  for (const e of entries) {
    if (!e.date) continue;
    const m = e.date.substring(0, 7);
    countByMonth.set(m, (countByMonth.get(m) ?? 0) + 1);
  }

  const sorted = [...monthlyAnalysis].sort((a, b) => a.month.localeCompare(b.month));
  const results: ElevationPointMonthly[] = [];
  let cumulative = 1000;

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    const entryCount = countByMonth.get(a.month) ?? 0;

    // 書いた量（控えめ。最大2.5m）
    const writingBonus = Math.min(2.5, Math.max(0, entryCount * 0.2));

    // ネガ率による変動: 0.5が中立（0m）、0→+12m、1→-12m
    const emotionDelta = (0.5 - a.negativeRatio) * 24;

    // 自己否定語ペナルティ（多ければ引く）
    const denialPenalty = Math.min(3, a.selfDenialCount * 0.3);

    // 前月比の変化
    let changeDelta = 0;
    if (i > 0) {
      const prev = sorted[i - 1];
      const diff = prev.negativeRatio - a.negativeRatio; // 改善ならプラス
      changeDelta = Math.max(-3, Math.min(3, diff * 15));
    }

    // 月間変動量（マイナスあり）
    const rawClimb = writingBonus + emotionDelta - denialPenalty + changeDelta;
    const climb = Math.round(Math.max(-15, Math.min(20, rawClimb)));
    const isSlide = climb < 0;

    cumulative += climb;
    results.push({ month: a.month, elevation: cumulative, climb, isSlide });
  }

  return results;
}

// 1日おきの感情分析
// 日記がある日を抽出し、1日おきにサンプリングして分析する
export function analyzeEntriesEveryOtherDay(entries: DiaryEntry[]): EmotionAnalysisDaily[] {
  const byDate = new Map<string, DiaryEntry[]>();

  for (const entry of entries) {
    if (!entry.date) continue;
    const date = entry.date.substring(0, 10); // YYYY-MM-DD
    const existing = byDate.get(date) ?? [];
    existing.push(entry);
    byDate.set(date, existing);
  }

  const sortedDates = [...byDate.keys()].sort();
  const results: EmotionAnalysisDaily[] = [];

  for (let i = 0; i < sortedDates.length; i += 2) { // 1日おき
    const date = sortedDates[i];
    const dateEntries = byDate.get(date)!;
    const allText = dateEntries.map(e => e.content).join('\n');
    const negCount = countOccurrences(allText, negativeWords);
    const posCount = countOccurrences(allText, positiveWords);
    const total = negCount + posCount;
    const negativeRatio = total > 0 ? negCount / total : 0;
    const selfDenialCount = countOccurrences(allText, selfDenialWords);
    const topEmotionWords = getEmotionWordCounts(allText).slice(0, 10);

    results.push({ date, negativeRatio, selfDenialCount, topEmotionWords });
  }

  return results;
}

// 1日おきの累積標高を算出（滑落あり）
export function calcElevationEveryOtherDay(
  dailyAnalysis: EmotionAnalysisDaily[],
  entries: DiaryEntry[],
): ElevationPointDaily[] {
  if (dailyAnalysis.length === 0) return [];

  const countByDate = new Map<string, number>();
  for (const e of entries) {
    if (!e.date) continue;
    const d = e.date.substring(0, 10);
    countByDate.set(d, (countByDate.get(d) ?? 0) + 1);
  }

  const sorted = [...dailyAnalysis].sort((a, b) => a.date.localeCompare(b.date));
  const results: ElevationPointDaily[] = [];
  let cumulative = 1000;

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    const entryCount = countByDate.get(a.date) ?? 0;

    // 書いた量（控えめ。最大0.15m）
    const writingBonus = Math.min(0.15, Math.max(0, entryCount * 0.1));

    // ネガ率による変動: 0.5が中立、0→+0.8m、1→-0.8m
    const emotionDelta = (0.5 - a.negativeRatio) * 1.6;

    // 自己否定語ペナルティ
    const denialPenalty = Math.min(0.2, a.selfDenialCount * 0.02);

    // 前回比の変化
    let changeDelta = 0;
    if (i > 0) {
      const prev = sorted[i - 1];
      const diff = prev.negativeRatio - a.negativeRatio;
      changeDelta = Math.max(-0.2, Math.min(0.2, diff * 1.0));
    }

    // 日次変動量（マイナスあり）
    const rawClimb = writingBonus + emotionDelta - denialPenalty + changeDelta;
    const climb = Math.round(Math.max(-1.0, Math.min(1.2, rawClimb)) * 10) / 10;
    const isSlide = climb < 0;

    cumulative = Math.round((cumulative + climb) * 10) / 10;
    results.push({ date: a.date, elevation: cumulative, climb, isSlide });
  }

  return results;
}

// 期間別の感情統計を算出（AI分析への注入用）
export interface PeriodEmotionStats {
  period: string; // YYYY-MM or YYYY
  entryCount: number;
  negativeRatio: number;
  positiveRatio: number;
  selfDenialCount: number;
  writingFrequency: number; // entries per month
  topNegativeWords: string[];
  topPositiveWords: string[];
}

export function calcPeriodStats(entries: DiaryEntry[]): PeriodEmotionStats[] {
  const byMonth = new Map<string, DiaryEntry[]>();
  for (const e of entries) {
    if (!e.date) continue;
    const month = e.date.substring(0, 7);
    const list = byMonth.get(month) ?? [];
    list.push(e);
    byMonth.set(month, list);
  }

  const results: PeriodEmotionStats[] = [];
  for (const [month, monthEntries] of [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const allText = monthEntries.map(e => e.content).join('\n');
    const negCount = countOccurrences(allText, negativeWords);
    const posCount = countOccurrences(allText, positiveWords);
    const total = negCount + posCount;
    const negRatio = total > 0 ? negCount / total : 0;
    const selfDenial = countOccurrences(allText, selfDenialWords);

    const negWordCounts = negativeWords
      .map(w => ({ word: w, count: (allText.match(new RegExp(w, 'g')) ?? []).length }))
      .filter(x => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(x => x.word);
    const posWordCounts = positiveWords
      .map(w => ({ word: w, count: (allText.match(new RegExp(w, 'g')) ?? []).length }))
      .filter(x => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(x => x.word);

    results.push({
      period: month,
      entryCount: monthEntries.length,
      negativeRatio: Math.round(negRatio * 100) / 100,
      positiveRatio: Math.round((1 - negRatio) * 100) / 100,
      selfDenialCount: selfDenial,
      writingFrequency: monthEntries.length,
      topNegativeWords: negWordCounts,
      topPositiveWords: posWordCounts,
    });
  }
  return results;
}

// 期間統計をやわらかいテキストに変換（プロンプト注入用）
// 数値を直接出さず、天気や空気感として表現する
export function formatPeriodStatsForPrompt(stats: PeriodEmotionStats[]): string {
  if (stats.length === 0) return '';

  // 半年ごとに集約して大きな変動を見せる
  const byHalf = new Map<string, PeriodEmotionStats[]>();
  for (const s of stats) {
    const year = s.period.substring(0, 4);
    const month = parseInt(s.period.substring(5, 7), 10);
    const half = month <= 6 ? `${year}前半` : `${year}後半`;
    const list = byHalf.get(half) ?? [];
    list.push(s);
    byHalf.set(half, list);
  }

  // ネガティブ率を天気に変換
  const toWeather = (negRatio: number): string => {
    if (negRatio >= 0.6) return '嵐の日が多かった';
    if (negRatio >= 0.45) return '曇りがちだった';
    if (negRatio >= 0.3) return '雲と晴れ間が交互だった';
    if (negRatio >= 0.15) return '晴れ間が増えてきた';
    return '穏やかな空が続いた';
  };

  // 記述頻度を活動量に変換
  const toActivity = (avgEntries: number): string => {
    if (avgEntries >= 15) return 'よく書いていた';
    if (avgEntries >= 8) return 'ときどき書いていた';
    if (avgEntries >= 3) return '静かに書いていた';
    return '筆が止まりがちだった';
  };

  const lines: string[] = ['【この山の天気の移り変わり】'];
  for (const [half, periods] of [...byHalf.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const avgNeg = periods.reduce((s, p) => s + p.negativeRatio, 0) / periods.length;
    const totalEntries = periods.reduce((s, p) => s + p.entryCount, 0);
    const avgEntries = totalEntries / periods.length;

    lines.push(
      `${half}: ${toWeather(avgNeg)}。${toActivity(avgEntries)}`
    );
  }
  return lines.join('\n');
}

// 直近の感情状態と過去の平均を比較し、プロンプト注入用テキストを生成
// ハルシネーション防止: AIが「穏やかな現在」を無視して過去のネガティブ情報を引っ張るのを防ぐ
export interface RecentStateContext {
  isRecentCalm: boolean;     // 直近が穏やかかどうか
  recentNegRatio: number;    // 直近のネガティブ率
  historicalNegRatio: number; // 全期間のネガティブ率
  recentSelfDenial: number;  // 直近の自己否定語月平均
  historicalSelfDenial: number; // 全期間の自己否定語月平均
  promptText: string;        // プロンプトに注入するテキスト
}

export function calcRecentStateContext(entries: DiaryEntry[]): RecentStateContext {
  const sorted = [...entries].filter(e => e.date).sort((a, b) =>
    (a.date ?? '').localeCompare(b.date ?? '')
  );

  if (sorted.length === 0) {
    return {
      isRecentCalm: false,
      recentNegRatio: 0,
      historicalNegRatio: 0,
      recentSelfDenial: 0,
      historicalSelfDenial: 0,
      promptText: '',
    };
  }

  // 最新の日付から3ヶ月以内をrecentとする
  const latestDate = new Date(sorted[sorted.length - 1].date!);
  const threeMonthsAgo = new Date(latestDate);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const cutoffStr = threeMonthsAgo.toISOString().substring(0, 10);

  const recentEntries = sorted.filter(e => e.date! >= cutoffStr);
  const olderEntries = sorted.filter(e => e.date! < cutoffStr);

  // 直近のエントリが少なすぎる場合はコンテキストを生成しない
  // ただし直近1件でもあれば現在の状態は伝える（材料が少ないからと見逃さない）
  if (recentEntries.length < 1 || olderEntries.length < 1) {
    return {
      isRecentCalm: false,
      recentNegRatio: 0,
      historicalNegRatio: 0,
      recentSelfDenial: 0,
      historicalSelfDenial: 0,
      promptText: '',
    };
  }

  const calcStats = (group: DiaryEntry[]) => {
    const allText = group.map(e => e.content).join('\n');
    const negCount = countOccurrences(allText, negativeWords);
    const posCount = countOccurrences(allText, positiveWords);
    const total = negCount + posCount;
    const negRatio = total > 0 ? negCount / total : 0;
    const selfDenial = countOccurrences(allText, selfDenialWords);
    // 月数で割って月平均を算出
    const months = new Set(group.map(e => e.date!.substring(0, 7))).size;
    const selfDenialPerMonth = months > 0 ? selfDenial / months : 0;
    return { negRatio, selfDenialPerMonth };
  };

  const recent = calcStats(recentEntries);
  const historical = calcStats(olderEntries);

  // 直近が穏やかかどうかの判定:
  // ネガティブ率が全期間平均より10ポイント以上低い、または
  // ネガティブ率が30%未満かつ自己否定語が月平均2回未満
  const isRecentCalm =
    (recent.negRatio < historical.negRatio - 0.10) ||
    (recent.negRatio < 0.30 && recent.selfDenialPerMonth < 2);

  let promptText = '';
  if (isRecentCalm) {
    const recentPct = Math.round(recent.negRatio * 100);
    const histPct = Math.round(historical.negRatio * 100);
    promptText = [
      `【直近の状態（実測値）】直近3ヶ月のネガティブ率は${recentPct}%（全期間平均: ${histPct}%）。自己否定語は月平均${recent.selfDenialPerMonth.toFixed(1)}回（全期間: ${historical.selfDenialPerMonth.toFixed(1)}回）。`,
      '→ 直近は安定期・穏やかな時期にある。',
      '',
      '【穏やかな時期のハルシネーション防止ルール】',
      '- 直近が穏やかである場合、過去の辛い出来事を「今も続いている」かのように描写するな',
      '- 過去のネガティブな記述を無理に現在と結びつけてドラマチックな物語を作るな',
      '- 「何も起きていない穏やかさ」は分析の失敗ではない。それ自体が重要なデータである',
      '- 穏やかな時期に「実は裏では…」「本当は…」と深読みして存在しない苦悩を作り出すな',
      '- 過去に辛い時期があったとしても、それが「今」に影響しているかは日記に明記されている場合のみ言及せよ',
    ].join('\n');
  }

  return {
    isRecentCalm,
    recentNegRatio: recent.negRatio,
    historicalNegRatio: historical.negRatio,
    recentSelfDenial: recent.selfDenialPerMonth,
    historicalSelfDenial: historical.selfDenialPerMonth,
    promptText,
  };
}

// ── 回復力（レジリエンス）算出 ──
// 滑落からどれだけ速く、どれだけ深く回復したかを測る
export function calcResilience(elevationPoints: { climb: number; isSlide: boolean }[]): ResilienceMetrics {
  const slides: { startIdx: number; depth: number; recoveryPeriods: number | null }[] = [];
  let inSlide = false;
  let slideStart = -1;
  let slideDepth = 0;

  for (let i = 0; i < elevationPoints.length; i++) {
    const p = elevationPoints[i];

    if (p.isSlide) {
      if (!inSlide) {
        inSlide = true;
        slideStart = i;
        slideDepth = 0;
      }
      slideDepth += Math.abs(p.climb);
    } else {
      if (inSlide) {
        // 滑落終了。回復までの期間を測る
        let recoveryPeriods: number | null = null;
        let recovered = 0;
        for (let j = i; j < elevationPoints.length; j++) {
          if (elevationPoints[j].climb > 0) {
            recovered += elevationPoints[j].climb;
          }
          if (recovered >= slideDepth * 0.5) {
            recoveryPeriods = j - i + 1;
            break;
          }
        }

        slides.push({ startIdx: slideStart, depth: slideDepth, recoveryPeriods });
        inSlide = false;
      }
    }
  }

  // 最後まで滑落中だった場合
  if (inSlide) {
    slides.push({ startIdx: slideStart, depth: slideDepth, recoveryPeriods: null });
  }

  if (slides.length === 0) {
    return {
      deepestSlide: null,
      avgRecoveryPeriods: null,
      recoveryRatio: null,
      slideCount: 0,
      totalSlideDepth: 0,
    };
  }

  const deepest = slides.reduce((max, s) => s.depth > max.depth ? s : max, slides[0]);
  const recoveredSlides = slides.filter(s => s.recoveryPeriods !== null);
  const avgRecovery = recoveredSlides.length > 0
    ? recoveredSlides.reduce((s, sl) => s + sl.recoveryPeriods!, 0) / recoveredSlides.length
    : null;

  const totalSlideDepth = slides.reduce((s, sl) => s + sl.depth, 0);
  const totalRecovery = elevationPoints
    .filter(p => p.climb > 0)
    .reduce((s, p) => s + p.climb, 0);
  const recoveryRatio = totalSlideDepth > 0 ? Math.min(1, totalRecovery / totalSlideDepth) : null;

  return {
    deepestSlide: { period: `index:${deepest.startIdx}`, depth: Math.round(deepest.depth * 10) / 10 },
    avgRecoveryPeriods: avgRecovery !== null ? Math.round(avgRecovery * 10) / 10 : null,
    recoveryRatio: recoveryRatio !== null ? Math.round(recoveryRatio * 100) / 100 : null,
    slideCount: slides.length,
    totalSlideDepth: Math.round(totalSlideDepth * 10) / 10,
  };
}

// 直近エントリのハイライトテキスト生成（プロンプト注入用）
// 直近14日のエントリを丸ごと別枠で渡し、AIが見逃さないようにする
export function formatRecentEntriesHighlight(entries: DiaryEntry[], maxChars = 3000): string {
  const sorted = [...entries].filter(e => e.date).sort((a, b) =>
    (a.date ?? '').localeCompare(b.date ?? '')
  );
  if (sorted.length === 0) return '';

  const latestDate = new Date(sorted[sorted.length - 1].date!);
  const cutoff = new Date(latestDate);
  cutoff.setDate(cutoff.getDate() - 14);
  const cutoffStr = cutoff.toISOString().substring(0, 10);

  const recentEntries = sorted.filter(e => e.date! >= cutoffStr);
  if (recentEntries.length === 0) return '';

  const lines = recentEntries.map(e => `[${e.date}] ${e.content.slice(0, 300)}`);
  let text = lines.join('\n---\n');
  if (text.length > maxChars) text = text.slice(0, maxChars);

  return [
    '【直近14日の日記（全文に近い抜粋）— 最重要】',
    `件数: ${recentEntries.length}件（全${sorted.length}件中）`,
    '→ 直近の日記は件数が少なくても「今」を映している。古い日記より優先して読め。',
    '→ この中に転機・変化・濃い記述があれば、必ず分析に含めろ。材料が少ないからと見逃すな。',
    '',
    text,
  ].join('\n');
}

// 名前っぽいパターンを匿名化（他人モード用）
export function anonymize(text: string): string {
  // 「〇〇さん」「〇〇くん」「〇〇ちゃん」パターン
  let result = text.replace(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]{1,4}(?:さん|くん|ちゃん|先生|氏)/g, '***$&'.replace(/.*(?=さん|くん|ちゃん|先生|氏)/, '***'));
  // 簡易的にカタカナ2-6文字の固有名詞っぽいものを置換
  result = result.replace(/(?<![ァ-ヶー])([ァ-ヶー]{2,6})(?![ァ-ヶー])/g, (match) => {
    // 一般的なカタカナ語は除外
    const commonWords = ['ストレス', 'イライラ', 'パソコン', 'スマホ', 'テレビ', 'コンビニ', 'トイレ', 'バイト', 'メール', 'ネット', 'ゲーム', 'カフェ', 'コーヒー', 'ラーメン', 'カレー', 'ベッド', 'シャワー', 'タクシー', 'バス', 'マスク', 'ノート', 'ペン', 'ダメ', 'クリニック', 'カウンセラー', 'カウンセリング', 'セラピー', 'リハビリ', 'グループ', 'プログラム', 'ボランティア'];
    if (commonWords.includes(match)) return match;
    return '***';
  });
  return result;
}
