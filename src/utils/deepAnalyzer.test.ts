import { describe, it, expect } from 'vitest';
import { calcMonthlyDeepAnalysis, detectTrendShifts } from './deepAnalyzer';
import type { DiaryEntry } from '../types';

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

// ── calcMonthlyDeepAnalysis ──

describe('calcMonthlyDeepAnalysis', () => {
  it('月単位でグループ化', () => {
    const entries = [
      makeEntry('2024-01-10', '今日は辛かった。疲れた。'),
      makeEntry('2024-01-20', '嬉しい日だった。'),
      makeEntry('2024-02-05', '仕事が忙しい。'),
    ];
    const result = calcMonthlyDeepAnalysis(entries);
    expect(result).toHaveLength(2);
    expect(result[0].month).toBe('2024-01');
    expect(result[1].month).toBe('2024-02');
  });

  it('date null のエントリは除外', () => {
    const entries = [
      { ...makeEntry('2024-01-01', '辛い'), date: null },
    ];
    const result = calcMonthlyDeepAnalysis(entries);
    expect(result).toHaveLength(0);
  });

  it('ネガティブ率が正しく計算される', () => {
    const entries = [
      makeEntry('2024-01-01', '辛い辛い嬉しい'), // neg:2, pos:1 → 2/3
    ];
    const result = calcMonthlyDeepAnalysis(entries);
    expect(result[0].negativeRatio).toBeCloseTo(2 / 3, 5);
  });

  it('移動平均が3ヶ月目以降で計算される', () => {
    const entries = [
      makeEntry('2024-01-01', '辛い'),
      makeEntry('2024-02-01', '嬉しい'),
      makeEntry('2024-03-01', '辛い'),
      makeEntry('2024-04-01', '嬉しい'),
    ];
    const result = calcMonthlyDeepAnalysis(entries);
    // 最初の2ヶ月はMA3がnull、3ヶ月目から値がある
    expect(result[0].negativeRatioMA3).toBeNull();
    expect(result[1].negativeRatioMA3).toBeNull();
    expect(result[2].negativeRatioMA3).not.toBeNull();
  });

  it('一人称率が 1000文字あたりで計算される', () => {
    // 「私」を含むテキスト
    const entries = [
      makeEntry('2024-01-01', '私は今日、私の好きなことをした。私が思うに…'),
    ];
    const result = calcMonthlyDeepAnalysis(entries);
    expect(result[0].firstPersonRate).toBeGreaterThan(0);
  });

  it('身体症状がカウントされる', () => {
    const entries = [
      makeEntry('2024-01-01', '頭痛がひどい。吐き気もある。不眠が続いている。'),
    ];
    const result = calcMonthlyDeepAnalysis(entries);
    expect(result[0].physicalSymptomCount).toBe(3);
    expect(result[0].physicalSymptomRate).toBeGreaterThan(0);
  });

  it('仕事関連語がカウントされる', () => {
    const entries = [
      makeEntry('2024-01-01', '仕事で上司と会議した。残業で疲れた。'),
    ];
    const result = calcMonthlyDeepAnalysis(entries);
    expect(result[0].workWordRate).toBeGreaterThan(0);
  });

  it('存在論テーマがカウントされる', () => {
    const entries = [
      makeEntry('2024-01-01', '生きる意味がわからない。自分とは何者か。尊厳。'),
    ];
    const result = calcMonthlyDeepAnalysis(entries);
    expect(result[0].existentialRate).toBeGreaterThan(0);
    expect(result[0].existentialIntensityScore).toBeGreaterThan(0);
  });

  it('季節ベースラインは同月が2年以上ないと null', () => {
    const entries = [
      makeEntry('2024-01-01', '辛い'),
      makeEntry('2024-02-01', '嬉しい'),
    ];
    const result = calcMonthlyDeepAnalysis(entries);
    expect(result[0].seasonalBaseline).toBeNull();
    expect(result[0].seasonalDeviation).toBeNull();
  });

  it('季節ベースラインは同月が2年以上あれば計算される', () => {
    const entries = [
      makeEntry('2023-01-01', '辛い'),     // 2023年1月
      makeEntry('2024-01-01', '嬉しい'),   // 2024年1月
    ];
    const result = calcMonthlyDeepAnalysis(entries);
    // 2つとも1月なので、ベースラインが計算される
    expect(result[0].seasonalBaseline).not.toBeNull();
    expect(result[1].seasonalBaseline).not.toBeNull();
    expect(result[0].seasonalDeviation).not.toBeNull();
  });

  it('感情語なしのテキストは各レートが 0', () => {
    const entries = [
      makeEntry('2024-01-01', 'あいうえおかきくけこ'),
    ];
    const result = calcMonthlyDeepAnalysis(entries);
    expect(result[0].negativeRatio).toBe(0);
    expect(result[0].negativeRate).toBe(0);
    expect(result[0].positiveRate).toBe(0);
    expect(result[0].existentialRate).toBe(0);
  });
});

// ── detectTrendShifts ──

describe('detectTrendShifts', () => {
  it('4ヶ月未満のデータでは空', () => {
    const entries = [
      makeEntry('2024-01-01', '辛い'),
      makeEntry('2024-02-01', '嬉しい'),
      makeEntry('2024-03-01', '辛い'),
    ];
    const monthly = calcMonthlyDeepAnalysis(entries);
    const shifts = detectTrendShifts(monthly);
    expect(shifts).toEqual([]);
  });

  it('大きなネガティブ率変動で転機を検出する', () => {
    // 前半穏やか、後半急激に悪化
    const entries = [
      makeEntry('2024-01-01', '嬉しい楽しい幸せ安心'),
      makeEntry('2024-02-01', '嬉しい楽しい幸せ安心'),
      makeEntry('2024-03-01', '嬉しい楽しい幸せ安心'),
      makeEntry('2024-04-01', '辛い苦しい死にたい絶望限界'),
      makeEntry('2024-05-01', '辛い苦しい死にたい絶望限界'),
      makeEntry('2024-06-01', '辛い苦しい死にたい絶望限界'),
    ];
    const monthly = calcMonthlyDeepAnalysis(entries);
    const shifts = detectTrendShifts(monthly);
    expect(shifts.length).toBeGreaterThanOrEqual(1);
    // 悪化のはず
    const deterioration = shifts.find(s => s.type === 'deterioration');
    expect(deterioration).toBeTruthy();
  });

  it('変動がなければ転機なし', () => {
    const entries = [
      makeEntry('2024-01-01', '嬉しい辛い'),
      makeEntry('2024-02-01', '嬉しい辛い'),
      makeEntry('2024-03-01', '嬉しい辛い'),
      makeEntry('2024-04-01', '嬉しい辛い'),
      makeEntry('2024-05-01', '嬉しい辛い'),
      makeEntry('2024-06-01', '嬉しい辛い'),
    ];
    const monthly = calcMonthlyDeepAnalysis(entries);
    const shifts = detectTrendShifts(monthly);
    expect(shifts).toEqual([]);
  });
});
