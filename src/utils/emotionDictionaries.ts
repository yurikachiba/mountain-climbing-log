// 感情ワード辞書（日本語） — emotionAnalyzer / deepAnalyzer 共通
// 辞書の追加・変更はここで一元管理する

export const negativeWords = [
  '辛い', 'つらい', '苦しい', '悲しい', '寂しい', '怖い',
  '不安', '孤独', '絶望', '死にたい', '消えたい', '無理',
  '嫌だ', '嫌い', '最悪', '地獄', '痛い', '泣', '涙',
  '疲れ', '限界', '逃げたい', 'しんどい', 'だるい', '憂鬱',
  '鬱', '落ち込', '暗い', '重い', '苦手', '怒り', '腹が立つ',
  'イライラ', 'ストレス', '後悔', '失敗', '惨め', '情けない',
];

export const selfDenialWords = [
  '自分が嫌', '自分なんか', '価値がない', 'どうせ', '無価値',
  '存在意義', '生きてる意味', 'いらない人間', '迷惑',
  'ダメな', '何もできない', '役に立たない', '自己嫌悪',
  '自分のせい', '自分が悪い', '能力がない', '才能がない',
];

export const positiveWords = [
  '嬉しい', '楽しい', '幸せ', '好き', '感謝', 'ありがとう',
  '笑', '元気', '希望', '安心', '心地よい', '穏やか',
  '面白い', '素敵', '美しい', '温かい', '優しい', '喜び',
  '達成', '成功', '前向き', '光', '明るい', '自由',
];

/** テキスト中のワードリストの出現回数を数える */
export function countWords(text: string, words: string[]): number {
  let count = 0;
  for (const word of words) {
    const matches = text.match(new RegExp(word, 'g'));
    if (matches) count += matches.length;
  }
  return count;
}

/** ネガティブ・ポジティブ全語のうち出現したものを出現数順で返す */
export function getEmotionWordCounts(text: string): { word: string; count: number }[] {
  const allWords = [...negativeWords, ...positiveWords];
  const counts: { word: string; count: number }[] = [];
  for (const word of allWords) {
    const matches = text.match(new RegExp(word, 'g'));
    if (matches && matches.length > 0) {
      counts.push({ word, count: matches.length });
    }
  }
  return counts.sort((a, b) => b.count - a.count);
}
