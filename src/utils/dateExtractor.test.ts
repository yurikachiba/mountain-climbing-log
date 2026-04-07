import { describe, it, expect } from 'vitest';
import { extractDate, extractDateFromFilename, DATE_LINE_REGEX } from './dateExtractor';

// ── extractDate ──

describe('extractDate', () => {
  it('YYYY-MM-DD', () => {
    expect(extractDate('2024-01-15\n今日は良い天気')).toBe('2024-01-15');
  });

  it('YYYY/MM/DD', () => {
    expect(extractDate('2024/01/15\nいい日だった')).toBe('2024-01-15');
  });

  it('YYYY.MM.DD', () => {
    expect(extractDate('2026.04.07\n散歩した')).toBe('2026-04-07');
  });

  it('YYYY年MM月DD日', () => {
    expect(extractDate('2024年1月15日\n朝から雨')).toBe('2024-01-15');
  });

  it('令和N年', () => {
    expect(extractDate('令和6年1月15日\n寒い')).toBe('2024-01-15');
  });

  it('平成N年', () => {
    expect(extractDate('平成31年4月30日\n最後の平成')).toBe('2019-04-30');
  });

  it('January 15, 2024', () => {
    expect(extractDate('January 15, 2024\nNew Year resolution')).toBe('2024-01-15');
  });

  it('15 January 2024', () => {
    expect(extractDate('15 January 2024\nWinter day')).toBe('2024-01-15');
  });

  it('短縮月名 Jan 15, 2024', () => {
    expect(extractDate('Jan 15, 2024\nCold day')).toBe('2024-01-15');
  });

  it('先頭5行以内に日付がなければ null', () => {
    expect(extractDate('あいうえお\nかきくけこ\nさしすせそ\nたちつてと\nなにぬねの\n2024-01-15')).toBeNull();
  });

  it('日付がなければ null', () => {
    expect(extractDate('今日は何もなかった')).toBeNull();
  });

  it('0パディングなし月日', () => {
    expect(extractDate('2024-1-5\n冬')).toBe('2024-01-05');
  });

  it('範囲外の年 (1899) は null', () => {
    expect(extractDate('1899-01-01')).toBeNull();
  });

  it('範囲外の年 (2101) は null', () => {
    expect(extractDate('2101-01-01')).toBeNull();
  });

  it('月が13の場合 null', () => {
    expect(extractDate('2024-13-01')).toBeNull();
  });

  it('日が32の場合 null', () => {
    expect(extractDate('2024-01-32')).toBeNull();
  });

  it('December (12月)', () => {
    expect(extractDate('Dec 25, 2023')).toBe('2023-12-25');
  });

  it('複数行の先頭に日付がある場合、最初を拾う', () => {
    expect(extractDate('2024-01-01\n2024-02-02\n内容')).toBe('2024-01-01');
  });
});

// ── extractDateFromFilename ──

describe('extractDateFromFilename', () => {
  it('YYYY-MM-DD.txt', () => {
    expect(extractDateFromFilename('2024-01-15.txt')).toBe('2024-01-15');
  });

  it('diary_YYYYMMDD.md', () => {
    expect(extractDateFromFilename('diary_20240115.md')).toBe('2024-01-15');
  });

  it('YYYYMMDD のみ', () => {
    expect(extractDateFromFilename('20240115')).toBe('2024-01-15');
  });

  it('日付なしのファイル名', () => {
    expect(extractDateFromFilename('diary.txt')).toBeNull();
  });

  it('アンダースコア区切り', () => {
    expect(extractDateFromFilename('2024_01_15.txt')).toBe('2024-01-15');
  });
});

// ── DATE_LINE_REGEX ──

describe('DATE_LINE_REGEX', () => {
  it('日付のみの行にマッチ', () => {
    expect(DATE_LINE_REGEX.test('2024-01-15')).toBe(true);
  });

  it('日付+空白にマッチ', () => {
    expect(DATE_LINE_REGEX.test('2024-01-15 ')).toBe(true);
  });

  it('日付+括弧にマッチ', () => {
    expect(DATE_LINE_REGEX.test('2024-01-15（月）')).toBe(true);
  });

  it('日付+【にマッチ', () => {
    expect(DATE_LINE_REGEX.test('2024-01-15【晴れ】')).toBe(true);
  });

  it('ドット区切りにマッチ', () => {
    expect(DATE_LINE_REGEX.test('2026.04.07')).toBe(true);
  });

  it('和暦にマッチ', () => {
    expect(DATE_LINE_REGEX.test('令和6年1月15日')).toBe(true);
  });

  it('平成にマッチ', () => {
    expect(DATE_LINE_REGEX.test('平成31年4月30日')).toBe(true);
  });

  it('日付の後にテキストが続く行はマッチしない', () => {
    // 日付行の直後に助詞なし・括弧なし・空白なしのテキスト → マッチしない
    expect(DATE_LINE_REGEX.test('2024-01-15に行った')).toBe(false);
  });
});
