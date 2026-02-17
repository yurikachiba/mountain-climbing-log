import { useState, useMemo } from 'react';
import { useEntries } from '../hooks/useEntries';
import { useHead } from '../hooks/useHead';

// 日本語のストップワード（助詞・助動詞・一般的すぎる語）
const STOP_WORDS = new Set([
  'の', 'に', 'は', 'を', 'た', 'が', 'で', 'て', 'と', 'し', 'れ', 'さ',
  'ある', 'いる', 'する', 'なる', 'それ', 'これ', 'あれ', 'その', 'この',
  'あの', 'もの', 'こと', 'よう', 'ない', 'なく', 'なり', 'から', 'まで',
  'より', 'ため', 'など', 'って', 'です', 'ます', 'だっ', 'でし', 'まし',
  'ませ', 'でも', 'だけ', 'しか', 'ても', 'ので', 'のに', 'けど', 'けれ',
  'ところ', 'ながら', 'について', 'として', 'という', 'ている',
  'られ', 'られる', 'せる', 'させ', 'され', 'たい', 'たく',
  'そう', 'だろ', 'だろう', 'でしょ', 'でしょう', 'らし', 'らしい',
  'みたい', 'っぽい', 'そして', 'しかし', 'だから', 'それで', 'また',
  'あと', 'そこ', 'ここ', 'どこ', 'いつ', 'なに', 'だれ', 'どう',
  'なん', 'なんか', 'すごく', 'とても', 'かなり', 'ちょっと', 'やっぱ',
  'やっぱり', 'まだ', 'もう', 'ずっと', 'いま', 'ほんと', 'ほんとう',
  'みんな', 'わたし', 'ぼく', 'おれ', '自分', '今日', '明日', '昨日',
  '今年', '去年', '来年', '今月', '先月', '来月', '今週', '先週', '来週',
  '午前', '午後', '時間', '日間', '週間', '月間', '年間',
]);

interface WordData {
  text: string;
  count: number;
  size: number;
}

// 日本語テキストから意味のある語を抽出（簡易形態素分析）
function extractWords(text: string): Map<string, number> {
  const counts = new Map<string, number>();

  // カタカナ語（2文字以上）
  const katakana = text.match(/[ァ-ヶー]{2,}/g) ?? [];
  for (const w of katakana) {
    if (!STOP_WORDS.has(w)) counts.set(w, (counts.get(w) ?? 0) + 1);
  }

  // 漢字語（2〜6文字）
  const kanji = text.match(/[\u4e00-\u9fff]{2,6}/g) ?? [];
  for (const w of kanji) {
    if (!STOP_WORDS.has(w)) counts.set(w, (counts.get(w) ?? 0) + 1);
  }

  // ひらがな（3文字以上、感情語など）
  const hiragana = text.match(/[ぁ-ん]{3,8}/g) ?? [];
  for (const w of hiragana) {
    if (!STOP_WORDS.has(w) && w.length >= 3) counts.set(w, (counts.get(w) ?? 0) + 1);
  }

  // 英単語（3文字以上）
  const english = text.toLowerCase().match(/[a-z]{3,}/g) ?? [];
  for (const w of english) {
    if (!STOP_WORDS.has(w) && w !== 'the' && w !== 'and' && w !== 'for')
      counts.set(w, (counts.get(w) ?? 0) + 1);
  }

  return counts;
}

// カラーパレット（冷静なトーン）
const COLORS = [
  '#1a1a1a', '#333333', '#555555', '#777777',
  '#4a6fa5', '#6b8cae', '#8fa3b7', '#2c3e50',
  '#34495e', '#5d6d7e', '#7f8c8d', '#95a5a6',
];

