import { describe, it, expect } from 'vitest';
import {
  analyzeEntries,
  calcStabilityByYear,
  calcElevationByYear,
  calcElevationByMonth,
  analyzeEntriesEveryOtherDay,
  calcElevationEveryOtherDay,
  calcResilience,
  calcRecentStateContext,
} from './emotionAnalyzer';
import { countWords, getEmotionWordCounts, negativeWords, positiveWords } from './emotionDictionaries';
import type { DiaryEntry, EmotionAnalysis } from '../types';

// ── ヘルパー ──

function makeEntry(date: string, content: string): DiaryEntry {
  return {
    id: crypto.randomUUID(),
    date,
    content,
    sourceFile: 'test.txt',
    importedAt: new Date().toISOString(),
    comments: [],
    isFavorite: false,
  };
}

// ── emotionDictionaries ──

describe('countWords', () => {
  it('単語の出現回数を正しくカウント', () => {
    expect(countWords('辛い日だった。辛い。', ['辛い'])).toBe(2);
  });

  it('複数単語の合計カウント', () => {
    expect(countWords('嬉しい日。楽しい時間。嬉しい。', ['嬉しい', '楽しい'])).toBe(3);
  });

  it('出現しない場合は 0', () => {
    expect(countWords('普通の日だった', negativeWords)).toBe(0);
  });

  it('空テキストは 0', () => {
    expect(countWords('', negativeWords)).toBe(0);
  });
});

describe('getEmotionWordCounts', () => {
  it('出現した感情語をカウント順で返す', () => {
    const result = getEmotionWordCounts('辛い辛い辛い。嬉しい。');
    expect(result[0].word).toBe('辛い');
    expect(result[0].count).toBe(3);
    expect(result[1].word).toBe('嬉しい');
    expect(result[1].count).toBe(1);
  });

  it('何も出現しなければ空配列', () => {
    expect(getEmotionWordCounts('普通の一日')).toEqual([]);
  });
});

// ── analyzeEntries ──

describe('analyzeEntries', () => {
  it('月単位でグループ化される', () => {
    const entries = [
      makeEntry('2024-01-15', '辛い日だった'),
      makeEntry('2024-01-20', '嬉しい日だった'),
      makeEntry('2024-02-10', '楽しい'),
    ];
    const result = analyzeEntries(entries);
    expect(result).toHaveLength(2);
    expect(result[0].month).toBe('2024-01');
    expect(result[1].month).toBe('2024-02');
  });

  it('月が昇順ソートされる', () => {
    const entries = [
      makeEntry('2024-03-01', '嬉しい'),
      makeEntry('2024-01-01', '辛い'),
    ];
    const result = analyzeEntries(entries);
    expect(result[0].month).toBe('2024-01');
    expect(result[1].month).toBe('2024-03');
  });

  it('date が null のエントリは除外', () => {
    const entries = [
      { ...makeEntry('2024-01-15', '辛い'), date: null },
    ];
    const result = analyzeEntries(entries);
    expect(result).toHaveLength(0);
  });

  it('ネガティブのみのテキストは negativeRatio = 1', () => {
    const entries = [makeEntry('2024-01-01', '辛い辛い辛い')];
    const result = analyzeEntries(entries);
    expect(result[0].negativeRatio).toBe(1);
  });

  it('ポジティブのみのテキストは negativeRatio = 0', () => {
    const entries = [makeEntry('2024-01-01', '嬉しい楽しい幸せ')];
    const result = analyzeEntries(entries);
    expect(result[0].negativeRatio).toBe(0);
  });

  it('感情語なしのテキストは negativeRatio = 0', () => {
    const entries = [makeEntry('2024-01-01', '今日は普通の一日だった')];
    const result = analyzeEntries(entries);
    expect(result[0].negativeRatio).toBe(0);
  });

  it('topEmotionWords が最大10件', () => {
    // 多くの感情語を含むテキスト
    const text = negativeWords.concat(positiveWords).join('。');
    const entries = [makeEntry('2024-01-01', text)];
    const result = analyzeEntries(entries);
    expect(result[0].topEmotionWords.length).toBeLessThanOrEqual(10);
  });
});

// ── calcStabilityByYear ──

