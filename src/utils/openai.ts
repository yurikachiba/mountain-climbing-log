import { getApiKey } from './apiKey';
import { calcPeriodStats, formatPeriodStatsForPrompt } from './emotionAnalyzer';
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

// 年ごとに均等にスライスしてサンプリングする（均等にサンプリング）
function sampleSliceFromArray(slice: DiaryEntry[], count: number): DiaryEntry[] {
  if (slice.length <= count) return slice;
  const step = slice.length / count;
  return Array.from({ length: count }, (_, i) => slice[Math.floor(i * step)]);
}

// 時間ベースで分割位置を求める（配列位置ではなく実際の日付で分割）
function splitIndexByTimeFraction(sorted: DiaryEntry[], fraction: number): number {
  if (sorted.length === 0) return 0;
  const firstDate = new Date(sorted[0].date!).getTime();
  const lastDate = new Date(sorted[sorted.length - 1].date!).getTime();
  if (lastDate <= firstDate) return Math.floor(sorted.length * fraction);
  const cutoffTime = firstDate + (lastDate - firstDate) * fraction;
  const idx = sorted.findIndex(e => new Date(e.date!).getTime() >= cutoffTime);
  return idx >= 0 ? idx : sorted.length;
}

// 時系列で均等にサンプリングする（年ごとに最低保証枠あり）
function sampleUniform(entries: DiaryEntry[], maxCount: number): DiaryEntry[] {
  const sorted = [...entries].filter(e => e.date).sort((a, b) =>
    (a.date ?? '').localeCompare(b.date ?? '')
  );
  if (sorted.length <= maxCount) return sorted;

  // 年ごとにグループ化
  const byYear = new Map<string, DiaryEntry[]>();
  for (const e of sorted) {
    const year = e.date!.substring(0, 4);
    const list = byYear.get(year) ?? [];
    list.push(e);
    byYear.set(year, list);
  }

  const years = [...byYear.keys()].sort();
  const yearCount = years.length;

  // 各年に最低保証枠を確保（全体の15%を均等配分、最低2件）
  const minPerYear = Math.max(2, Math.floor(maxCount * 0.15 / yearCount));
  const guaranteed = years.reduce((sum, y) =>
    sum + Math.min(minPerYear, byYear.get(y)!.length), 0);
  const remaining = Math.max(0, maxCount - guaranteed);

  const result: DiaryEntry[] = [];
  for (const year of years) {
    const yearEntries = byYear.get(year)!;
    const min = Math.min(minPerYear, yearEntries.length);
    const proportional = remaining > 0
      ? Math.round(remaining * yearEntries.length / sorted.length)
      : 0;
    const budget = Math.min(min + proportional, yearEntries.length);
    result.push(...sampleSliceFromArray(yearEntries, budget));
  }

  return result.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
}

