import { describe, it, expect } from 'vitest';
import { toDateOnly, toMonthKey, toYearKey, compareDateOnly } from './dateNormalize';

// ── toDateOnly ──

describe('toDateOnly', () => {
  it('YYYY-MM-DD はそのまま', () => {
    expect(toDateOnly('2024-01-15')).toBe('2024-01-15');
  });

  it('ドット区切りをハイフンに変換', () => {
    expect(toDateOnly('2024.01.15')).toBe('2024-01-15');
  });

  it('スラッシュ区切りをハイフンに変換', () => {
    expect(toDateOnly('2024/01/15')).toBe('2024-01-15');
  });

  it('ISO タイムスタンプから日付部分を抽出', () => {
    expect(toDateOnly('2024-01-15T09:30:00.000Z')).toBe('2024-01-15');
  });

  it('タイムスタンプ + ドット区切り', () => {
    expect(toDateOnly('2024.01.15T09:30:00Z')).toBe('2024-01-15');
  });
});

// ── toMonthKey ──

describe('toMonthKey', () => {
  it('YYYY-MM-DD → YYYY-MM', () => {
    expect(toMonthKey('2024-01-15')).toBe('2024-01');
  });

  it('ドット区切り → YYYY-MM', () => {
    expect(toMonthKey('2024.01.15')).toBe('2024-01');
  });

  it('ISO タイムスタンプ → YYYY-MM', () => {
    expect(toMonthKey('2024-01-15T09:30:00Z')).toBe('2024-01');
  });
});

// ── toYearKey ──

describe('toYearKey', () => {
  it('YYYY-MM-DD → YYYY', () => {
    expect(toYearKey('2024-01-15')).toBe('2024');
  });

  it('ドット区切り → YYYY', () => {
    expect(toYearKey('2024.01.15')).toBe('2024');
  });
});

// ── compareDateOnly ──

describe('compareDateOnly', () => {
  it('同じ日付（同フォーマット）は 0', () => {
    expect(compareDateOnly('2024-01-15', '2024-01-15')).toBe(0);
  });

  it('同じ日付（異なるフォーマット）は 0', () => {
    expect(compareDateOnly('2024-01-15', '2024.01.15')).toBe(0);
  });

  it('タイムスタンプ vs 日付 も同日なら 0', () => {
    expect(compareDateOnly('2024-01-15T09:30:00Z', '2024-01-15')).toBe(0);
  });

  it('前の日付は負', () => {
    expect(compareDateOnly('2024-01-14', '2024.01.15')).toBe(-1);
  });

  it('後の日付は正', () => {
    expect(compareDateOnly('2024/01/16', '2024-01-15')).toBe(1);
  });

  it('混在フォーマットでソートが安定', () => {
    const dates = ['2024.01.17', '2024-01-15', '2024-01-16T10:00:00Z', '2024/01/14'];
    const sorted = [...dates].sort(compareDateOnly);
    expect(sorted).toEqual(['2024/01/14', '2024-01-15', '2024-01-16T10:00:00Z', '2024.01.17']);
  });
});