describe('calcStabilityByYear', () => {
  it('年単位でグループ化される', () => {
    const monthly: EmotionAnalysis[] = [
      { month: '2023-01', negativeRatio: 0.3, selfDenialCount: 0, topEmotionWords: [] },
      { month: '2023-06', negativeRatio: 0.4, selfDenialCount: 1, topEmotionWords: [] },
      { month: '2024-01', negativeRatio: 0.2, selfDenialCount: 0, topEmotionWords: [] },
    ];
    const result = calcStabilityByYear(monthly);
    expect(result).toHaveLength(2);
    expect(result[0].year).toBe('2023');
    expect(result[1].year).toBe('2024');
  });

  it('スコアは 0〜100 の範囲', () => {
    const monthly: EmotionAnalysis[] = [
      { month: '2024-01', negativeRatio: 0.9, selfDenialCount: 100, topEmotionWords: [] },
    ];
    const result = calcStabilityByYear(monthly);
    expect(result[0].score).toBeGreaterThanOrEqual(0);
    expect(result[0].score).toBeLessThanOrEqual(100);
  });

  it('完全ポジティブ + 自己否定ゼロ → 高スコア', () => {
    const monthly: EmotionAnalysis[] = [
      { month: '2024-01', negativeRatio: 0, selfDenialCount: 0, topEmotionWords: [] },
      { month: '2024-02', negativeRatio: 0, selfDenialCount: 0, topEmotionWords: [] },
    ];
    const result = calcStabilityByYear(monthly);
    expect(result[0].score).toBe(100);
  });

  it('高ネガティブ + 高自己否定 → 低スコア', () => {
    const monthly: EmotionAnalysis[] = [
      { month: '2024-01', negativeRatio: 0.9, selfDenialCount: 20, topEmotionWords: [] },
      { month: '2024-02', negativeRatio: 0.8, selfDenialCount: 15, topEmotionWords: [] },
    ];
    const result = calcStabilityByYear(monthly);
    expect(result[0].score).toBeLessThan(30);
  });

  it('年が昇順ソート', () => {
    const monthly: EmotionAnalysis[] = [
      { month: '2025-01', negativeRatio: 0.5, selfDenialCount: 0, topEmotionWords: [] },
      { month: '2023-01', negativeRatio: 0.5, selfDenialCount: 0, topEmotionWords: [] },
    ];
    const result = calcStabilityByYear(monthly);
    expect(result[0].year).toBe('2023');
    expect(result[1].year).toBe('2025');
  });
});

// ── calcElevationByYear ──

describe('calcElevationByYear', () => {
  it('基準点は 1000m', () => {
    const stability = [{ year: '2024', score: 50, positiveRatio: 0.5, volatility: 0, selfDenialAvg: 0 }];
    const entries = [makeEntry('2024-01-01', 'テスト')];
    const result = calcElevationByYear(stability, entries);
    // score=50 (中立点) → stabilityDelta=0, 少量のwritingBonus
    expect(result[0].elevation).toBeGreaterThanOrEqual(1000);
  });

  it('空の安定指数は空配列を返す', () => {
    expect(calcElevationByYear([], [])).toEqual([]);
  });

  it('高スコアは登り、低スコアは滑落', () => {
    const stability = [
      { year: '2023', score: 80, positiveRatio: 0.8, volatility: 0.05, selfDenialAvg: 0 },
      { year: '2024', score: 20, positiveRatio: 0.2, volatility: 0.3, selfDenialAvg: 5 },
    ];
    const entries = [
      makeEntry('2023-06-01', 'テスト'),
      makeEntry('2024-06-01', 'テスト'),
    ];
    const result = calcElevationByYear(stability, entries);
    expect(result[0].climb).toBeGreaterThan(0); // 高スコア → 登り
    expect(result[1].climb).toBeLessThan(0);    // 低スコア → 滑落
    expect(result[1].isSlide).toBe(true);
  });
});

// ── calcElevationByMonth ──

describe('calcElevationByMonth', () => {
  it('ネガ率 0% → 登り', () => {
    const monthly: EmotionAnalysis[] = [
      { month: '2024-01', negativeRatio: 0, selfDenialCount: 0, topEmotionWords: [] },
    ];
    const entries = [makeEntry('2024-01-15', '嬉しい')];
    const result = calcElevationByMonth(monthly, entries);
    expect(result[0].climb).toBeGreaterThan(0);
    expect(result[0].isSlide).toBe(false);
  });

  it('ネガ率 100% → 滑落', () => {
    const monthly: EmotionAnalysis[] = [
      { month: '2024-01', negativeRatio: 1, selfDenialCount: 5, topEmotionWords: [] },
    ];
    const entries = [makeEntry('2024-01-15', '辛い')];
    const result = calcElevationByMonth(monthly, entries);
    expect(result[0].climb).toBeLessThan(0);
    expect(result[0].isSlide).toBe(true);
  });

  it('空データは空配列', () => {
    expect(calcElevationByMonth([], [])).toEqual([]);
  });
});

// ── analyzeEntriesEveryOtherDay ──