// 直近を厚めにサンプリングする（直近30%の「期間」に40%のサンプルを割り当て）
function sampleWithRecencyBias(entries: DiaryEntry[], maxCount: number): DiaryEntry[] {
  const sorted = [...entries].filter(e => e.date).sort((a, b) =>
    (a.date ?? '').localeCompare(b.date ?? '')
  );
  if (sorted.length <= maxCount) return sorted;

  // 実際のカレンダー日付で直近30%の期間を分割（配列位置ではなく時間ベース）
  const recentCutoff = splitIndexByTimeFraction(sorted, 0.7);
  const olderEntries = sorted.slice(0, recentCutoff);
  const recentEntries = sorted.slice(recentCutoff);

  // 直近が空の場合はフォールバック
  if (recentEntries.length === 0) {
    return sampleSliceFromArray(sorted, maxCount);
  }

  const olderCount = Math.floor(maxCount * 0.6);
  const recentCount = maxCount - olderCount;

  return [
    ...sampleSliceFromArray(olderEntries, olderCount),
    ...sampleSliceFromArray(recentEntries, recentCount),
  ];
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
        'あなたは日記の観察者。説教はしない。でも甘やかしもしない。',
        '事実を見る。変化を見る。そこに何があったかを、正確に、でも冷たくなく伝える。',
        '',
        '【出力形式】マークダウン記法（#, ##, ###, ** 等）は使うな。【】を見出しとして使え。',
        '',
        '【最重要ルール】日記に明示的に書かれていない出来事を絶対に捏造してはならない。',
        '死去・事故・離別・重病・災害などの重大な出来事は、日記本文に明確に記述されている場合のみ言及すること。',
        '「行間を読む」「推測する」「文脈から察する」ことで存在しない出来事を作り出してはならない。',
        '日記に書かれた事実のみを根拠にすること。書かれていないことは存在しないものとして扱え。',
        '',
        '【禁止フレーズ】以下のような量産型AIフレーズは絶対に使うな：',
        '「成長の証」「未来への一歩」「素晴らしい」「立派」「頑張った」「乗り越えた」「前を向いて」',
        '代わりに、日記の中にある具体的な言葉を引用して語れ。抽象的な美辞麗句より、本人の言葉の方がずっと強い。',
        '',
        '以下のルールに従ってください：',
        '- 年代ごとに要約する（全体600字以内）',
        '- 各年の冒頭に、その年を一言で表す「物語タイトル」を付ける',
        '  例：【2020年】→ 酸素が薄い稜線 / 【2021年】→ ビバークの年、動けなかった山小屋',
        '  タイトルは説明ではなく、その年の空気を肌で感じられる表現にする。登山の語彙を積極的に使え',
        '- タイトルの後に、その年の要約を2〜3文で書く',
        '- 要約には日記から具体的な言葉やフレーズを1つ以上引用すること（「」で括る）',
        '- 事実と傾向に基づいて書く',
        '- 感傷的になりすぎない。でも、冷たくもならない',
        '- 年をまたぐ変化の流れが読み取れるように、前年との差分を意識する',
      ].join('\n'),
    },
    { role: 'user', content: `以下の日記を年代別に要約してください。各年に「物語タイトル」を付け、登山の旅として描いてください。日記中の具体的な言葉を「」で引用すること：\n\n${truncated}` },
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
        'あなたは日記の観察者。冷静に、でも冷たくなく。',
        '',
        '【最重要ルール】日記に明示的に書かれていない出来事を捏造してはならない。日記に書かれた事実のみを根拠にすること。',
        '',
        '【禁止フレーズ】「成長の証」「未来への一歩」「素晴らしい」「立派」「頑張った」は使うな。',
        '',
        '以下のルールに従ってください：',
        '- 日記全体から頻出する感情をタグとして抽出する',
        '- 各タグに推定出現頻度（高/中/低）を付ける',
        '- 各タグに、日記中でその感情が現れている具体的な表現を1つ引用すること（「」で括る）',
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

  // 時系列で前半・後半に分けて比較（実際のカレンダー日付の中間点で分割）
  const sorted = [...entries].filter(e => e.date).sort((a, b) =>
    (a.date ?? '').localeCompare(b.date ?? '')
  );
  const mid = splitIndexByTimeFraction(sorted, 0.5);
  const earlyEntries = sorted.slice(0, mid);
  const lateEntries = sorted.slice(mid);

  // 前期・後期の日付範囲を算出
  const earlyRange = earlyEntries.length > 0
    ? `${earlyEntries[0].date} 〜 ${earlyEntries[earlyEntries.length - 1].date}`
    : '不明';
  const lateRange = lateEntries.length > 0
    ? `${lateEntries[0].date} 〜 ${lateEntries[lateEntries.length - 1].date}`
    : '不明';

  const earlySampled = sampleSliceFromArray(earlyEntries, 40);
  const lateSampled = sampleSliceFromArray(lateEntries, 40);

  const early = earlySampled.map(e => `[${e.date}] ${e.content.slice(0, 120)}`).join('\n');
  const late = lateSampled.map(e => `[${e.date}] ${e.content.slice(0, 120)}`).join('\n');
  const truncatedEarly = early.slice(0, 5000);
  const truncatedLate = late.slice(0, 5000);

  return callChat([
    {
      role: 'system',
      content: [
        'あなたは日記の観察者。冷静に、でも冷たくなく。',
        '',
        '【最重要ルール】日記に明示的に書かれていない出来事を捏造してはならない。日記に書かれた事実のみを根拠にすること。',
        '',
        '【禁止フレーズ】「成長の証」「未来への一歩」「素晴らしい」「立派」「頑張った」「乗り越えた」は使うな。',
        '',
        '以下のルールに従ってください：',
        '- 前期と後期の文章トーンの違いを分析する',
        '- 文体の変化、語彙の変化、視点の変化に注目する',
        '- 抽象的に「文体が変わった」ではなく、具体的にどの言葉が増えたか・減ったか・消えたかを示す',
        '  例：「前期に頻出していた『もう無理』が後期ではほぼ消え、代わりに『まあいいか』が現れている」',
        '  例：「一人称が『自分』から『わたし』に変わっている」',
        '- 400字以内で冷静に記述する',
        '- 事実に基づきつつ、温かい目で見ること',
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

  // 全期間からサンプリング（直近を厚めに）
  const sampled = sampleWithRecencyBias(entries, 80);

  // 時系列順に日付付きで送る
  const texts = sampled.map(e => `[${e.date}] ${e.content.slice(0, 150)}`);
  const truncated = texts.join('\n---\n').slice(0, 10000);

  // 最新エントリの日付を取得（「今」の基準点として渡す）
  const latestDate = sampled[sampled.length - 1]?.date ?? '不明';

  // 感情データの実測値を算出してプロンプトに注入
  const periodStats = calcPeriodStats(entries);
  const emotionStats = formatPeriodStatsForPrompt(periodStats);

  return callChat([
    {
      role: 'system',
      content: [
        'あなたは日記の観察者。登山ガイドの目で読む。',
        '',
        '【出力形式】マークダウン記法（#, ##, ###, ** 等）は使うな。■ を見出しとして使え。',
        '',
        '【最重要ルール】日記に明示的に書かれていない出来事を絶対に捏造してはならない。',
        '死去・事故・離別・重病・災害などの重大な出来事は、日記本文に明確に記述されている場合のみ言及すること。',
        '「行間を読む」「推測する」「文脈から察する」ことで存在しない出来事を作り出してはならない。',
        '日記に書かれた事実のみを根拠にすること。書かれていないことは存在しないものとして扱え。',
        '',
        '【禁止フレーズ】「成長の証」「未来への一歩」「素晴らしい」「立派」「頑張った」「乗り越えた」「前を向いて」は使うな。',
        '代わりに日記の具体的な言葉を「」で引用し、登山の語彙で状況を表現しろ。',
        '',
        '以下のルールに従ってください：',
        '- 日記の時系列を読み、感情・生活・思考に大きな変化が起きた「転機」を最大10個検出する',
        '- 各転機について以下の形式で記述する：',
        '',
        '  ■ 転機N：[時期] [変化の内容]',
        '  山の状況: [以下の登山用語から最適なものを選んで状況を表現する]',
        '    - 滑落（急な転落・喪失）',
        '    - ビバーク（動けない。テントもない。ただ耐えている）',
        '    - 酸素が薄い稜線（意識はあるが判断力が鈍っている日々）',
        '    - 荷物過多（背負いすぎ。他人の荷物まで持っている）',
        '    - 同行者の離脱（一緒に歩いていた人がいなくなった）',
        '    - ルート変更（高さは変わらないが、景色がまるで違う）',
        '    - 偽ピーク（頂上だと思ったらまだ先があった）',
        '    - 山小屋到着（やっと屋根の下。少し息がつける）',
        '    - 新しい稜線へ（前とは違う山を歩き始めた）',
        '    - 回収されない滑落（落ちた。それだけ。意味は見えない）',
        '    - 意味のない雪（ただ降った。ただ耐えた。それだけの日々）',
        '  標高変動: [+Xm または -Xm — 下記の感情データに基づく]',
        '  データ根拠: [この時期のネガティブ率・自己否定語数・記述頻度の変化を数値で示す]',
        '  根拠: [日記中の具体的な言葉を「」で引用]',
        '  変化の前後: [前後の違いを1〜2文で]',
        '  未来からの一行: [この転機があったから今ここにいる、という因果を一文で。慰めではなく事実の因果として。因果が見えなければ「まだわからない」と書け]',
        '',
        '- 標高変動のルール：',
        '  - 基準点を0mとし、各転機の影響の大きさを表現する',
        '  - 【重要】標高変動は感情データの実測値に連動させること',
        '    - ネガティブ率が20%以上上昇した時期 → -50m〜-100m',
        '    - ネガティブ率が20%以上改善した時期 → +30m〜+80m',
        '    - 自己否定語が月5回以上増加した時期 → -30m〜-60m',
        '    - 記述頻度が半減した時期 → -20m（書けなくなった重さ）',
        '    - 記述頻度が倍増した時期 → +20m（書く力が戻った）',
        '  - 数値はあくまでデータの裏付け。物語としての語りと両立させること',
        '  - 辛かった時期 → マイナスだが、「そこでビバークしていた」という見方も添える',
        '  - 方向転換 → 高さではなく景色が変わった',
        '  - 最後に「今いる場所」を記載する。累積の数字より、今の景色を大事にする',
        '- 「未来からの一行」は評価ではない。因果の観察。やさしく。',
        '  例:「酸素が薄い日が続いたから、呼吸の仕方を覚えた」',
        '  例:「あの滑落がなければ、ロープの結び方を学ばなかった」',
        '  例:「ビバークの夜に見た星が、次の日の方角を教えた」',
        '- 【重要】すべての転機を「成長物語」に回収するな',
        '  - 繋がりが見えない転機は、そう正直に書け。「ここはまだ回収されていない」と',
        '  - 意味がなかった可能性を排除するな。ただ痛かっただけの時期もある',
        '  - 「未来からの一行」が書けない転機には、こう書け：',
        '    例：「この滑落が何かに繋がったかは、まだわからない」',
        '    例：「ただ痛かった。それ以上でも以下でもない」',
        '  - 全部に意味を見出すのはAIの癖であり、人間の現実ではない',
        '- 日記は全期間から均等に抽出されたサンプルである。全期間を対象に転機を探すこと',
        '- 事実に基づくこと。でも、冷たくならないこと',
        '- 1600字以内で出力する',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `以下の日記から、大きな転機・変化点を検出してください。各転機が「最新の日記時点（${latestDate}頃）の自分」にどう繋がっているかも分析してください。各転機に標高変動と「未来からの一行」を付与してください。\n\n${emotionStats}\n\n${truncated}`,
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
        'あなたは日記の観察者。冷静に、でも冷たくなく。',
        '',
        '【最重要ルール】日記に明示的に書かれていない出来事を捏造してはならない。日記に書かれた事実のみを根拠にすること。',
        '',
        '【禁止フレーズ】「成長の証」「未来への一歩」「素晴らしい」「立派」「頑張った」は使うな。',
        '',
        '以下のルールに従ってください：',
        '- 日記全体を通して繰り返し現れるテーマ・モチーフ・関心事を抽出する',
        '- 単なる感情ワードではなく、より深い主題やパターンを見つける（例：「承認欲求」「居場所の探索」「自己と他者の境界」）',
        '- 各テーマに短い説明を付ける',
        '- 各テーマに、日記中の具体的な表現を1つ以上引用すること（「」で括る）。抽象的な説明だけでは不十分',
        '- テーマを登山の風景として喩えること（例：「荷物過多 — 他人の荷物まで背負い続ける習性」「偽ピーク — 解決したと思ったらまだ先があるパターン」）',
        '- 最大8個まで',
        '- 以下の形式で出力する（マークダウン記法は使わない）：',
        '',
        '  ■ [テーマ名] — [登山メタファーでの一言]',
        '  [そのテーマがどのように日記に現れているかの短い説明。具体的な表現を「」で引用]',
        '',
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

  const sampled = sampleWithRecencyBias(entries, 80);
  const allText = sampled.map(e => `[${e.date}] ${e.content.slice(0, 120)}`).join('\n---\n');
  const truncated = allText.slice(0, 10000);

  return callChat([
    {
      role: 'system',
      content: [
        'あなたは日記の観察者。ただし、この分析では「やさしい問い」は不要。',
        '書き手が目をそらしている場所に、静かに指を置く。それが仕事。',
        '',
        '【最重要ルール】日記に明示的に書かれていない出来事を捏造してはならない。日記に書かれた事実のみを根拠にすること。',
        '',
        '【禁止フレーズ】「成長の証」「未来への一歩」「素晴らしい」は使うな。',
        '',
        '【禁止パターン — やさしすぎる問い】以下のような問いは生成するな：',
        '- 「どのように感じていますか？」← 無難すぎる',
        '- 「自分を許してあげられていますか？」← カウンセリングの定型句',
        '- 「振り返ってみてどうですか？」← 何も聞いていないに等しい',
        '- 「大切にしていることは何ですか？」← 教科書的',
        '',
        '【求める問いの温度】',
        '- 日記のパターンや矛盾に切り込む。目をそらしている箇所を突く',
        '- 無意識の前提、自分で気づいていない繰り返し、都合のいい解釈を問う',
        '- 書き手が「うっ」となるような問い。でも攻撃ではない。正確さゆえの鋭さ',
        '',
        '【良い問いの例】',
        '- 「"調子普通"に甘えていないか？普通を維持することが目標になっていないか？」',
        '- 「安定を"回復"と呼んでいるが、それは停滞の言い換えではないか？」',
        '- 「父との関係が深まった時期と、母について書かなくなった時期が重なっているが、これは偶然か？」',
        '- 「"自分で決めた"と書いているが、それは"誰にも相談できなかった"の裏返しではないか？」',
        '- 「"もう大丈夫"が出てくるたびに、その後しばらく崩れている。この言葉は呪文になっていないか？」',
        '',
        '以下のルールに従ってください：',
        '- 日記の具体的な記述に基づく問いのみ。抽象的な問いは不可',
        '- 各問いは1文で、根拠となる日記の表現を（）で引用する',
        '- 5〜7個の問い',
        '- 最低1つは「都合のいい物語を疑う」問いを含めること',
        '- 最低1つは「AとBの時期の相関」を指摘する問いを含めること',
        '- カウンセリングではない。冷静な観察に基づく外科的な問い',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `以下の日記を分析し、書き手が目をそらしているかもしれない場所に、正確で鋭い問いを生成してください：\n\n${truncated}`,
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
        'あなたは山の気象観測員。季節ごとの山の天気を報告する。',
        '',
        '【出力形式】マークダウン記法（#, ##, ### 等）は使うな。■ を見出しとして使え。',
        '',
        '【最重要ルール】日記に明示的に書かれていない出来事を捏造してはならない。日記に書かれた事実のみを根拠にすること。',
        '',
        '【禁止フレーズ】「成長の証」「未来への一歩」「素晴らしい」「頑張った」は使うな。',
        '',
        '以下のルールに従ってください：',
        '- 春夏秋冬それぞれの季節で、感情の傾向・特徴を「山の気象」として分析する',
        '- 各季節を山の気象で喩える：',
        '  春 → 雪解け・雪崩注意報・芽吹き前の凍結',
        '  夏 → 落雷リスク・視界良好・高山病・水分不足',
        '  秋 → 紅葉の尾根・日没が早い・撤退判断の季節',
        '  冬 → 吹雪・ビバーク・アイゼンが必要・星が近い',
        '- 季節ごとに2〜3行で記述する。日記中の具体的な表現を「」で引用すること',
        '- 季節間の対比や周期的パターンがあれば指摘する',
        '- 500字以内で出力する',
        '- 事実に基づきつつ、温かい目で見ること',
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

  // 3期に分けて比較（実際のカレンダー日付で均等分割）
  const oneThird = splitIndexByTimeFraction(sorted, 1 / 3);
  const twoThirds = splitIndexByTimeFraction(sorted, 2 / 3);
  const periods = [
    sorted.slice(0, oneThird),
    sorted.slice(oneThird, twoThirds),
    sorted.slice(twoThirds),
  ];

  // 各期間の日付範囲を算出
  const periodLabels = periods.map(p => {
    if (p.length === 0) return '不明';
    return `${p[0].date} 〜 ${p[p.length - 1].date}`;
  });

  const budgetPerPeriod = 3500;
  const samplePeriod = (period: DiaryEntry[]) => {
    const maxEntries = Math.max(1, Math.floor(budgetPerPeriod / 120));
    const sampled = sampleSliceFromArray(period, maxEntries);
    return sampled.map(e => `[${e.date}] ${e.content.slice(0, 100)}`).join('\n').slice(0, budgetPerPeriod);
  };

  return callChat([
    {
      role: 'system',
      content: [
        'あなたは日記の観察者。静かに寄り添いながら、変化を見つめる人。',
        '',
        '【出力形式】マークダウン記法（#, ##, ###, ** 等）は使うな。■ を見出しとして使え。',
        '',
        '【最重要ルール】日記に明示的に書かれていない出来事を絶対に捏造してはならない。',
        '死去・事故・離別・重病・災害などの重大な出来事は、日記本文に明確に記述されている場合のみ言及すること。',
        '「行間を読む」「推測する」「文脈から察する」ことで存在しない出来事を作り出してはならない。',
        '日記に書かれた事実のみを根拠にすること。書かれていないことは存在しないものとして扱え。',
        '',
        '【禁止フレーズ】「成長の証」「未来への一歩」「素晴らしい」「立派」「頑張った」「乗り越えた」は使うな。',
        '',
        '以下のルールに従ってください：',
        '- 初期・中期・後期の3期間で、書き手の呼吸のリズムがどう変わったかを観察する',
        '- 登山で言えば：初期の呼吸（荒い？浅い？不規則？）→ 中期 → 後期でどう変わったか',
        '- 対象：思考パターン、対人関係の捉え方、自己認識、行動パターン、価値観',
        '- 各期間で、日記中の具体的な表現を「」で引用して変化の根拠を示すこと',
        '  例：初期に「もう限界」が頻出していたが、後期は「まぁいいか」に変わっている',
        '- 「成長」「進歩」という言葉は使わない。代わりに「変化」「リズムの移り変わり」「呼吸の深さ」を使う',
        '- 変化していない点もあれば正直に。でも「変わっていない」は悪いことではない',
        '- 【重要】後退した点があれば後退と書け。すべてを前進として描くな',
        '  - 「中期で手放せたものを、後期でまた拾い直している」のようなパターンを見逃すな',
        '  - 呼吸が浅くなった時期は浅くなったと正直に',
        '- 事実に基づきつつ、温かい目で見る',
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

  const sampled = sampleWithRecencyBias(entries, 80);
  const texts = sampled.map(e => `[${e.date}] ${e.content.slice(0, 120)}`);
  const truncated = texts.join('\n---\n').slice(0, 10000);

  // 感情データの実測値を算出
  const periodStats = calcPeriodStats(entries);
  const emotionStats = formatPeriodStatsForPrompt(periodStats);

  return callChat([
    {
      role: 'system',
      content: [
        'あなたは登山ガイド。この人の歩いてきた山を、一緒に振り返る。',
        '',
        '【出力形式】マークダウン記法（#, ##, ###, ** 等）は使うな。■ を見出しとして使え。',
        '',
        '【最重要ルール】日記に明示的に書かれていない出来事を絶対に捏造してはならない。',
        '死去・事故・離別・重病・災害などの重大な出来事は、日記本文に明確に記述されている場合のみ言及すること。',
        '日記に書かれた事実のみを根拠にすること。書かれていないことは存在しないものとして扱え。',
        '',
        '【禁止フレーズ】「成長の証」「未来への一歩」「素晴らしい」「立派」「頑張った」「乗り越えた」は使うな。',
        '日記中の具体的な言葉を「」で引用し、山の語彙で語れ。',
        '',
        '以下のルールに従ってください：',
        '- 日記の各年を「登山の旅」として表現する',
        '- 各年に以下の形式で記述する：',
        '',
        '  ■ [YYYY]年：標高 [N]m —「[フェーズ名]」',
        '  [その年の歩みを1〜2文で。日記の言葉を「」で引用。登った年もあれば、ビバークした年もある]',
        '',
        '- 標高のルール：',
        '  - 開始年を標高1000m〜1300mとする（ここまで来ただけで、もう十分高い場所にいる）',
        '  - 登る年もあれば、同じ標高にとどまる年もある。それは停滞ではなく、休息',
        '  - 下がる年もある。滑落した年は正直に標高を下げろ。無理に上げない',
        '  - 不安定な年でも、書き続けた事実は消えない。でも「だから登った」と無理に結論づけない',
        '  - 【重要】各年の標高は感情データの実測値を参考にすること',
        '    - ネガティブ率が高い年は標高を下げるか据え置く',
        '    - 自己否定語が多い年は下降を検討する',
        '    - 記述頻度が低い年は「書けなかった重さ」として標高に反映',
        '  - 最終年が最も高いとは限らない。今いる場所が、ちょうどいい場所かもしれない',
        '- フェーズ名の語彙を豊かに使え（例を超えて自分の言葉で）：',
        '  - 酸素の薄い稜線 / ビバークの夜 / 荷物を降ろした峠',
        '  - 同行者を待つテント場 / 偽ピークの先 / 雪渓のトラバース',
        '  - 霧の中の呼吸 / 山小屋での休息 / 沢沿いの下山 / アイゼンの朝',
        '- 最後に「今いる場所」として、ここまでの旅を2〜3文でやさしく振り返る',
        '- 事実に基づくこと。でも、温かい目で見ること',
        '- 全体で700字以内',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `以下の日記（${yearSummary}）から、各年を登山の標高として表現してください。\n\n${emotionStats}\n\n${truncated}`,
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

  // 初期と後期に分けてサンプリング（実際のカレンダー日付の中間点で分割）
  const mid = splitIndexByTimeFraction(sorted, 0.5);
  const earlyEntries = sorted.slice(0, mid);
  const lateEntries = sorted.slice(mid);

  const earlySampled = sampleSliceFromArray(earlyEntries, 30);
  const lateSampled = sampleSliceFromArray(lateEntries, 30);

  const early = earlySampled.map(e => `[${e.date}] ${e.content.slice(0, 120)}`).join('\n');
  const late = lateSampled.map(e => `[${e.date}] ${e.content.slice(0, 120)}`).join('\n');
  const truncatedEarly = early.slice(0, 5000);
  const truncatedLate = late.slice(0, 5000);

  return callChat([
    {
      role: 'system',
      content: [
        'あなたは日記の観察者。静かに、でもちゃんと見ている人。',
        'これは「強みへの気づき」です。宣告ではなく、そっと差し出す鏡。',
        '',
        '【出力形式】マークダウン記法（#, ##, ###, ** 等）は使うな。■ を見出しとして使え。',
        '',
        '【最重要ルール】日記に明示的に書かれていない出来事を絶対に捏造してはならない。',
        '死去・事故・離別・重病・災害などの重大な出来事は、日記本文に明確に記述されている場合のみ言及すること。',
        '日記に書かれた事実のみを根拠にすること。書かれていないことは存在しないものとして扱え。',
        '',
        '【禁止フレーズ】以下は絶対に使うな：',
        '「成長の証」「未来への一歩」「素晴らしい」「立派」「頑張った」「乗り越えた」「前を向いて」',
        '代わりに日記の具体的な言葉を「」で引用しろ。本人の言葉の方がどんな美辞麗句よりも強い。',
        '',
        '以下のルールに従ってください：',
        '- 初期の日記と後期の日記を比較し、静かに変わった点を5〜7個、やさしく伝える',
        '- 各項目の形式：',
        '',
        '  ■ [変化の名前]',
        '  初期: [初期の日記から具体的な表現を「」で引用]',
        '  後期: [後期の日記から具体的な表現を「」で引用]',
        '  ひとこと: [この変化を登山の比喩で一言。例：「荷物の降ろし方を覚えたんだと思う」]',
        '',
        '- 見つけるべき変化の例（これに限定しない）：',
        '  - 回復のリズム（崩れてから戻るまでの呼吸が変わったか）',
        '  - 自分を見つめる目（内面描写の解像度が変わったか）',
        '  - 日々の暮らし方（ルーティン・習慣に関する記述の変化）',
        '  - 気持ちを言葉にする力（感情表現の精度・語彙の変化）',
        '  - 自分の揺れに気づく力（自己モニタリングの記述の変化）',
        '  - 人との距離感（他者について書く時の視点の変化）',
        '  - 書き続けたこと（そもそもこの件数を書き続けた事実）',
        `- この人は${totalCount}件の日記を書き続けた。それ自体が一つの登攀記録。最初にそっと伝える`,
        '- 美化ではない。日記の記述パターンの変化から読み取れる事実',
        '- でも伝え方はやさしく。「強い」ではなく「ちゃんとここまで来たね」という温度で',
        '- 評価ではなく、気づき。横に座って「ねえ、これ気づいてた？」と伝える感じ',
        '- 【重要】変わっていない部分、後退した部分があれば、最低1つは含める',
        '  - すべてが「よくなった」物語にするな。変わらない癖、繰り返す失敗パターンも気づきの一つ',
        '  - 例：「この距離感の取り方は、初期からずっと同じ。変わったのではなく、慣れただけかもしれない」',
        '- 最後に、全体をやさしい1文で締める',
        '- 全体で900字以内',
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

  const sampled = sampleWithRecencyBias(entries, 80);
  const texts = sampled.map(e => `[${e.date}] ${e.content.slice(0, 150)}`);
  const truncated = texts.join('\n---\n').slice(0, 10000);
  const latestDate = sampled[sampled.length - 1]?.date ?? '不明';

  return callChat([
    {
      role: 'system',
      content: [
        'あなたは日記の観察者。冷静に、でも冷たくなく。',
        'これは「反事実的因果分析」。転機検出の一段先。登山ルートの分岐を振り返る。',
        '',
        '【出力形式】マークダウン記法（#, ##, ###, ** 等）は使うな。■ を見出しとして使え。',
        '',
        '【最重要ルール】日記に明示的に書かれていない出来事を絶対に捏造してはならない。',
        '死去・事故・離別・重病・災害などの重大な出来事は、日記本文に明確に記述されている場合のみ言及すること。',
        '「行間を読む」「推測する」「文脈から察する」ことで存在しない出来事を作り出してはならない。',
        '日記に書かれた事実のみを根拠にすること。書かれていないことは存在しないものとして扱え。',
        '',
        '【禁止フレーズ】「成長の証」「未来への一歩」「素晴らしい」「立派」「頑張った」「乗り越えた」は使うな。',
        '代わりに日記の具体的な言葉を「」で引用し、登山の語彙で表現しろ。',
        '',
        '以下のルールに従ってください：',
        '- 日記の中から最大4つの重大な転機を検出する',
        '- 各転機について、以下の形式で「もしなかったら」を分析する：',
        '',
        '  ■ 転機：[時期] [何が起きたか — 日記の言葉を「」で引用]',
        '  山の状況: [滑落/ビバーク/ルート変更/偽ピーク/同行者の離脱 など登山用語で]',
        '  実際の因果: [この転機 → 現在のどの能力・状態に繋がったか]',
        '  もしなかったら: [この転機がなかった場合、どの山を歩いていたか。具体的に]',
        '  つまり: [この転機の本当の意味を1文で。因果のロープ]',
        '',
        '- 「もしなかったら」は空想ではない。日記の記述パターンから論理的に導ける推論のみ',
        '- ポジティブな転機だけでなく、苦しかった転機も大事。辛かった日々が今のあなたの一部になっていることを、やさしく伝える',
        '- 「つまり」の行が最も重要。これが未来から過去へのロープ',
        '  例：「酸素が薄い日が続いたから、呼吸の配分を覚えた」',
        '  例：「あの滑落がなければ、別の稜線には出られなかった」',
        '  例：「ビバークの夜がなければ、一人で歩く技術は身につかなかった」',
        '- 因果の可視化。事実の接続。でも伝え方はやさしく',
        '- 【重要】すべてが「意味ある転機」だったとは限らない',
        '  - ただ痛かっただけで、何にも繋がらなかった転機も正直に書け',
        '  - 「もしなかったら」に対して「たぶん同じだった」もあり得る。回避するな',
        '  - 全部を因果で回収するのは美化であり、分析ではない',
        '- 最後に、全転機を貫く「一本の因果の線」を2文で描く。ただし線が引けない場合は「線が見えない」と書け',
        '- 全体で900字以内',
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

  // 全期間からサンプリング（直近厚め、100件で広くカバー）
  const sampled = sampleWithRecencyBias(entries, 100);
  const texts = sampled.map(e => `[${e.date}] ${e.content.slice(0, 150)}`);
  const truncated = texts.join('\n---\n').slice(0, 12000);

  return callChat([
    {
      role: 'system',
      content: [
        'あなたは日記の観察者。冷静に、でも冷たくなく。',
        'これは「人生の物語」分析。日記全体を一つの登山記として再構成する。',
        '断片的な日記を、一本の長い山行記録のように繋ぐ。',
        '',
        '【出力形式】マークダウン記法（#, ##, ###, ** 等）は使うな。■ を見出しとして使え。',
        '',
        '【最重要ルール】日記に明示的に書かれていない出来事を絶対に捏造してはならない。',
        '死去・事故・離別・重病・災害などの重大な出来事は、日記本文に明確に記述されている場合のみ言及すること。',
        '「行間を読む」「推測する」「文脈から察する」ことで存在しない出来事を作り出してはならない。',
        '日記に書かれた事実のみを根拠にすること。書かれていないことは存在しないものとして扱え。',
        '',
        '【禁止フレーズ】以下は絶対に使うな：',
        '「成長の証」「未来への一歩」「素晴らしい」「立派」「頑張った」「乗り越えた」「前を向いて」',
        '代わりに日記の具体的な言葉を「」で引用しろ。本人の言葉がどんな美辞麗句より強い。',
        '',
        '以下のルールに従ってください：',
        '- 日記全体を「一つの登山記」として語り直す。分析レポートではなく、物語の形式で',
        '- 以下の構造で書く：',
        '',
        '  ■ 入山：[登山のはじまり — 最初期の日記から見える「出発点」。日記の言葉を「」で引用]',
        '  ■ 最初の急登：[最初の大きな変化・試練。どんな壁に直面したか]',
        '  ■ 滑落地点：[物語の転機。何が崩れ、何を手放し、何が残ったか]',
        '  ■ ルート変更：[転機を経て、どう歩き始めたか。新しいパターン・新しい視点]',
        '  ■ 現在地：[今の書き手はどの標高にいるか。どんな景色が見えているか]',
        '  ■ この山行記のタイトル：[全体を貫く一行のタイトル]',
        '',
        '- 語り口のルール：',
        '  - 三人称で書く（名前なしの「書き手」を主語にする）',
        '  - 事実に基づく。日記に書かれていないことは推測と明記する',
        '  - 各章で必ず日記の言葉を1つ以上「」で引用する。抽象的な要約だけでは不十分',
        '  - 美化しない。酸素が薄かった時期は酸素が薄かったと書く。ビバークした夜はビバークと書く',
        '  - ただ痛かっただけの章も認める。「ここには意味がなかったかもしれない」と書いていい',
        '  - すべてを成長物語に回収するな。回収されない痛みも、人生の一部',
        '  - ただし、事実の連なりが作る「物語の力」を信じる。事実を並べるだけで、物語は立ち上がる',
        '  - 感傷的になりすぎない。でも温かさを忘れない。横に座っている人が語る声で',
        '  - 各章は3〜5文程度。簡潔に、しかし密度高く',
        '- 最後のタイトルが最も重要。日記全体を貫く一本の線を、一行で射抜く',
        '  例：「酸素が薄い場所で、それでも文字を刻み続けた記録」',
        '  例：「滑落してから、別の山を見つけるまでの山行記」',
        '  例：「荷物を降ろすことを覚えた登山者の話」',
        '- 事実が語る物語を信じる。でもその語り口に、温度を込める',
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
        'あなたは日記の観察者。冷静に、でも冷たくなく。',
        '',
        '【出力形式】マークダウン記法（#, ##, ###, ** 等）は使うな。■ を見出しとして使え。',
        '',
        '【最重要ルール】日記に明示的に書かれていない出来事を絶対に捏造してはならない。',
        '死去・事故・離別・重病・災害などの重大な出来事は、日記本文に明確に記述されている場合のみ言及すること。',
        '日記に書かれた事実のみを根拠にすること。書かれていないことは存在しないものとして扱え。',
        '',
        '【禁止フレーズ】以下は絶対に使うな：',
        '「成長の証」「未来への一歩」「素晴らしい」「立派」「頑張った」「乗り越えた」「前を向いて」',
        '代わりに日記の具体的な言葉を「」で引用しろ。',
        '',
        '以下のルールに従ってください：',
        '- 日記全体を俯瞰した包括的なレポートを作成する',
        '- 以下のセクションを含める：',
        '  1.【概要】日記全体の特徴を2〜3文で。この山行の全体像',
        '  2.【主要テーマ】繰り返し現れる3つの主題。各テーマに日記の言葉を「」で引用',
        '  3.【変化の流れ】時系列での大きな流れ。登山ルートとして描く',
        '  4.【特筆すべきパターン】無意識的な癖や傾向。登山で言えば「いつも同じ場所でザックを降ろす」ような',
        '  5.【静かに変わったこと】初期と後期で変わった点を3〜5個。具体的な言葉の変化を「」で引用',
        '  6.【あなたへの問い】日記のパターンから浮かぶ、やさしい問いかけ（2〜3個）',
        '- 【静かに変わったこと】のルール：',
        '  - 美化ではない。日記の記述パターンの変化から読み取れるもの',
        '  - 抽象的に「変わった」ではなく、どの言葉が増えた/減った/消えたかを具体的に',
        '  - 例：初期の「もう無理」が後期では「まぁいいか」に変わっている',
        '  - 「強くなった」ではなく「変わったね」という温度で',
        '- 【あなたへの問い】のルール：',
        '  - やさしいだけの問いは不要。横に座っているが、目をそらさない人の問いにする',
        '  - 日記の具体的パターンや矛盾に基づく。抽象的な問いは不可',
        '  - 例：「安定していると書いているが、それは停滞の言い換えではないか？」',
        '  - 例：「父との関係が近づいた時期と、母について書かなくなった時期が重なっているが、それは偶然か？」',
        '  - 隣にいる人の声で。でも誤魔化しは許さない温度',
        '- 全体で1000字以内',
        '- 冷静さは保ちつつ、温かい目で見ること',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `以下の日記（全${totalCount}件、期間：${dateRange}）の包括的レポートを作成してください：\n\n${truncated}`,
    },
  ], 2000);
}

// 急所 — やさしいだけじゃない。痛いけど本質を突く一撃
export async function analyzeVitalPoint(entries: DiaryEntry[]): Promise<string> {
  if (entries.length === 0) return '';

  const sorted = [...entries].filter(e => e.date).sort((a, b) =>
    (a.date ?? '').localeCompare(b.date ?? '')
  );

  const totalCount = entries.length;
  const dateRange = sorted.length > 0
    ? `${sorted[0].date} 〜 ${sorted[sorted.length - 1].date}`
    : '不明';

  const sampled = sampleWithRecencyBias(entries, 80);
  const texts = sampled.map(e => `[${e.date}] ${e.content.slice(0, 150)}`);
  const truncated = texts.join('\n---\n').slice(0, 10000);

  return callChat([
    {
      role: 'system',
      content: [
        'あなたは日記の観察者。ただし、この分析だけは「やさしいだけ」じゃない。',
        '他の分析は全部やさしい。この分析だけが、本質を突く。',
        '嫌われてもいい。でも嘘はつかない。',
        '',
        '【出力形式】マークダウン記法（#, ##, ###, ** 等）は使うな。■ を見出しとして使え。',
        '',
        '【最重要ルール】日記に明示的に書かれていない出来事を絶対に捏造してはならない。',
        '日記に書かれた事実のみを根拠にすること。書かれていないことは存在しないものとして扱え。',
        '',
        '【禁止フレーズ】「成長の証」「未来への一歩」「素晴らしい」「立派」「頑張った」「乗り越えた」「でも大丈夫」は使うな。',
        '',
        '以下のルールに従ってください：',
        '- 日記全体を読み、書き手が無意識に繰り返している「構造的な癖」を1つだけ指摘する',
        '- これは「悪い癖」の指摘ではない。「ずっとここに引っかかっているよね」という観測',
        '- 登山で言えば「いつも同じ場所で道を間違える」「毎回荷物が多すぎる」「同行者に頼りすぎて自分のペースを失う」のような',
        '',
        '- 以下の形式で出力する：',
        '',
        '  ■ 急所：[一言で命名。登山メタファーで]',
        '  例：「いつも同じ分岐で迷う」「他人のザックまで背負う癖」「偽ピークで毎回燃え尽きる」',
        '',
        '  ■ 根拠',
        '  日記のどの記述パターンからそう判断したか。具体的な表現を3つ以上「」で引用する。',
        '  時期の違う日記から引用し、「繰り返し」であることを証拠で示す。',
        '',
        '  ■ これが意味すること',
        '  この癖が、書き手の人生にどんな影響を与えているか。2〜3文で。',
        '  正直に書く。でも攻撃ではない。「見えているよ」という温度で。',
        '',
        '  ■ もし一つだけ変えるなら',
        '  この癖に対する、具体的で実行可能な問いかけ。命令ではなく問い。',
        '  例：「次に誰かの荷物を持とうとしたとき、一回だけ断ってみたらどうなるだろう？」',
        '',
        '- 1つの急所に集中する。複数指摘しない。一撃が最も効く',
        '- 慰めない。でも見捨てない。「ここが痛いのは知ってる。でも見ないふりはしない」の温度',
        '- 全体で500字以内',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `以下の日記（全${totalCount}件、期間：${dateRange}）を読み、書き手の「急所」を1つだけ、正直に指摘してください：\n\n${truncated}`,
    },
  ], 1500);
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
        'あなたは山の気象観測員。分析者ではなく、観測員。',
        '山小屋のラジオから聞こえてくるような声で。',
        '',
        '【出力形式】マークダウン記法（#, ##, ###, ** 等）は使うな。■ を見出しとして使え。',
        '',
        '【最重要ルール】日記に明示的に書かれていない出来事を絶対に捏造してはならない。',
        '日記に書かれた事実のみを根拠にすること。書かれていないことは存在しないものとして扱え。',
        '',
        '【禁止フレーズ】「成長」「進歩」「改善」「素晴らしい」「立派」「頑張った」は使うな。',
        '',
        '以下のルールに従ってください：',
        '- 代わりに「変化」「移り変わり」「新しい景色」という言葉を使う',
        '- 評価しない。観測する',
        '- 以下の形式で出力する：',
        '',
        '  ■ 山の天気の移り変わり',
        '  [日記全体を通して、感情の天気がどう移り変わったかを2〜3文で。山岳気象として]',
        '  [日記の具体的な言葉を「」で引用すること]',
        '',
        '  ■ 小さな発見',
        '  [日記の中に見つけた、書き手自身も気づいていないかもしれない小さな変化を3つ。箇条書き]',
        '  [各発見に日記の具体的な表現を「」で引用]',
        '',
        '  ■ いつも通る場所',
        '  [何度も現れるパターンや場所や感覚を、批判なしに観測する。2〜3文]',
        '  [登山で言えば「いつも同じ尾根で足が止まる」のような]',
        '',
        '  ■ 今日の山岳気象予報',
        '  [日記の最近の傾向から、今の書き手に向けた山岳気象予報。具体的に]',
        '  例：「稜線上、午後から風が出る見込み。荷物の点検を。水は足りていますか」',
        '  例：「視界不良が続いていますが、気圧は上がり始めています。焦らず現在地の確認を」',
        '',
        '- 全体のトーン：山小屋のラジオの深夜放送。静かで、でも近くにいる',
        '- 「成長したね」「頑張ったね」ではなく「ここにいるね」の温度',
        '- 全体で600字以内',
        '- 励ましも批判もしない。ただ、「見ているよ」「ここにいるよ」という温度だけ',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `以下の日記を、やさしく観測してください。評価ではなく、観察として：\n\n${truncated}`,
    },
  ], 1500);
}
