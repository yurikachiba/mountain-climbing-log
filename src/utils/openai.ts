import { getApiKey } from './apiKey';
import type { DiaryEntry } from '../types';

interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

async function callChat(messages: ChatMessage[], maxTokens = 1024): Promise<string> {
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
      max_tokens: maxTokens,
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

// 時系列で均等にサンプリングする
function sampleUniform(entries: DiaryEntry[], maxCount: number): DiaryEntry[] {
  const sorted = [...entries].filter(e => e.date).sort((a, b) =>
    (a.date ?? '').localeCompare(b.date ?? '')
  );
  if (sorted.length <= maxCount) return sorted;
  const step = sorted.length / maxCount;
  return Array.from({ length: maxCount }, (_, i) => sorted[Math.floor(i * step)]);
}

// 年代別要約（500字以内）
export async function summarizeByPeriod(entries: DiaryEntry[]): Promise<string> {
  if (entries.length === 0) return '';

  // 日付でグループ化して年単位のテキストを作る
  const byYear = new Map<string, string[]>();
  for (const e of entries) {
    const year = e.date?.substring(0, 4) ?? '不明';
    const list = byYear.get(year) ?? [];
    list.push(e.content.slice(0, 300)); // 各エントリ300文字まで
    byYear.set(year, list);
  }

  const sortedYears = [...byYear.entries()].sort(([a], [b]) => a.localeCompare(b));

  // トークン制限を考慮して、各年の代表エントリ数を均等に制限する
  const maxTotal = 12000;
  const yearCount = sortedYears.length;
  const headerOverhead = yearCount * 20; // 【YYYY年】+ 改行分
  const budgetPerYear = Math.floor((maxTotal - headerOverhead) / yearCount);

  const truncated = sortedYears
    .map(([year, texts]) => {
      // 年内でも均等にサンプリング
      const maxEntries = Math.max(1, Math.floor(budgetPerYear / 200));
      let sampled = texts;
      if (texts.length > maxEntries) {
        const step = texts.length / maxEntries;
        sampled = Array.from({ length: maxEntries }, (_, i) => texts[Math.floor(i * step)]);
      }
      let chunk = '';
      for (const t of sampled) {
        const next = chunk ? `${chunk}\n---\n${t}` : t;
        if (next.length > budgetPerYear) break;
        chunk = next;
      }
      return `【${year}年】（${texts.length}件）\n${chunk}`;
    })
    .join('\n\n');

  return callChat([
    {
      role: 'system',
      content: [
        'あなたは日記の分析者です。人格を演じず、分析だけを行ってください。',
        '以下のルールに従ってください：',
        '- 年代ごとに要約する（全体600字以内）',
        '- 各年の冒頭に、その年を一言で表す「物語タイトル」を付ける',
        '  例：【2020年】→ 生存と観察の年 / 【2021年】→ 感情の揺れと他者への接続',
        '  タイトルは説明ではなく、変化の本質を一言で射抜く表現にする',
        '- タイトルの後に、その年の要約を2〜3文で書く',
        '- 慰めや励ましは不要',
        '- 事実と傾向だけを冷静に記述する',
        '- 感傷的な表現は使わない',
        '- 年をまたぐ変化の流れが読み取れるように、前年との差分を意識する',
      ].join('\n'),
    },
    { role: 'user', content: `以下の日記を年代別に要約してください。各年に「物語タイトル」を付け、説明文ではなく変化のドラマとして描いてください：\n\n${truncated}` },
  ]);
}

// 頻出感情タグ抽出
export async function extractEmotionTags(entries: DiaryEntry[]): Promise<string> {
  if (entries.length === 0) return '';

  const sampled = sampleUniform(entries, 80);
  const allText = sampled.map(e => `[${e.date}] ${e.content.slice(0, 150)}`).join('\n---\n');
  const truncated = allText.slice(0, 10000);

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
  const earlyEntries = sorted.slice(0, mid);
  const lateEntries = sorted.slice(mid);

  // 前期・後期の日付範囲を算出
  const earlyRange = earlyEntries.length > 0
    ? `${earlyEntries[0].date} 〜 ${earlyEntries[earlyEntries.length - 1].date}`
    : '不明';
  const lateRange = lateEntries.length > 0
    ? `${lateEntries[0].date} 〜 ${lateEntries[lateEntries.length - 1].date}`
    : '不明';

  // 各半期から均等にサンプリング
  const sampleHalf = (half: DiaryEntry[], maxCount: number) => {
    if (half.length <= maxCount) return half;
    const step = half.length / maxCount;
    return Array.from({ length: maxCount }, (_, i) => half[Math.floor(i * step)]);
  };

  const earlySampled = sampleHalf(earlyEntries, 40);
  const lateSampled = sampleHalf(lateEntries, 40);

  const early = earlySampled.map(e => `[${e.date}] ${e.content.slice(0, 120)}`).join('\n');
  const late = lateSampled.map(e => `[${e.date}] ${e.content.slice(0, 120)}`).join('\n');
  const truncatedEarly = early.slice(0, 5000);
  const truncatedLate = late.slice(0, 5000);

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
      content: `以下の日記の前期・後期でトーンの変化を分析してください：\n\n【前期：${earlyRange}】\n${truncatedEarly}\n\n【後期：${lateRange}】\n${truncatedLate}`,
    },
  ]);
}

