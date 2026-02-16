import { getApiKey } from './apiKey';
import type { DiaryEntry } from '../types';

interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

async function callChat(messages: ChatMessage[]): Promise<string> {
  const key = getApiKey();
  if (!key) throw new Error('APIキーが設定されていません。設定ページで入力してください。');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 1024,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401) throw new Error('APIキーが無効です。設定を確認してください。');
    if (res.status === 429) throw new Error('リクエスト制限に達しました。しばらく待ってください。');
    throw new Error(`API呼び出しに失敗しました (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// 年代別要約（500字以内）
export async function summarizeByPeriod(entries: DiaryEntry[]): Promise<string> {
  if (entries.length === 0) return '';

  // 日付でグループ化して年単位のテキストを作る
  const byYear = new Map<string, string[]>();
  for (const e of entries) {
    const year = e.date?.substring(0, 4) ?? '不明';
    const list = byYear.get(year) ?? [];
    list.push(e.content.slice(0, 200)); // 各エントリ200文字まで
    byYear.set(year, list);
  }

  const sortedYears = [...byYear.entries()].sort(([a], [b]) => a.localeCompare(b));

  // トークン制限を考慮して、各年の代表エントリ数を均等に制限する
  const maxTotal = 6000;
  const yearCount = sortedYears.length;
  const headerOverhead = yearCount * 20; // 【YYYY年】+ 改行分
  const budgetPerYear = Math.floor((maxTotal - headerOverhead) / yearCount);

  const truncated = sortedYears
    .map(([year, texts]) => {
      let chunk = '';
      for (const t of texts) {
        const next = chunk ? `${chunk}\n---\n${t}` : t;
        if (next.length > budgetPerYear) break;
        chunk = next;
      }
      return `【${year}年】\n${chunk}`;
    })
    .join('\n\n');

  return callChat([
    {
      role: 'system',
      content: [
        'あなたは日記の分析者です。人格を演じず、分析だけを行ってください。',
        '以下のルールに従ってください：',
        '- 年代ごとに要約する（各年100字程度、全体500字以内）',
        '- 慰めや励ましは不要',
        '- 事実と傾向だけを冷静に記述する',
        '- 感傷的な表現は使わない',
      ].join('\n'),
    },
    { role: 'user', content: `以下の日記を年代別に要約してください：\n\n${truncated}` },
  ]);
}

// 頻出感情タグ抽出
export async function extractEmotionTags(entries: DiaryEntry[]): Promise<string> {
  if (entries.length === 0) return '';

  const allText = entries.map(e => e.content.slice(0, 150)).join('\n---\n');
  const truncated = allText.slice(0, 6000);

  return callChat([
    {
      role: 'system',
      content: [
        'あなたは日記の分析者です。人格を演じず、分析だけを行ってください。',
        '以下のルールに従ってください：',
        '- 日記全体から頻出する感情をタグとして抽出する',
        '- 各タグに推定出現頻度（高/中/低）を付ける',
        '- 最大15個まで',
        '- 冷静に、箇条書きで出力する',
      ].join('\n'),
    },
    { role: 'user', content: `以下の日記から頻出感情タグを抽出してください：\n\n${truncated}` },
  ]);
}

// 文章トーン分析
export async function analyzeTone(entries: DiaryEntry[]): Promise<string> {
  if (entries.length === 0) return '';

  // 時系列で前半・後半に分けて比較
  const sorted = [...entries].filter(e => e.date).sort((a, b) =>
    (a.date ?? '').localeCompare(b.date ?? '')
  );
  const mid = Math.floor(sorted.length / 2);
  const early = sorted.slice(0, mid).map(e => e.content.slice(0, 100)).join('\n');
  const late = sorted.slice(mid).map(e => e.content.slice(0, 100)).join('\n');
  const truncatedEarly = early.slice(0, 3000);
  const truncatedLate = late.slice(0, 3000);

  return callChat([
    {
      role: 'system',
      content: [
        'あなたは日記の分析者です。人格を演じず、分析だけを行ってください。',
        '以下のルールに従ってください：',
        '- 前期と後期の文章トーンの違いを分析する',
        '- 文体の変化、語彙の変化、視点の変化に注目する',
        '- 300字以内で冷静に記述する',
        '- 慰めや励ましは不要',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `以下の日記の前期・後期でトーンの変化を分析してください：\n\n【前期】\n${truncatedEarly}\n\n【後期】\n${truncatedLate}`,
    },
  ]);
}