export function WordCloud() {
  const { entries, loading } = useEntries();

  useHead({
    title: 'ワードクラウド ― 語彙の可視化',
    description: '日記でよく使う言葉をワードクラウドで可視化。全期間・年別の切り替え、出現回数フィルタリングに対応。漢字・カタカナ・ひらがな・英語を自動抽出し、語彙の傾向や変化をランキング表で確認。',
    keywords: 'ワードクラウド,語彙分析,頻出語,言葉の可視化,テキストマイニング,日記分析',
    path: '/wordcloud',
  });
  const [period, setPeriod] = useState<'all' | 'year'>('all');
  const [selectedYear, setSelectedYear] = useState(() => String(new Date().getFullYear()));
  const [minCount, setMinCount] = useState(3);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    for (const entry of entries) {
      if (entry.date) years.add(entry.date.substring(0, 4));
    }
    return [...years].sort().reverse();
  }, [entries]);

  const words = useMemo((): WordData[] => {
    let filtered = entries;
    if (period === 'year') {
      filtered = entries.filter(e => e.date?.startsWith(selectedYear));
    }

    const allText = filtered.map(e => e.content).join('\n');
    const counts = extractWords(allText);

    // minCount以上のものだけ残す
    const sorted = [...counts.entries()]
      .filter(([, count]) => count >= minCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 80);

    if (sorted.length === 0) return [];

    const maxCount = sorted[0][1];
    const minC = sorted[sorted.length - 1][1];
    const range = maxCount - minC || 1;

    return sorted.map(([text, count]) => ({
      text,
      count,
      size: 14 + ((count - minC) / range) * 42, // 14px ~ 56px
    }));
  }, [entries, period, selectedYear, minCount]);

  if (loading) return <div className="page"><p className="loading-text">読み込み中...</p></div>;

  return (
    <div className="page">
      <h1 className="page-title">ワードクラウド</h1>
      <p className="subtitle">よく使う言葉を見わたす</p>

      {entries.length === 0 ? (
        <p className="empty-message">日記をインポートすると表示されます</p>
      ) : (
        <>
          <div className="wordcloud-controls">
            <div className="wordcloud-period">
              <button
                className={`btn btn-small ${period === 'all' ? 'btn-primary' : ''}`}
                onClick={() => setPeriod('all')}
              >
                全期間
              </button>
              <button
                className={`btn btn-small ${period === 'year' ? 'btn-primary' : ''}`}
                onClick={() => setPeriod('year')}
              >
                年別
              </button>
              {period === 'year' && (
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(e.target.value)}
                  className="custom-select"
                >
                  {availableYears.map(y => (
                    <option key={y} value={y}>{y}年</option>
                  ))}
                </select>
              )}
            </div>

            <div className="wordcloud-threshold">
              <label className="toggle-label">
                最低出現回数:
                <select
                  value={minCount}
                  onChange={e => setMinCount(Number(e.target.value))}
                  className="custom-select"
                >
                  <option value={2}>2回</option>
                  <option value={3}>3回</option>
                  <option value={5}>5回</option>
                  <option value={10}>10回</option>
                  <option value={20}>20回</option>
                </select>
              </label>
            </div>
          </div>

          {words.length === 0 ? (
            <div className="onthisday-empty">
              <p className="empty-message">表示する語がありません</p>
              <p className="hint">最低出現回数を下げてみてください</p>
            </div>
          ) : (
            <>
              <div className="wordcloud-canvas">
                {words.map((w, i) => (
                  <span
                    key={w.text}
                    className="wordcloud-word"
                    style={{
                      fontSize: `${w.size}px`,
                      color: COLORS[i % COLORS.length],
                      opacity: 0.7 + (w.count / (words[0]?.count ?? 1)) * 0.3,
                    }}
                    title={`${w.text}: ${w.count}回`}
                  >
                    {w.text}
                  </span>
                ))}
              </div>

              <div className="wordcloud-table">
                <h2 className="wordcloud-table-title">頻出ワード一覧</h2>
                <div className="wordcloud-ranking">
                  {words.slice(0, 30).map((w, i) => (
                    <div key={w.text} className="wordcloud-rank-row">
                      <span className="wordcloud-rank">{i + 1}</span>
                      <span className="wordcloud-rank-word">{w.text}</span>
                      <span className="wordcloud-rank-bar">
                        <span
                          className="wordcloud-rank-fill"
                          style={{ width: `${(w.count / words[0].count) * 100}%` }}
                        />
                      </span>
                      <span className="wordcloud-rank-count">{w.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