// 転機検出 — 日記の中で大きな変化・転換点を特定
export async function detectTurningPoints(entries: DiaryEntry[]): Promise<string> {
  if (entries.length === 0) return '';

  // 全期間から均等にサンプリング
  const sampled = sampleUniform(entries, 80);

  // 時系列順に日付付きで送る
  const texts = sampled.map(e => `[${e.date}] ${e.content.slice(0, 150)}`);
  const truncated = texts.join('\n---\n').slice(0, 10000);

  // 最新エントリの日付を取得（「今」の基準点として渡す）
  const latestDate = sampled[sampled.length - 1]?.date ?? '不明';

  return callChat([
    {
      role: 'system',
      content: [
        'あなたは日記の分析者です。人格を演じず、分析だけを行ってください。',
        '以下のルールに従ってください：',
        '- 日記の時系列を読み、感情・生活・思考に大きな変化が起きた「転機」を最大5つ検出する',
        '- 各転機について以下の3点を記述する：',
        '  ① おおよその時期と変化の内容',
        '  ② 変化の前後の違い',
        '  ③ その転機が、最新の日記（現在の自分）にどう繋がっているか',
        '- ③が最も重要。「あのとき○○が変わったから、今の自分は○○している」という因果の糸を見つけること',
        '- 繋がりが見えない転機は、そう正直に書いてよい（「この変化がその後どう影響したかは日記からは読み取れない」）',
        '- 日記は全期間から均等に抽出されたサンプルである。全期間を対象に転機を探すこと',
        '- 慰めや励ましは不要。事実の指摘のみ',
        '- 550字以内で出力する',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `以下の日記から、大きな転機・変化点を検出してください。各転機が「最新の日記時点（${latestDate}頃）の自分」にどう繋がっているかも分析してください：\n\n${truncated}`,
    },
  ]);
}

// 繰り返すテーマ — 時期を超えて繰り返し現れるモチーフを抽出
export async function extractRecurringThemes(entries: DiaryEntry[]): Promise<string> {
  if (entries.length === 0) return '';

  const sampled = sampleUniform(entries, 80);
  const allText = sampled.map(e => `[${e.date}] ${e.content.slice(0, 120)}`).join('\n---\n');
  const truncated = allText.slice(0, 10000);

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

  const sampled = sampleUniform(entries, 80);
  const allText = sampled.map(e => `[${e.date}] ${e.content.slice(0, 120)}`).join('\n---\n');
  const truncated = allText.slice(0, 10000);

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
  const seasons: Record<string, DiaryEntry[]> = { '春(3-5月)': [], '夏(6-8月)': [], '秋(9-11月)': [], '冬(12-2月)': [] };
  for (const e of sorted) {
    const month = parseInt(e.date!.substring(5, 7), 10);
    let season: string;
    if (month >= 3 && month <= 5) season = '春(3-5月)';
    else if (month >= 6 && month <= 8) season = '夏(6-8月)';
    else if (month >= 9 && month <= 11) season = '秋(9-11月)';
    else season = '冬(12-2月)';
    seasons[season].push(e);
  }

  const budgetPerSeason = 2500;
  const grouped = Object.entries(seasons)
    .map(([season, seasonEntries]) => {
      // 季節内でも均等にサンプリング
      const maxEntries = Math.max(1, Math.floor(budgetPerSeason / 120));
      let sampled = seasonEntries;
      if (seasonEntries.length > maxEntries) {
        const step = seasonEntries.length / maxEntries;
        sampled = Array.from({ length: maxEntries }, (_, i) => seasonEntries[Math.floor(i * step)]);
      }
      const joined = sampled.map(e => `[${e.date}] ${e.content.slice(0, 100)}`).join('\n').slice(0, budgetPerSeason);
      return `【${season}】（${seasonEntries.length}件）\n${joined}`;
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
  const periods = [
    sorted.slice(0, third),
    sorted.slice(third, third * 2),
    sorted.slice(third * 2),
  ];

  // 各期間の日付範囲を算出
  const periodLabels = periods.map(p => {
    if (p.length === 0) return '不明';
    return `${p[0].date} 〜 ${p[p.length - 1].date}`;
  });

  const budgetPerPeriod = 3500;
  const samplePeriod = (period: DiaryEntry[]) => {
    const maxEntries = Math.max(1, Math.floor(budgetPerPeriod / 120));
    let sampled = period;
    if (period.length > maxEntries) {
      const step = period.length / maxEntries;
      sampled = Array.from({ length: maxEntries }, (_, i) => period[Math.floor(i * step)]);
    }
    return sampled.map(e => `[${e.date}] ${e.content.slice(0, 100)}`).join('\n').slice(0, budgetPerPeriod);
  };

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
      content: `以下の日記から成長・変化の軌跡を分析してください：\n\n【初期：${periodLabels[0]}】\n${samplePeriod(periods[0])}\n\n【中期：${periodLabels[1]}】\n${samplePeriod(periods[1])}\n\n【後期：${periodLabels[2]}】\n${samplePeriod(periods[2])}`,
    },
  ], 1500);
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

  // 全体からサンプリング（30→50件に増加）
  const step = Math.max(1, Math.floor(sorted.length / 50));
  const sampled = sorted.filter((_, i) => i % step === 0);
  const sampledTexts = sampled.map(e => `[${e.date}] ${e.content.slice(0, 150)}`);
  const truncated = sampledTexts.join('\n---\n').slice(0, 10000);

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
        '  5.【あなたへの問い】日記のパターンから浮かぶ、書き手が向き合うべき問い（2〜3個）',
        '- 【あなたへの問い】のルール：',
        '  - 他人事のような指摘（「○○が書かれていない」）ではなく、二人称の問いかけにする',
        '  - 日記の具体的パターンに基づく問いにする',
        '  - 例：「最近、忙しさを理由に内面を書かなくなっていないか？」',
        '  - 例：「人間関係について書くとき、常に自分の側からだけ見ていないか？」',
        '  - 刺すけど優しい。正直だけど敵ではない。そういうトーンで',
        '- 全体で700字以内',
        '- 慰めや励ましは不要。冷静な分析のみ',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `以下の日記（全${totalCount}件、期間：${dateRange}）の包括的レポートを作成してください：\n\n${truncated}`,
    },
  ], 1500);
}