describe('analyzeEntriesEveryOtherDay', () => {
  it('1日おきにサンプリング', () => {
    const entries = [
      makeEntry('2024-01-01', '辛い'),
      makeEntry('2024-01-02', '嬉しい'),
      makeEntry('2024-01-03', '辛い'),
      makeEntry('2024-01-04', '嬉しい'),
    ];
    const result = analyzeEntriesEveryOtherDay(entries);
    // 4日 → 1日おき → 2日分
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2024-01-01');
    expect(result[1].date).toBe('2024-01-03');
  });

  it('date null は除外', () => {
    const entries = [
      { ...makeEntry('2024-01-01', '辛い'), date: null },
    ];
    const result = analyzeEntriesEveryOtherDay(entries);
    expect(result).toHaveLength(0);
  });

  it('同じ日付の複数エントリは統合', () => {
    const entries = [
      makeEntry('2024-01-01', '辛い'),
      makeEntry('2024-01-01', '嬉しい'),
    ];
    const result = analyzeEntriesEveryOtherDay(entries);
    expect(result).toHaveLength(1);
    // 辛い(neg) + 嬉しい(pos) → 0.5
    expect(result[0].negativeRatio).toBe(0.5);
  });
});

// ── calcElevationEveryOtherDay ──

describe('calcElevationEveryOtherDay', () => {
  it('基準点は 1000m', () => {
    const daily = [{ date: '2024-01-01', negativeRatio: 0.5, selfDenialCount: 0, topEmotionWords: [] as { word: string; count: number }[] }];
    const entries = [makeEntry('2024-01-01', 'テスト')];
    const result = calcElevationEveryOtherDay(daily, entries);
    // ネガ率0.5 = 中立、writingBonusだけ上がる
    expect(result[0].elevation).toBeGreaterThanOrEqual(1000);
  });

  it('空は空', () => {
    expect(calcElevationEveryOtherDay([], [])).toEqual([]);
  });
});

// ── calcResilience ──

describe('calcResilience', () => {
  it('滑落なし', () => {
    const points = [
      { climb: 5, isSlide: false },
      { climb: 3, isSlide: false },
      { climb: 2, isSlide: false },
    ];
    const result = calcResilience(points);
    expect(result.slideCount).toBe(0);
    expect(result.deepestSlide).toBeNull();
    expect(result.totalSlideDepth).toBe(0);
  });

  it('単一の滑落 → 回復あり', () => {
    const points = [
      { climb: 5, isSlide: false },
      { climb: -10, isSlide: true },
      { climb: -5, isSlide: true },
      { climb: 8, isSlide: false },
      { climb: 7, isSlide: false },
    ];
    const result = calcResilience(points);
    expect(result.slideCount).toBe(1);
    expect(result.deepestSlide!.depth).toBe(15); // 10 + 5
    expect(result.totalSlideDepth).toBe(15);
    // 回復: 8+7=15 >= 15*0.5=7.5 → 回復あり
    expect(result.avgRecoveryPeriods).not.toBeNull();
    expect(result.recoveryRatio).not.toBeNull();
  });

  it('最後まで滑落中', () => {
    const points = [
      { climb: 5, isSlide: false },
      { climb: -10, isSlide: true },
      { climb: -5, isSlide: true },
    ];
    const result = calcResilience(points);
    expect(result.slideCount).toBe(1);
    // 回復期間は null（まだ回復してない）
    expect(result.deepestSlide!.depth).toBe(15);
  });

  it('複数の滑落', () => {
    const points = [
      { climb: -3, isSlide: true },
      { climb: 5, isSlide: false },
      { climb: -7, isSlide: true },
      { climb: -2, isSlide: true },
      { climb: 10, isSlide: false },
    ];
    const result = calcResilience(points);
    expect(result.slideCount).toBe(2);
    expect(result.deepestSlide!.depth).toBe(9); // 7 + 2
  });
});

// ── calcRecentStateContext ──

describe('calcRecentStateContext', () => {
  it('エントリが空なら空のコンテキスト', () => {
    const result = calcRecentStateContext([]);
    expect(result.isRecentCalm).toBe(false);
    expect(result.promptText).toBe('');
  });

  it('直近が穏やか・過去が辛い → isRecentCalm = true', () => {
    const entries = [
      // 過去（辛い）
      makeEntry('2023-01-01', '辛い辛い辛い辛い辛い。死にたい。消えたい。絶望。'),
      makeEntry('2023-02-01', '辛い辛い辛い辛い辛い。苦しい。限界。'),
      makeEntry('2023-03-01', '辛い辛い辛い。悲しい。'),
      makeEntry('2023-04-01', '辛い辛い辛い。孤独。'),
      makeEntry('2023-06-01', '辛い辛い辛い辛い。不安。'),
      // 直近（穏やか）
      makeEntry('2023-10-01', '嬉しい嬉しい嬉しい。楽しい。幸せ。'),
      makeEntry('2023-11-01', '嬉しい楽しい幸せ。安心。穏やか。'),
      makeEntry('2023-12-01', '嬉しい楽しい。感謝。元気。'),
    ];
    const result = calcRecentStateContext(entries);
    expect(result.isRecentCalm).toBe(true);
    expect(result.promptText).toContain('穏やか');
  });
});
