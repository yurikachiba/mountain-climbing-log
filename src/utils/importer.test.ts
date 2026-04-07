import { describe, it, expect } from 'vitest';
import { parseTextFile, parseJsonFile, importFile } from './importer';

// ── parseTextFile ──

describe('parseTextFile', () => {
  it('単一エントリ（日付あり）', () => {
    const result = parseTextFile('2024-01-15\n今日は良い天気だった', 'test.txt');
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2024-01-15');
    expect(result[0].content).toBe('2024-01-15\n今日は良い天気だった');
    expect(result[0].sourceFile).toBe('test.txt');
  });

  it('単一エントリ（日付なし → ファイル名からフォールバック）', () => {
    const result = parseTextFile('今日は何もなかった', '20240115.txt');
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2024-01-15');
  });

  it('日付もファイル名日付もない場合は null', () => {
    const result = parseTextFile('日記です', 'diary.txt');
    expect(result).toHaveLength(1);
    expect(result[0].date).toBeNull();
  });

  it('複数エントリの分割', () => {
    const text = '2024-01-15\nエントリ1\n2024-01-16\nエントリ2';
    const result = parseTextFile(text, 'test.txt');
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2024-01-15');
    expect(result[1].date).toBe('2024-01-16');
  });

  it('本文中の日付参照ではエントリが分割されない', () => {
    const text = '2024-01-15\n2024-01-10に友達と会った。楽しかった。';
    const result = parseTextFile(text, 'test.txt');
    // 「2024-01-10に」は助詞「に」が続くので区切りにならない
    expect(result).toHaveLength(1);
  });

  it('長い行（40文字超）の中の日付では分割されない', () => {
    const text = '2024-01-15\nこの日記は2024-01-10のことを思い出しながら書いている。あの日は雪が降っていた。';
    const result = parseTextFile(text, 'test.txt');
    expect(result).toHaveLength(1);
  });

  it('ドット区切り日付での分割', () => {
    const text = '2026.04.06\n昨日の話\n2026.04.07\n今日の話';
    const result = parseTextFile(text, 'test.txt');
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2026-04-06');
    expect(result[1].date).toBe('2026-04-07');
  });

  it('空行のみのセグメントは除外', () => {
    const text = '2024-01-15\n内容\n2024-01-16\n\n\n';
    const result = parseTextFile(text, 'test.txt');
    // 最後のセグメントは空行のみなので除外
    expect(result).toHaveLength(2);
  });

  it('各エントリに id, importedAt, comments, isFavorite がある', () => {
    const result = parseTextFile('2024-01-15\nテスト', 'test.txt');
    expect(result[0].id).toBeTruthy();
    expect(result[0].importedAt).toBeTruthy();
    expect(result[0].comments).toEqual([]);
    expect(result[0].isFavorite).toBe(false);
  });
});

// ── parseJsonFile ──

describe('parseJsonFile', () => {
  it('配列形式（content フィールド）', () => {
    const json = JSON.stringify([
      { date: '2024-01-15', content: '日記の内容' },
    ]);
    const result = parseJsonFile(json, 'test.json');
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2024-01-15');
    expect(result[0].content).toBe('日記の内容');
  });

  it('配列形式（text フィールド）', () => {
    const json = JSON.stringify([
      { date: '2024-01-15', text: '日記テキスト' },
    ]);
    const result = parseJsonFile(json, 'test.json');
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('日記テキスト');
  });

  it('配列形式（body フィールド）', () => {
    const json = JSON.stringify([
      { date: '2024-01-15', body: '日記ボディ' },
    ]);
    const result = parseJsonFile(json, 'test.json');
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('日記ボディ');
  });

  it('タイムスタンプ形式の日付を YYYY-MM-DD に正規化', () => {
    const json = JSON.stringify([
      { date: '2024-01-15T09:30:00.000Z', content: '朝の日記' },
    ]);
    const result = parseJsonFile(json, 'test.json');
    expect(result[0].date).toBe('2024-01-15');
  });

  it('ドット区切り日付を YYYY-MM-DD に正規化', () => {
    const json = JSON.stringify([
      { date: '2026.04.07', content: '今日の日記' },
    ]);
    const result = parseJsonFile(json, 'test.json');
    expect(result[0].date).toBe('2026-04-07');
  });

  it('スラッシュ区切り日付を YYYY-MM-DD に正規化', () => {
    const json = JSON.stringify([
      { date: '2024/01/15', content: '日記' },
    ]);
    const result = parseJsonFile(json, 'test.json');
    expect(result[0].date).toBe('2024-01-15');
  });

  it('content/text/body がないエントリはスキップ', () => {
    const json = JSON.stringify([
      { date: '2024-01-15', title: 'タイトルだけ' },
      { date: '2024-01-16', content: '本文あり' },
    ]);
    const result = parseJsonFile(json, 'test.json');
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2024-01-16');
  });

  it('空文字の content はスキップ', () => {
    const json = JSON.stringify([
      { date: '2024-01-15', content: '' },
      { date: '2024-01-16', content: '内容あり' },
    ]);
    const result = parseJsonFile(json, 'test.json');
    expect(result).toHaveLength(1);
  });

  it('entries キーを持つオブジェクト', () => {
    const json = JSON.stringify({
      entries: [
        { date: '2024-01-15', content: 'エントリ1' },
        { date: '2024-01-16', content: 'エントリ2' },
      ],
    });
    const result = parseJsonFile(json, 'test.json');
    expect(result).toHaveLength(2);
  });

  it('単一オブジェクト', () => {
    const json = JSON.stringify({
      date: '2024-01-15',
      content: '単一の日記',
    });
    const result = parseJsonFile(json, 'test.json');
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('単一の日記');
  });

  it('content がないオブジェクトは空配列', () => {
    const json = JSON.stringify({ title: 'なにかのデータ' });
    const result = parseJsonFile(json, 'test.json');
    expect(result).toHaveLength(0);
  });

  it('date が null の場合、content から日付抽出', () => {
    const json = JSON.stringify([
      { date: null, content: '2024-01-15\n今日の日記' },
    ]);
    const result = parseJsonFile(json, 'test.json');
    expect(result[0].date).toBe('2024-01-15');
  });
});

// ── importFile ──

describe('importFile', () => {
  it('.json ファイルは parseJsonFile を使う', () => {
    const json = JSON.stringify([{ date: '2024-01-15', content: 'テスト' }]);
    const result = importFile(json, 'diary.json');
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2024-01-15');
  });

  it('.txt ファイルは parseTextFile を使う', () => {
    const result = importFile('2024-01-15\n内容', 'diary.txt');
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2024-01-15');
  });

  it('.md ファイルは parseTextFile を使う', () => {
    const result = importFile('2024-01-15\n内容', 'diary.md');
    expect(result).toHaveLength(1);
  });

  it('大文字拡張子 .JSON も対応', () => {
    const json = JSON.stringify([{ date: '2024-01-15', content: 'テスト' }]);
    const result = importFile(json, 'diary.JSON');
    expect(result).toHaveLength(1);
  });
});
