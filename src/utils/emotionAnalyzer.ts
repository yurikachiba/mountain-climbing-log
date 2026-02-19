import type { DiaryEntry, EmotionAnalysis, StabilityIndex, ElevationPoint, ElevationPointMonthly } from '../types';

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
// 思想: 書き続けた年は必ず登っている。安定度が高いほど大きく登る。
// 最悪の年でも最低 +50m。最良の年で +300m。
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
  let cumulative = 1000; // 基準点 1000m — 既にここまで来ている

  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    const entryCount = countByYear.get(s.year) ?? 0;

    // 書いた量による底上げ（月1件でも書いていれば最低50m）
    const writingBonus = Math.min(80, Math.max(0, entryCount * 0.5));

    // 安定度スコアによる登攀（0-100 → 0-150m）
    const stabilityClimb = s.score * 1.5;

    // 前年比の改善ボーナス
    let improvementBonus = 0;
    if (i > 0) {
      const prev = sorted[i - 1];
      const scoreDiff = s.score - prev.score;
      if (scoreDiff > 0) {
        improvementBonus = scoreDiff * 0.5; // 改善分の半分をボーナス
      }
    }

    // 年間登攀量 = 最低50m + 各要素（最大約300m）
    const rawClimb = 50 + writingBonus + stabilityClimb + improvementBonus;
    const climb = Math.round(Math.min(300, rawClimb));

    cumulative += climb;
    results.push({ year: s.year, elevation: cumulative, climb });
  }

  return results;
}

// 月単位の累積標高を算出
// 年単位よりも細かい粒度で成長の推移を可視化する
export function calcElevationByMonth(
  monthlyAnalysis: EmotionAnalysis[],
  entries: DiaryEntry[],
): ElevationPointMonthly[] {
  if (monthlyAnalysis.length === 0) return [];

  // 月ごとのエントリ数
  const countByMonth = new Map<string, number>();
  for (const e of entries) {
    if (!e.date) continue;
    const m = e.date.substring(0, 7); // YYYY-MM
    countByMonth.set(m, (countByMonth.get(m) ?? 0) + 1);
  }

  const sorted = [...monthlyAnalysis].sort((a, b) => a.month.localeCompare(b.month));
  const results: ElevationPointMonthly[] = [];
  let cumulative = 1000; // 基準点 1000m

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    const entryCount = countByMonth.get(a.month) ?? 0;

    // 書いた量による底上げ（最大7m/月）
    const writingBonus = Math.min(7, Math.max(0, entryCount * 0.5));

    // ポジティブ比率によるボーナス（最大12m/月）
    const positiveRatio = 1 - a.negativeRatio;
    const positiveClimb = positiveRatio * 12;

    // 自己否定語が少ないほどボーナス（最大2.5m/月）
    const denialScore = Math.max(0, 2.5 - a.selfDenialCount * 0.25);

    // 前月比の改善ボーナス
    let improvementBonus = 0;
    if (i > 0) {
      const prev = sorted[i - 1];
      const prevPositive = 1 - prev.negativeRatio;
      const diff = positiveRatio - prevPositive;
      if (diff > 0) {
        improvementBonus = diff * 10;
      }
    }

    // 月間登攀量 = 最低4m + 各要素（最大約25m）
    const rawClimb = 4 + writingBonus + positiveClimb + denialScore + improvementBonus;
    const climb = Math.round(Math.min(25, rawClimb));

    cumulative += climb;
    results.push({ month: a.month, elevation: cumulative, climb });
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

// 期間統計を簡潔なテキストに変換（プロンプト注入用）
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

  const lines: string[] = ['【感情データ（実測値）】'];
  for (const [half, periods] of [...byHalf.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const avgNeg = periods.reduce((s, p) => s + p.negativeRatio, 0) / periods.length;
    const avgSelfDenial = periods.reduce((s, p) => s + p.selfDenialCount, 0) / periods.length;
    const totalEntries = periods.reduce((s, p) => s + p.entryCount, 0);
    const avgEntries = totalEntries / periods.length;

    lines.push(
      `${half}: ネガティブ率${Math.round(avgNeg * 100)}%, 自己否定語月平均${avgSelfDenial.toFixed(1)}回, 月平均${avgEntries.toFixed(1)}件記述`
    );
  }
  return lines.join('\n');
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
