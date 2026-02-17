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

// 転機検出 — 日記の中で大きな変化・転換点を特定
export async function detectTurningPoints(entries: DiaryEntry[]): Promise<string> {
  if (entries.length === 0) return '';

  const sorted = [...entries].filter(e => e.date).sort((a, b) =>
    (a.date ?? '').localeCompare(b.date ?? '')
  );

  // 時系列順に日付付きで送る
  const texts = sorted.map(e => `[${e.date}] ${e.content.slice(0, 150)}`);
  const truncated = texts.join('\n---\n').slice(0, 6000);

  return callChat([
    {
      role: 'system',
      content: [
        'あなたは日記の分析者です。人格を演じず、分析だけを行ってください。',
        '以下のルールに従ってください：',
        '- 日記の時系列を読み、感情・生活・思考に大きな変化が起きた「転機」を最大5つ検出する',
        '- 各転機について：おおよその時期、変化の内容、変化の前後の違いを簡潔に記述する',
        '- 慰めや励ましは不要。事実の指摘のみ',
        '- 400字以内で出力する',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `以下の日記から、大きな転機・変化点を検出してください：\n\n${truncated}`,
    },
  ]);
}

// 繰り返すテーマ — 時期を超えて繰り返し現れるモチーフを抽出
export async function extractRecurringThemes(entries: DiaryEntry[]): Promise<string> {
  if (entries.length === 0) return '';

  const allText = entries.map(e => e.content.slice(0, 120)).join('\n---\n');
  const truncated = allText.slice(0, 6000);

  return callChat([
    {
      role: 'system',
      content: [
        'あなたは日記の分析者です。人格を演じず、分析だけを行ってください。',
        '以下のルールに従ってください：',
        '- 日記全体を通して繰り返し現れるテーマ・モチーフ・関心事を抽出する',
        '- 単なる感情ワードではなく、より深い主題やパターンを見つける（例：「承認欲求」「居場所の探索」「自己と他者の境界」）',
        '- 各テーマに短い説明を付ける',
        '- 最大8個まで',
        '- 箇条書きで出力する',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `以下の日記から、繰り返し現れるテーマやモチーフを抽出してください：\n\n${truncated}`,
    },
  ]);
}

// 自分への問い — 日記のパターンから内省的な問いかけを生成
export async function generateReflectiveQuestions(entries: DiaryEntry[]): Promise<string> {
  if (entries.length === 0) return '';

  const allText = entries.map(e => e.content.slice(0, 120)).join('\n---\n');
  const truncated = allText.slice(0, 6000);

  return callChat([
    {
      role: 'system',
      content: [
        'あなたは日記の分析者です。人格を演じず、分析だけを行ってください。',
        '以下のルールに従ってください：',
        '- 日記の内容から、書き手が自分自身に問いかけるべき「問い」を生成する',
        '- 表面的な質問ではなく、日記に書かれたパターンや矛盾、無意識の前提に切り込む問いにする',
        '- カウンセリングではない。冷静な分析に基づく問いかけのみ',
        '- 5〜7個の問いを生成する',
        '- 各問いは1文で、説明は不要',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `以下の日記を分析し、書き手への内省的な問いを生成してください：\n\n${truncated}`,
    },
  ]);
}

// 季節×感情マップ — 季節ごとの感情傾向を分析
export async function analyzeSeasonalEmotions(entries: DiaryEntry[]): Promise<string> {
  if (entries.length === 0) return '';

  const sorted = [...entries].filter(e => e.date).sort((a, b) =>
    (a.date ?? '').localeCompare(b.date ?? '')
  );

  // 季節ごとにグループ化
  const seasons: Record<string, string[]> = { '春(3-5月)': [], '夏(6-8月)': [], '秋(9-11月)': [], '冬(12-2月)': [] };
  for (const e of sorted) {
    const month = parseInt(e.date!.substring(5, 7), 10);
    let season: string;
    if (month >= 3 && month <= 5) season = '春(3-5月)';
    else if (month >= 6 && month <= 8) season = '夏(6-8月)';
    else if (month >= 9 && month <= 11) season = '秋(9-11月)';
    else season = '冬(12-2月)';
    seasons[season].push(e.content.slice(0, 100));
  }

  const budgetPerSeason = 1500;
  const grouped = Object.entries(seasons)
    .map(([season, texts]) => {
      const joined = texts.join('\n').slice(0, budgetPerSeason);
      return `【${season}】（${texts.length}件）\n${joined}`;
    })
    .join('\n\n');

  return callChat([
    {
      role: 'system',
      content: [
        'あなたは日記の分析者です。人格を演じず、分析だけを行ってください。',
        '以下のルールに従ってください：',
        '- 春夏秋冬それぞれの季節で、感情の傾向・特徴を分析する',
        '- 季節ごとに2〜3行で記述する',
        '- 季節間の対比や周期的パターンがあれば指摘する',
        '- 400字以内で出力する',
        '- 慰めや励ましは不要',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `以下の日記を季節別に分析し、感情の傾向を教えてください：\n\n${grouped}`,
    },
  ]);
}

// 成長の軌跡 — 具体的な変化・成長を検出
export async function analyzeGrowth(entries: DiaryEntry[]): Promise<string> {
  if (entries.length === 0) return '';

  const sorted = [...entries].filter(e => e.date).sort((a, b) =>
    (a.date ?? '').localeCompare(b.date ?? '')
  );

  // 3期に分けて比較
  const third = Math.floor(sorted.length / 3);
  const earlyTexts = sorted.slice(0, third).map(e => `[${e.date}] ${e.content.slice(0, 100)}`);
  const midTexts = sorted.slice(third, third * 2).map(e => `[${e.date}] ${e.content.slice(0, 100)}`);
  const lateTexts = sorted.slice(third * 2).map(e => `[${e.date}] ${e.content.slice(0, 100)}`);

  const truncate = (texts: string[]) => texts.join('\n').slice(0, 2000);

  return callChat([
    {
      role: 'system',
      content: [
        'あなたは日記の分析者です。人格を演じず、分析だけを行ってください。',
        '以下のルールに従ってください：',
        '- 初期・中期・後期の3期間で、書き手の変化・成長を分析する',
        '- 対象：思考パターン、対人関係の捉え方、自己認識、行動パターン、価値観',
        '- 変化していない点もあれば正直に指摘する',
        '- 美化せず、事実ベースで記述する',
        '- 500字以内で出力する',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `以下の日記から成長・変化の軌跡を分析してください：\n\n【初期】\n${truncate(earlyTexts)}\n\n【中期】\n${truncate(midTexts)}\n\n【後期】\n${truncate(lateTexts)}`,
    },
  ]);
}

// 一括分析レポート — 全分析を統合した包括レポート
export async function generateComprehensiveReport(entries: DiaryEntry[]): Promise<string> {
  if (entries.length === 0) return '';

  const sorted = [...entries].filter(e => e.date).sort((a, b) =>
    (a.date ?? '').localeCompare(b.date ?? '')
  );

  const totalCount = entries.length;
  const dateRange = sorted.length > 0
    ? `${sorted[0].date} 〜 ${sorted[sorted.length - 1].date}`
    : '不明';

  // 全体からサンプリング
  const step = Math.max(1, Math.floor(sorted.length / 30));
  const sampled = sorted.filter((_, i) => i % step === 0);
  const sampledTexts = sampled.map(e => `[${e.date}] ${e.content.slice(0, 120)}`);
  const truncated = sampledTexts.join('\n---\n').slice(0, 6000);

  return callChat([
    {
      role: 'system',
      content: [
        'あなたは日記の分析者です。人格を演じず、分析だけを行ってください。',
        '以下のルールに従ってください：',
        '- 日記全体を俯瞰した包括的なレポートを作成する',
        '- 以下のセクションを含める：',
        '  1.【概要】日記全体の特徴を2〜3文で',
        '  2.【主要テーマ】繰り返し現れる3つの主題',
        '  3.【変化の流れ】時系列での大きな流れ',
        '  4.【特筆すべきパターン】無意識的な癖や傾向',
        '  5.【盲点の可能性】日記に書かれていないが推測される領域',
        '- 全体で600字以内',
        '- 慰めや励ましは不要。冷静な分析のみ',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `以下の日記（全${totalCount}件、期間：${dateRange}）の包括的レポートを作成してください：\n\n${truncated}`,
    },
  ]);
}
