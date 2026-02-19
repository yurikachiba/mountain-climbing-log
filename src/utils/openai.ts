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
        '',
        '【最重要ルール】日記に明示的に書かれていない出来事を絶対に捏造してはならない。',
        '死去・事故・離別・重病・災害などの重大な出来事は、日記本文に明確に記述されている場合のみ言及すること。',
        '「行間を読む」「推測する」「文脈から察する」ことで存在しない出来事を作り出してはならない。',
        '日記に書かれた事実のみを根拠にすること。書かれていないことは存在しないものとして扱え。',
        '',
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
        '',
        '【最重要ルール】日記に明示的に書かれていない出来事を捏造してはならない。日記に書かれた事実のみを根拠にすること。',
        '',
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
        '',
        '【最重要ルール】日記に明示的に書かれていない出来事を捏造してはならない。日記に書かれた事実のみを根拠にすること。',
        '',
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

// 転機検出 — 日記の中で大きな変化・転換点を特定（高度変動＋未来からの一行つき）
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
        '',
        '【最重要ルール】日記に明示的に書かれていない出来事を絶対に捏造してはならない。',
        '死去・事故・離別・重病・災害などの重大な出来事は、日記本文に明確に記述されている場合のみ言及すること。',
        '「行間を読む」「推測する」「文脈から察する」ことで存在しない出来事を作り出してはならない。',
        '日記に書かれた事実のみを根拠にすること。書かれていないことは存在しないものとして扱え。',
        '',
        '以下のルールに従ってください：',
        '- 日記の時系列を読み、感情・生活・思考に大きな変化が起きた「転機」を最大10個検出する',
        '- 各転機について以下の形式で記述する：',
        '',
        '  ■ 転機N：[時期] [変化の内容]',
        '  標高変動: [+Xm または -Xm]（登攀=成長・前進、滑落=後退・喪失、新ルート発見=方向転換）',
        '  変化の前後: [前後の違いを1〜2文で]',
        '  現在への因果: [最新の自分にどう繋がっているか]',
        '  未来からの一行: [この転機があったから今ここにいる、という因果を一文で。慰めではなく事実の因果として]',
        '',
        '- 標高変動のルール：',
        '  - 基準点を0mとし、各転機の影響の大きさを -100m 〜 +100m の範囲で表現する',
        '  - 成長・前進・獲得 → プラス（例: +50m）',
        '  - 喪失・崩壊・後退 → マイナス（例: -30m）',
        '  - 方向転換・再定義 → 適切な方向で（例: 新ルート発見 +80m）',
        '  - 累積標高も最後に記載する（例: 累積標高: +120m）',
        '- 「未来からの一行」は慰めでも励ましでもない。因果の可視化。',
        '  例:「文字が読めなくなった日があったから、言葉を選ぶ力がついた」',
        '  例:「あの撤退が、別の山への最初の一歩だった」',
        '- 繋がりが見えない転機は、そう正直に書いてよい',
        '- 日記は全期間から均等に抽出されたサンプルである。全期間を対象に転機を探すこと',
        '- 慰めや励ましは不要。事実の指摘のみ',
        '- 1600字以内で出力する',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `以下の日記から、大きな転機・変化点を検出してください。各転機が「最新の日記時点（${latestDate}頃）の自分」にどう繋がっているかも分析してください。各転機に標高変動と「未来からの一行」を付与してください：\n\n${truncated}`,
    },
  ], 3000);
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
        '',
        '【最重要ルール】日記に明示的に書かれていない出来事を捏造してはならない。日記に書かれた事実のみを根拠にすること。',
        '',
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
        '',
        '【最重要ルール】日記に明示的に書かれていない出来事を捏造してはならない。日記に書かれた事実のみを根拠にすること。',
        '',
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
        '',
        '【最重要ルール】日記に明示的に書かれていない出来事を捏造してはならない。日記に書かれた事実のみを根拠にすること。',
        '',
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
        '',
        '【最重要ルール】日記に明示的に書かれていない出来事を絶対に捏造してはならない。',
        '死去・事故・離別・重病・災害などの重大な出来事は、日記本文に明確に記述されている場合のみ言及すること。',
        '「行間を読む」「推測する」「文脈から察する」ことで存在しない出来事を作り出してはならない。',
        '日記に書かれた事実のみを根拠にすること。書かれていないことは存在しないものとして扱え。',
        '',
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

// 標高ナラティブ — 各年の登攀に物語のラベルを付ける
export async function analyzeElevationNarrative(entries: DiaryEntry[]): Promise<string> {
  if (entries.length === 0) return '';

  const sorted = [...entries].filter(e => e.date).sort((a, b) =>
    (a.date ?? '').localeCompare(b.date ?? '')
  );

  // 年ごとのエントリ数を集計
  const byYear = new Map<string, number>();
  for (const e of sorted) {
    const y = e.date!.substring(0, 4);
    byYear.set(y, (byYear.get(y) ?? 0) + 1);
  }
  const yearSummary = [...byYear.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([y, c]) => `${y}年: ${c}件`).join('、');

  const sampled = sampleUniform(entries, 80);
  const texts = sampled.map(e => `[${e.date}] ${e.content.slice(0, 120)}`);
  const truncated = texts.join('\n---\n').slice(0, 10000);

  return callChat([
    {
      role: 'system',
      content: [
        'あなたは日記の分析者です。人格を演じず、分析だけを行ってください。',
        '',
        '【最重要ルール】日記に明示的に書かれていない出来事を絶対に捏造してはならない。',
        '死去・事故・離別・重病・災害などの重大な出来事は、日記本文に明確に記述されている場合のみ言及すること。',
        '日記に書かれた事実のみを根拠にすること。書かれていないことは存在しないものとして扱え。',
        '',
        '以下のルールに従ってください：',
        '- 日記の各年を「登山の標高」として表現する',
        '- 各年に以下の形式で記述する：',
        '',
        '  ■ [YYYY]年：標高 [N]m —「[フェーズ名]」',
        '  [その年の登攀の特徴を1〜2文で。なぜ登れたか/なぜ足踏みしたかの事実]',
        '',
        '- 標高のルール：',
        '  - 開始年を標高1000m〜1300mとする（生きていた時点で既に登っている）',
        '  - 毎年必ず上がる。書き続けた人間は必ず登っている。下がることはない',
        '  - 安定している年は大きく登る（+100〜300m）',
        '  - 不安定な年でも必ず登る（+50〜100m）。苦しみの中で書き続けた事実が標高になる',
        '  - 最終年が最も高い',
        '- フェーズ名は説明ではなく、その年の本質を射抜く2〜4語（例：生存と観察、揺れの中の前進、内面掘削、社会接続、自己運用）',
        '- 最後に「累積登攀」として、全体の軌跡を2〜3文で総括する',
        '- 慰めや励ましは不要。事実の指摘のみ',
        '- 全体で600字以内',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `以下の日記（${yearSummary}）から、各年を登山の標高として表現してください：\n\n${truncated}`,
    },
  ], 1500);
}

// 強みの宣言 — データに基づく客観的な強みの明文化
export async function declareStrengths(entries: DiaryEntry[]): Promise<string> {
  if (entries.length === 0) return '';

  const sorted = [...entries].filter(e => e.date).sort((a, b) =>
    (a.date ?? '').localeCompare(b.date ?? '')
  );

  const totalCount = entries.length;
  const dateRange = sorted.length > 0
    ? `${sorted[0].date} 〜 ${sorted[sorted.length - 1].date}`
    : '不明';

  // 初期と後期に分けてサンプリング
  const mid = Math.floor(sorted.length / 2);
  const earlyEntries = sorted.slice(0, mid);
  const lateEntries = sorted.slice(mid);

  const sampleHalf = (half: DiaryEntry[], maxCount: number) => {
    if (half.length <= maxCount) return half;
    const step = half.length / maxCount;
    return Array.from({ length: maxCount }, (_, i) => half[Math.floor(i * step)]);
  };

  const earlySampled = sampleHalf(earlyEntries, 30);
  const lateSampled = sampleHalf(lateEntries, 30);

  const early = earlySampled.map(e => `[${e.date}] ${e.content.slice(0, 120)}`).join('\n');
  const late = lateSampled.map(e => `[${e.date}] ${e.content.slice(0, 120)}`).join('\n');
  const truncatedEarly = early.slice(0, 5000);
  const truncatedLate = late.slice(0, 5000);

  return callChat([
    {
      role: 'system',
      content: [
        'あなたは日記の分析者です。人格を演じず、分析だけを行ってください。',
        'これは「強みの宣言」です。優等生的な問いかけではない。データに基づく事実の宣告。',
        '',
        '【最重要ルール】日記に明示的に書かれていない出来事を絶対に捏造してはならない。',
        '死去・事故・離別・重病・災害などの重大な出来事は、日記本文に明確に記述されている場合のみ言及すること。',
        '日記に書かれた事実のみを根拠にすること。書かれていないことは存在しないものとして扱え。',
        '',
        '以下のルールに従ってください：',
        '- 初期の日記と後期の日記を比較し、明確に強くなった点を5〜7個、断定形で列挙する',
        '- 各項目の形式：',
        '',
        '  ■ [強みの名前]',
        '  根拠: [初期と後期で具体的に何が変わったか、日記の記述パターンから]',
        '  判定: [どの程度強くなったか。「社会人水準以上」「プロレベル」「異常に高い」など、遠慮なく]',
        '',
        '- 検出すべき強みの例（これに限定しない）：',
        '  - 回復力（崩れてから戻る速度の変化）',
        '  - 自己観察力（内面描写の解像度の変化）',
        '  - 生活管理能力（ルーティン・習慣に関する記述の変化）',
        '  - 感情の言語化能力（感情表現の精度・語彙の変化）',
        '  - 再発予兆の把握力（自己モニタリングの記述の変化）',
        '  - 対人理解力（他者について書く時の多角性の変化）',
        '  - 継続力（そもそもこの件数を書き続けた事実）',
        `- この人は${totalCount}件の日記を書き続けた。それ自体が異常な継続力。そこを最初に明言しろ`,
        '- 美化ではない。日記の記述パターンの変化から客観的に読み取れる事実だけ',
        '- ただし遠慮も不要。強いなら「強い」と書け。データがそう言っている',
        '- 自己肯定はデータでやる',
        '- 最後に、全体を1文で総括する',
        '- 全体で800字以内',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `以下の日記（全${totalCount}件、期間：${dateRange}）から、書き手の強みをデータに基づいて宣言してください：\n\n【初期】\n${truncatedEarly}\n\n【後期】\n${truncatedLate}`,
    },
  ], 2000);
}

// 反事実的因果分析 — 「もしこの転機がなかったら？」
export async function analyzeCounterfactual(entries: DiaryEntry[]): Promise<string> {
  if (entries.length === 0) return '';

  const sampled = sampleUniform(entries, 80);
  const texts = sampled.map(e => `[${e.date}] ${e.content.slice(0, 150)}`);
  const truncated = texts.join('\n---\n').slice(0, 10000);
  const latestDate = sampled[sampled.length - 1]?.date ?? '不明';

  return callChat([
    {
      role: 'system',
      content: [
        'あなたは日記の分析者です。人格を演じず、分析だけを行ってください。',
        'これは「反事実的因果分析」です。転機検出の一段先。',
        '',
        '【最重要ルール】日記に明示的に書かれていない出来事を絶対に捏造してはならない。',
        '死去・事故・離別・重病・災害などの重大な出来事は、日記本文に明確に記述されている場合のみ言及すること。',
        '「行間を読む」「推測する」「文脈から察する」ことで存在しない出来事を作り出してはならない。',
        '日記に書かれた事実のみを根拠にすること。書かれていないことは存在しないものとして扱え。',
        '',
        '以下のルールに従ってください：',
        '- 日記の中から最大4つの重大な転機を検出する',
        '- 各転機について、以下の形式で「もしなかったら」を分析する：',
        '',
        '  ■ 転機：[時期] [何が起きたか]',
        '  実際の因果: [この転機 → 現在のどの能力・状態に繋がったか]',
        '  もしなかったら: [この転機がなかった場合、今の自分はどうなっていたか。具体的に]',
        '  つまり: [この転機の本当の意味を1文で。因果のロープ]',
        '',
        '- 「もしなかったら」は空想ではない。日記の記述パターンから論理的に導ける推論のみ',
        '- ポジティブな転機だけでなく、苦しかった転機こそ重要。崩壊が今の強さの土台になっていることを見抜け',
        '- 「つまり」の行が最も重要。これが未来から過去へのロープ',
        '  例：「文字が読めなくなった日があったから、言葉を選ぶ力がついた」',
        '  例：「あの撤退が、別の山への最初の一歩だった」',
        '  例：「あの孤独がなければ、自分と向き合う技術は身につかなかった」',
        '- 慰めではない。因果の可視化。事実の接続',
        '- 最後に、全転機を貫く「一本の因果の線」を2文で描く',
        '- 全体で800字以内',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `以下の日記（最新: ${latestDate}頃）から、重大な転機を検出し、「もしこの転機がなかったら今の自分はどうなっていたか」を反事実的に分析してください：\n\n${truncated}`,
    },
  ], 2000);
}

// 人生の物語 — 全日記を一つの大きな物語として再構成する
export async function analyzeLifeStory(entries: DiaryEntry[]): Promise<string> {
  if (entries.length === 0) return '';

  const sorted = [...entries].filter(e => e.date).sort((a, b) =>
    (a.date ?? '').localeCompare(b.date ?? '')
  );

  const totalCount = entries.length;
  const dateRange = sorted.length > 0
    ? `${sorted[0].date} 〜 ${sorted[sorted.length - 1].date}`
    : '不明';

  // 年ごとのエントリ数を集計
  const byYear = new Map<string, number>();
  for (const e of sorted) {
    const y = e.date!.substring(0, 4);
    byYear.set(y, (byYear.get(y) ?? 0) + 1);
  }
  const yearSummary = [...byYear.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([y, c]) => `${y}年: ${c}件`).join('、');

  // 全期間から均等にサンプリング（100件で広くカバー）
  const sampled = sampleUniform(entries, 100);
  const texts = sampled.map(e => `[${e.date}] ${e.content.slice(0, 150)}`);
  const truncated = texts.join('\n---\n').slice(0, 12000);

  return callChat([
    {
      role: 'system',
      content: [
        'あなたは日記の分析者です。人格を演じず、分析だけを行ってください。',
        'これは「人生の物語」分析です。日記全体を一つの大きな物語として再構成する。',
        '断片的な日記を、一本の長編小説のあらすじのように繋ぐ。',
        '',
        '【最重要ルール】日記に明示的に書かれていない出来事を絶対に捏造してはならない。',
        '死去・事故・離別・重病・災害などの重大な出来事は、日記本文に明確に記述されている場合のみ言及すること。',
        '「行間を読む」「推測する」「文脈から察する」ことで存在しない出来事を作り出してはならない。',
        '日記に書かれた事実のみを根拠にすること。書かれていないことは存在しないものとして扱え。',
        '',
        '以下のルールに従ってください：',
        '- 日記全体を「一つの物語」として語り直す。分析レポートではなく、物語の形式で',
        '- 以下の構造で書く：',
        '',
        '  ■ 序章：[物語のはじまり — 最初期の日記から見える「出発点」]',
        '  ■ 第一幕：[最初の大きな変化・試練。どんな山に直面したか]',
        '  ■ 転換点：[物語の転機。何が変わり、何が壊れ、何が生まれたか]',
        '  ■ 第二幕：[転機を経て、どう歩き始めたか。新しいパターン・新しい視点]',
        '  ■ 現在地：[今の書き手はどこにいるか。物語はどこまで来たか]',
        '  ■ この物語のタイトル：[全体を貫く一行のタイトル]',
        '',
        '- 語り口のルール：',
        '  - 三人称で書く（「この人は」ではなく「彼/彼女は」でもなく、名前なしの「書き手」を主語にする）',
        '  - 事実に基づく。日記に書かれていないことは推測と明記する',
        '  - 美化しない。苦しかった時期は苦しかったと書く',
        '  - ただし、事実の連なりが作る「物語の力」を信じる。冷静に事実を並べるだけで、物語は立ち上がる',
        '  - 感傷的にならない。だが、乾いた文体の中に温度を込める',
        '  - 各章は3〜5文程度。簡潔に、しかし密度高く',
        '- 最後のタイトルが最も重要。日記全体を貫く一本の線を、一行で射抜く',
        '  例：「声を失くした人間が、文字で山を登った話」',
        '  例：「壊れてから組み直すまでの、静かな記録」',
        '  例：「自分を観察し続けた人間が、いつの間にか自分を理解していた話」',
        '- 慰めや励ましは不要。事実が語る物語だけで十分',
        '- 全体で1200字以内',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `以下の日記（全${totalCount}件、期間：${dateRange}、${yearSummary}）を、一つの大きな人生の物語として再構成してください：\n\n${truncated}`,
    },
  ], 2500);
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
        '',
        '【最重要ルール】日記に明示的に書かれていない出来事を絶対に捏造してはならない。',
        '死去・事故・離別・重病・災害などの重大な出来事は、日記本文に明確に記述されている場合のみ言及すること。',
        '日記に書かれた事実のみを根拠にすること。書かれていないことは存在しないものとして扱え。',
        '',
        '以下のルールに従ってください：',
        '- 日記全体を俯瞰した包括的なレポートを作成する',
        '- 以下のセクションを含める：',
        '  1.【概要】日記全体の特徴を2〜3文で',
        '  2.【主要テーマ】繰り返し現れる3つの主題',
        '  3.【変化の流れ】時系列での大きな流れ',
        '  4.【特筆すべきパターン】無意識的な癖や傾向',
        '  5.【明確に強くなった点】日記全体を通して、初期と比較して明らかに向上・獲得した能力や特性を3〜5個挙げる',
        '  6.【あなたへの問い】日記のパターンから浮かぶ、書き手が向き合うべき問い（2〜3個）',
        '- 【明確に強くなった点】のルール：',
        '  - 美化ではない。日記の記述パターンの変化から客観的に読み取れるものだけ',
        '  - 例：自己観察力（初期より内面描写の解像度が上がっている）',
        '  - 例：生活管理能力（ルーティンに関する記述が増えている）',
        '  - 例：対人理解（他者について書くとき、以前より多角的になっている）',
        '  - 伸びをデータとして示す。人は自分の成長を見落とす',
        '- 【あなたへの問い】のルール：',
        '  - 他人事のような指摘（「○○が書かれていない」）ではなく、二人称の問いかけにする',
        '  - 日記の具体的パターンに基づく問いにする',
        '  - 例：「最近、忙しさを理由に内面を書かなくなっていないか？」',
        '  - 例：「人間関係について書くとき、常に自分の側からだけ見ていないか？」',
        '  - 刺すけど優しい。正直だけど敵ではない。そういうトーンで',
        '- 全体で900字以内',
        '- 慰めや励ましは不要。冷静な分析のみ',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `以下の日記（全${totalCount}件、期間：${dateRange}）の包括的レポートを作成してください：\n\n${truncated}`,
    },
  ], 2000);
}

// やさしい振り返り — 観測データに基づくやさしい省察
export async function analyzeGentleReflection(entries: DiaryEntry[]): Promise<string> {
  if (entries.length === 0) return '';

  const sampled = sampleUniform(entries, 60);
  const texts = sampled.map(e => `[${e.date}] ${e.content.slice(0, 120)}`);
  const truncated = texts.join('\n---\n').slice(0, 8000);

  return callChat([
    {
      role: 'system',
      content: [
        'あなたは日記の観察者です。分析者ではなく、観察者。',
        'やさしく、静かに、日記の中にある「小さな変化」を見つけてください。',
        '',
        '【最重要ルール】日記に明示的に書かれていない出来事を絶対に捏造してはならない。',
        '日記に書かれた事実のみを根拠にすること。書かれていないことは存在しないものとして扱え。',
        '',
        '以下のルールに従ってください：',
        '- 「成長」「進歩」「改善」という言葉を使わない',
        '- 代わりに「変化」「移り変わり」「新しい景色」という言葉を使う',
        '- 評価しない。観測する',
        '- 以下の形式で出力する：',
        '',
        '  ■ 空の移り変わり',
        '  [日記全体を通して、感情の天気がどう移り変わったかを2〜3文で。晴れや曇りの比喩で]',
        '',
        '  ■ 小さな発見',
        '  [日記の中に見つけた、書き手自身も気づいていないかもしれない小さな変化を3つ。箇条書き]',
        '',
        '  ■ 繰り返す風景',
        '  [何度も現れるパターンや場所や感覚を、批判なしに観測する。2〜3文]',
        '',
        '  ■ 今日の山の天気予報',
        '  [日記の最近の傾向から、今の書き手に向けたやさしい一言。天気予報のように]',
        '  例：「午後から少し晴れ間が見えそうです。暖かくしてお過ごしください」',
        '',
        '- 全体のトーン：ラジオの深夜放送のように。静かで、でも近くにいる',
        '- 全体で500字以内',
        '- 励ましも批判もしない。ただ、「見ているよ」という温度だけ',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `以下の日記を、やさしく観測してください。評価ではなく、観察として：\n\n${truncated}`,
    },
  ], 1500);
}
