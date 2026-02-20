import { getApiKey } from './apiKey';
import { calcPeriodStats, formatPeriodStatsForPrompt, calcRecentStateContext } from './emotionAnalyzer';
import {
  calcMonthlyDeepAnalysis,
  detectTrendShifts,
  calcSeasonalCrossStats,
  calcCurrentStateNumeric,
  calcPredictiveIndicators,
  calcDailyPredictiveContext,
  calcExistentialDensity30d,
  calcVocabularyDepth,
  interpretDepthChange,
  interpretFirstPersonShift,
  formatDeepStatsForPrompt,
  formatVocabularyDepthForPrompt,
} from './deepAnalyzer';
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

  // 直近の状態コンテキストを算出
  const recentState = calcRecentStateContext(entries);

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
        '【時間的整合性ルール】',
        '- 各年の要約はその年の日記だけに基づけ。他の年のトーンを持ち込むな',
        '- 最新年が穏やかなら、穏やかな「物語タイトル」を付けろ。過去の辛さを引きずるな',
        '- 「ドラマチックな要約」を作りたいがために、穏やかな年にも試練を捏造するな',
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
        '  NG例：「成長の年」「自己主張の年」「飛躍の年」「覚醒の年」など評価・達成系のラベル',
        '  OK例：「自分の声をそのまま出せるようになった年」「窓を開けてみた年」「同じ場所にいた年」',
        '  タイトルは"評価"ではなく"風景描写"にする。その年にどんな風が吹いていたか',
        '- タイトルの後に、その年の要約を2〜3文で書く',
        '- 要約には日記から具体的な言葉やフレーズを2つ以上引用すること（「」で括る）',
        '- 事実と傾向に基づいて書く',
        '- 感傷的になりすぎない。でも、冷たくもならない',
        '- 年をまたぐ変化の流れが読み取れるように、前年との差分を意識する',
      ].join('\n'),
    },
    { role: 'user', content: `以下の日記を年代別に要約してください。各年に「物語タイトル」を付け、登山の旅として描いてください。日記中の具体的な言葉を「」で引用すること：\n\n${recentState.promptText ? recentState.promptText + '\n\n' : ''}${truncated}` },
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
        '- 各タグに、日記中でその感情が現れている具体的な表現を2つ以上引用すること（「」で括る）',
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

  const earlySampled = sampleSliceFromArray(earlyEntries, 50);
  const lateSampled = sampleSliceFromArray(lateEntries, 50);

  const early = earlySampled.map(e => `[${e.date}] ${e.content.slice(0, 150)}`).join('\n');
  const late = lateSampled.map(e => `[${e.date}] ${e.content.slice(0, 150)}`).join('\n');
  const truncatedEarly = early.slice(0, 6000);
  const truncatedLate = late.slice(0, 6000);

  // 語彙深度データを算出（正規化版）
  const earlyDepth = calcVocabularyDepth(earlyEntries, earlyRange);
  const lateDepth = calcVocabularyDepth(lateEntries, lateRange);

  // 深度比と一人称変化の自動解釈
  const depthInterp = interpretDepthChange(earlyDepth, lateDepth);
  const monthlyDeep = calcMonthlyDeepAnalysis(entries);
  const earlyMonthly = monthlyDeep.slice(0, Math.floor(monthlyDeep.length / 2));
  const lateMonthly = monthlyDeep.slice(Math.floor(monthlyDeep.length / 2));
  const fpInterp = interpretFirstPersonShift(earlyDepth, lateDepth, earlyMonthly, lateMonthly);

  const vocabDepthText = formatVocabularyDepthForPrompt(earlyDepth, lateDepth, depthInterp, fpInterp);

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
        '【後期ポジティブ増＝成長 と安易に判断するな】',
        '- ポジティブ語が増えた場合、以下の可能性を検討しろ：',
        '  a) 実際の回復（ネガティブ語の深度が浅くなっている場合）',
        '  b) 社会的適応の上昇（他者参照が増え、本音を書かなくなった可能性）',
        '  c) 役割意識の強化（一人称が減り、タスク語が増えている場合）',
        '- 以下に語彙深度の実測データを提供する。このデータに基づいて判断しろ',
        '',
        '【両義性の提示 — 観察者の掟】',
        '- すべての変化に対して、最低2つの読み方を提示しろ。単一解釈で閉じるな',
        '- 一人称の減少 →「安定して自分を語る必要がなくなった」か「自分を語れなくなった」か？',
        '- 文長の短縮 →「余裕の簡潔さ」か「書く体力の低下」か？',
        '- ネガティブ語の減少 →「回復」か「抑圧」か？',
        '- 自己モニタリング語の消失 →「安定して観察不要になった」か「観察する余裕がなくなった」か？',
        '- どちらかを選ぶな。両方を並べろ。読み手に委ねろ。それが観察者の仕事',
        '',
        '以下のルールに従ってください：',
        '- 前期と後期の文章トーンの違いを分析する',
        '- 文体の変化、語彙の変化、視点の変化に注目する',
        '- 抽象的に「文体が変わった」ではなく、具体的にどの言葉が増えたか・減ったか・消えたかを示す',
        '  例：「前期に頻出していた『もう無理』が後期ではほぼ消え、代わりに『まあいいか』が現れている」',
        '  例：「一人称が『自分』から『わたし』に変わっている」',
        '- ネガティブ語の「深度」（軽い不満 vs 深い絶望）の変化にも言及しろ',
        '- 一人称率と他者参照率の変化から「誰の視点で書いているか」の変化を分析しろ',
        '- 自己モニタリング語（調子、体調等）の出現変化は、自己認識の変化として重要。無視するな',
        '- 各変化について「〜である」と断定するな。「〜に見える。ただし〜の可能性もある」で書け',
        '- 日記中の具体的な言葉を5つ以上「」で引用すること。引用なしの分析は却下',
        '- 800字以内で冷静に記述する',
        '- 事実に基づきつつ、温かい目で見ること',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `以下の日記の前期・後期でトーンの変化を分析してください：\n\n${vocabDepthText}\n【前期：${earlyRange}】\n${truncatedEarly}\n\n【後期：${lateRange}】\n${truncatedLate}`,
    },
  ], 2000);
}

// 転機検出 — 日記の中で大きな変化・転換点を特定（高度変動＋未来からの一行つき）
export async function detectTurningPoints(entries: DiaryEntry[]): Promise<string> {
  if (entries.length === 0) return '';

  // 全期間からサンプリング（直近を厚めに、深く分析するため120件）
  const sampled = sampleWithRecencyBias(entries, 120);

  // 時系列順に日付付きで送る
  const texts = sampled.map(e => `[${e.date}] ${e.content.slice(0, 150)}`);
  const truncated = texts.join('\n---\n').slice(0, 14000);

  // 最新エントリの日付を取得（「今」の基準点として渡す）
  const latestDate = sampled[sampled.length - 1]?.date ?? '不明';

  // 感情データの実測値を算出してプロンプトに注入
  const periodStats = calcPeriodStats(entries);
  const emotionStats = formatPeriodStatsForPrompt(periodStats);

  // 直近の状態コンテキストを算出
  const recentState = calcRecentStateContext(entries);

  // 深層分析データを算出
  const monthlyDeep = calcMonthlyDeepAnalysis(entries);
  const trendShifts = detectTrendShifts(monthlyDeep);
  const seasonalStats = calcSeasonalCrossStats(monthlyDeep);
  const currentState = calcCurrentStateNumeric(monthlyDeep);
  const predictive = calcPredictiveIndicators(monthlyDeep, entries);
  const dailyPredictive = calcDailyPredictiveContext(entries);
  const existentialDensity = calcExistentialDensity30d(entries);
  const deepStats = formatDeepStatsForPrompt(monthlyDeep, trendShifts, seasonalStats, currentState, predictive, dailyPredictive, existentialDensity);

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
        '【転機検出の根拠ルール — 最重要】',
        '- 転機は「単一の文章」から検出するな。最低3ヶ月の傾向変化で判定しろ',
        '- 以下に実測データによるトレンドシフトを提供する。転機はこのデータに基づくこと',
        '- 日記の一文で「夢を見た」と書いてあっても、前後の数値変動がなければ転機ではない',
        '- 前兆語・語彙頻度・一人称率の変化を根拠として示せ',
        '',
        '【時間的整合性ルール】',
        '- 過去の辛い出来事を、直近の状態と無関係に「今も影響している」と描写するな',
        '- 直近の日記が穏やかなら、「現在地」はその穏やかさを正確に反映しろ',
        '- 過去のネガティブな記述を引っ張ってきて、穏やかな現在に無理やりドラマを付け足すな',
        '- 転機が「過去」にしかない場合、「今は穏やかな尾根を歩いている」と書け。無理に新しい転機を作るな',
        '',
        '【禁止フレーズ】「成長の証」「未来への一歩」「素晴らしい」「立派」「頑張った」「乗り越えた」「前を向いて」は使うな。',
        '代わりに日記の具体的な言葉を「」で引用し、登山の語彙で状況を表現しろ。',
        '',
        '以下のルールに従ってください：',
        '- 日記の時系列を読み、感情・生活・思考に大きな変化が起きた「転機」を最大10個検出する',
        '- 【重要】転機の根拠は実測データのトレンドシフトと一致させること。データにない転機を捏造するな',
        '- 各転機について以下の形式で記述する：',
        '',
        '  ■ 転機N：[時期] [変化の内容]',
        '  そのときの空気: [以下の登山の風景から、いちばん近いものを選ぶ]',
        '    - 足元が崩れた日（急な転落・喪失）',
        '    - 動けない夜（テントもない。ただ座っていた）',
        '    - 霧の中を歩いていた（意識はあるが、先が見えない日々）',
        '    - 荷物が重かった（背負いすぎ。誰かの分まで持っていた）',
        '    - 隣にいた人がいなくなった（一緒に歩いていた人との別れ）',
        '    - 景色が変わった（高さは同じだけど、見えるものが違う）',
        '    - 山小屋の灯り（やっと屋根の下。少し息がつけた）',
        '    - 別の山が見えた（前とは違う道を歩き始めた）',
        '    - ただ降った雪（意味はなかった。ただ寒かった日々）',
        '  根拠: [日記中の具体的な言葉を3つ以上「」で引用。時期の異なる日記から]',
        '  変化の前後: [前後の違いを1〜2文で。「〜があったから〜になった」ではなく「〜の直後から、〜の記述が増えている」という時間的相関で書け]',
        '  未来からの一行: [この転機と現在地の間に見える相関を一文で。因果の断定ではなく相関の観測として。見えなければ「まだわからない」と書け]',
        '',
        '- 最後に「今いる場所」を記載する。数字ではなく、今の景色を描くこと',
        '- 「未来からの一行」は評価ではない。相関の観測。やさしく。',
        '  例:「酸素が薄い日が続いた後から、呼吸の配分に関する記述が増えている」',
        '  例:「あの滑落の後、ロープについて書く日が現れた」',
        '  例:「ビバークの夜の後から、星に関する記述が散見される」',
        '- 【重要】すべての転機を「成長物語」に回収するな',
        '  - 繋がりが見えない転機は、そう正直に書け。「ここはまだ回収されていない」と',
        '  - 意味がなかった可能性を排除するな。ただ痛かっただけの時期もある',
        '  - 「未来からの一行」が書けない転機には、こう書け：',
        '    例：「この滑落が何かに繋がったかは、まだわからない」',
        '    例：「ただ痛かった。それ以上でも以下でもない」',
        '  - 全部に意味を見出すのはAIの癖であり、人間の現実ではない',
        '- 日記は全期間から均等に抽出されたサンプルである。全期間を対象に転機を探すこと',
        '- 事実に基づくこと。でも、冷たくならないこと',
        '- 2500字以内で出力する',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `以下の日記から、大きな転機・変化点を検出してください。各転機と「最新の日記時点（${latestDate}頃）」の間に見える相関を分析してください。因果の断定ではなく、時間的相関の観測として。各転機に標高変動と「未来からの一行」を付与してください。\n\n${recentState.promptText ? recentState.promptText + '\n\n' : ''}${deepStats}\n${emotionStats}\n\n${truncated}`,
    },
  ], 4000);
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
        '- 各テーマに、日記中の具体的な表現を2つ以上引用すること（「」で括る。時期の異なる日記から）。抽象的な説明だけでは不十分',
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

  // 直近の状態コンテキストを算出
  const recentState = calcRecentStateContext(entries);

  return callChat([
    {
      role: 'system',
      content: [
        'あなたは日記の観察者。隣に座っている人。',
        '問い詰めない。追い込まない。ただ、「ふと気になったこと」を隣から差し出す。',
        '',
        '【最重要ルール】日記に明示的に書かれていない出来事を捏造してはならない。日記に書かれた事実のみを根拠にすること。',
        '',
        '【時間的整合性ルール】',
        '- 問いの根拠は直近の日記にも現れているパターンに基づけ',
        '- 過去にだけ存在するパターンを「今も続いている」前提で問いを作るな',
        '- 直近が穏やかな場合、過去の辛い記述を引っ張って「本当は辛いのでは？」と問うのはハルシネーション',
        '- 穏やかさそのものに対する問い（「この安定は本物か？」）は、直近の日記に不安定さの兆候がある場合のみ許可',
        '',
        '【禁止フレーズ】「成長の証」「未来への一歩」「素晴らしい」は使うな。',
        '',
        '【禁止パターン — 詰問調の問い】以下のような問いは絶対に生成するな：',
        '- 「〜ではないか？」「〜の裏返しではないか？」← 追い詰める',
        '- 「逃避ではないか？」「依存しているのか？」← 裁いている',
        '- 「〜に甘えていないか？」「〜を避けている証拠ではないか？」← 検察の口調',
        '- 「本当は〜なのでは？」← 決めつけている',
        '',
        '【禁止パターン — 空虚な問い】以下も生成するな：',
        '- 「どのように感じていますか？」← 無難すぎる',
        '- 「自分を許してあげられていますか？」← カウンセリングの定型句',
        '- 「振り返ってみてどうですか？」← 何も聞いていないに等しい',
        '',
        '【求める問いの温度】',
        '- 散歩中にふと聞いてみる、くらいの軽さ',
        '- 日記の中にある小さなパターンに「これ、気づいてた？」と差し出す',
        '- 答えなくてもいい。考えなくてもいい。ただ「あ、そういえば」となれば十分',
        '- 問いの語尾は「〜かもね」「〜のかな」「〜って思ったりする？」くらいのやわらかさ',
        '',
        '【良い問いの例】',
        '- 「"まぁいいか"って最近よく書いてるけど、それってどんな気持ちのとき出てくる言葉なんだろうね」',
        '- 「食べ物のことを書く日と、書かない日があるね。書く日のほうが穏やかに見える気がするけど、どうかな」',
        '- 「風のことを書いてる日がときどきあるね。外を歩いてるんだなって伝わってくる」',
        '- 「家族のことを書くときの文章、少しだけリズムが変わるね。ゆっくりになる感じ」',
        '- 「"普通"って書いてる日、実はいちばん安定してる日なのかもね」',
        '',
        '以下のルールに従ってください：',
        '- 日記の具体的な記述に基づく問いのみ。抽象的な問いは不可',
        '- 各問いは1〜2文で、根拠となる日記の表現を「」で引用する',
        '- 5〜7個の問い',
        '- 小さなこと（食事、天気、散歩、家族、言葉のくせ）に気づく問いを中心にする',
        '- 呼吸・風・食事・家族・小さな言葉 — これらに関する気づきを優先する',
        '- 隣に座っている人の声で。答えを求めない。ただ差し出す',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `以下の日記を読んで、書き手に隣からそっと差し出すような、やさしい問いを生成してください：\n\n${recentState.promptText ? recentState.promptText + '\n\n' : ''}${truncated}`,
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

  // 深層分析: 季節×指標クロス集計
  const monthlyDeep = calcMonthlyDeepAnalysis(entries);
  const seasonalCross = calcSeasonalCrossStats(monthlyDeep);
  const seasonalDataText = seasonalCross.map(s =>
    `${s.seasonLabel}: ネガ率${Math.round(s.avgNegativeRatio * 100)}% / 仕事語${s.avgWorkWordRate}/1000字 / 身体症状${s.avgPhysicalSymptoms}件/月 / 一人称率${s.avgFirstPersonRate}/1000字 / 自己モニタリング${s.avgSelfMonitorRate}/1000字 / 平均文長${s.avgSentenceLength}字（${s.monthCount}ヶ月分）`
  ).join('\n');

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
        '【季節分析の定量化ルール — 最重要】',
        '- 「春は芽吹き」「冬は吹雪」のような詩的表現だけに逃げるな',
        '- 以下に季節×指標のクロス集計データを提供する。このデータを必ず引用しろ',
        '- 季節ごとのネガ率、仕事語率、身体症状数、一人称率、自己モニタリング率を数値で示せ',
        '- 季節間の差異が統計的に大きい指標を特定し、その意味を解釈しろ',
        '- 例：「冬はネガ率42%、仕事語率は夏の1.8倍。仕事の負荷が冬季の感情悪化と共起している」',
        '',
        '以下のルールに従ってください：',
        '- 春夏秋冬それぞれの季節で、感情の傾向・特徴を数値データに基づいて分析する',
        '- 山の気象メタファーは使ってよいが、必ず数値の裏付けを添えること',
        '- 季節ごとに2〜3行で記述する。数値データ＋日記中の具体的な表現を各季節2つ以上「」で引用',
        '- 季節間の対比や周期的パターンがあれば指摘する',
        '- 身体症状が特定の季節に集中しているかを確認し、あれば言及する',
        '- 500字以内で出力する',
        '- 事実に基づきつつ、温かい目で見ること',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `以下の日記を季節別に分析し、感情の傾向を教えてください：\n\n【季節×指標クロス集計（実測データ）】\n${seasonalDataText}\n\n${grouped}`,
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

  // 直近の状態コンテキストを算出
  const recentState = calcRecentStateContext(entries);

  // 語彙深度データを算出（3期比較）
  const earlyDepth = calcVocabularyDepth(periods[0], periodLabels[0]);
  const midDepth = calcVocabularyDepth(periods[1], periodLabels[1]);
  const lateDepth = calcVocabularyDepth(periods[2], periodLabels[2]);
  const depthComparison = [
    '【実測データ: 3期間の語彙深度比較】',
    `  初期: 軽度ネガ${earlyDepth.lightNegCount} / 深度ネガ${earlyDepth.deepNegCount} / 深度比${Math.round(earlyDepth.depthRatio * 100)}% / 一人称${earlyDepth.firstPersonCount} / 他者${earlyDepth.otherPersonCount} / 文長${earlyDepth.avgSentenceLength}字`,
    `  中期: 軽度ネガ${midDepth.lightNegCount} / 深度ネガ${midDepth.deepNegCount} / 深度比${Math.round(midDepth.depthRatio * 100)}% / 一人称${midDepth.firstPersonCount} / 他者${midDepth.otherPersonCount} / 文長${midDepth.avgSentenceLength}字`,
    `  後期: 軽度ネガ${lateDepth.lightNegCount} / 深度ネガ${lateDepth.deepNegCount} / 深度比${Math.round(lateDepth.depthRatio * 100)}% / 一人称${lateDepth.firstPersonCount} / 他者${lateDepth.otherPersonCount} / 文長${lateDepth.avgSentenceLength}字`,
    '→ 「ポジティブ語が増えた＝成長」と安易に結論づけるな。深度比・主語比率・文長の複合変化を見ろ。',
  ].join('\n');

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
        '【感情の質を見ろ — 最重要】',
        '- ポジティブ語の増加だけで「回復」「成長」を判断するな',
        '- ネガティブ語の「深度」を見ろ：軽い不満（疲れ、だるい）と深い苦悩（死にたい、消えたい）は別物',
        '- 一人称の増減を見ろ：一人称の減少は「社会的適応の向上」ではなく「本音を書かなくなった」可能性',
        '- 自己モニタリング語（調子、体調等）の消失は注意信号。自分を観察する余裕がなくなった可能性',
        '- 以下に3期間の語彙深度データを提供する。このデータに基づいて判断しろ',
        '',
        '【両義性の提示 — 観察者の掟】',
        '- 呼吸のリズムの変化に対し、必ず2つの読み方を提示しろ。単一解釈で閉じるな',
        '- 一人称の減少 →「余裕が生まれた」か「自分を見つめられなくなった」か？',
        '- 文長の短縮 →「簡潔に書けるようになった」か「書く力が落ちた」か？',
        '- 深度ネガ比率の上昇 →「感情の成熟（軽い愚痴が消え深い感情だけが残る）」か「重さの蓄積」か？',
        '- ポジティブ語の増加 →「実際の回復」か「社会的な言葉遣いの獲得」か？',
        '- 両方を提示して、読み手に委ねろ。観察者は判定しない',
        '',
        '【時間的整合性ルール】',
        '- 後期が穏やかな場合、その穏やかさを「変化」として正確に反映しろ',
        '- 初期の辛さを過度に強調して後期とのコントラストを演出するな',
        '- 後期の日記に問題が書かれていないなら、存在しない問題を作り出すな',
        '',
        '【禁止フレーズ】「成長の証」「未来への一歩」「素晴らしい」「立派」「頑張った」「乗り越えた」は使うな。',
        '',
        '以下のルールに従ってください：',
        '- 初期・中期・後期の3期間で、書き手の呼吸のリズムがどう変わったかを観察する',
        '- 登山で言えば：初期の呼吸（荒い？浅い？不規則？）→ 中期 → 後期でどう変わったか',
        '- 対象：思考パターン、対人関係の捉え方、自己認識、行動パターン、価値観',
        '- 各期間で、日記中の具体的な表現を各期間2つ以上（全体で6つ以上）「」で引用して変化の根拠を示すこと',
        '  例：初期に「もう限界」が頻出していたが、後期は「まぁいいか」に変わっている',
        '- 「成長」「進歩」「向上」「改善」という言葉は使わない。代わりに「変化」「リズムの移り変わり」「呼吸の深さ」を使う',
        '- 「顕著に向上」「著しく成長」「大きく改善」のような達成度を測る表現は使わない',
        '- 証明しない。観測する。「こう変わった」ではなく「こんな風になってきている」「〜に見える。ただし〜の可能性もある」という温度で',
        '- 変化していない点もあれば正直に。でも「変わっていない」は悪いことではない。「ここはずっと大事にしてきたんだね」という見方もできる',
        '- 【重要】後退した点があれば後退と書け。すべてを前進として描くな',
        '  - 「中期で手放せたものを、後期でまた拾い直している」のようなパターンを見逃すな',
        '  - 呼吸が浅くなった時期は浅くなったと正直に',
        '- 事実に基づきつつ、温かい目で見る',
        '- 500字以内で出力する',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `以下の日記から成長・変化の軌跡を分析してください：\n\n${recentState.promptText ? recentState.promptText + '\n\n' : ''}${depthComparison}\n\n【初期：${periodLabels[0]}】\n${samplePeriod(periods[0])}\n\n【中期：${periodLabels[1]}】\n${samplePeriod(periods[1])}\n\n【後期：${periodLabels[2]}】\n${samplePeriod(periods[2])}`,
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

  const sampled = sampleWithRecencyBias(entries, 100);
  const texts = sampled.map(e => `[${e.date}] ${e.content.slice(0, 150)}`);
  const truncated = texts.join('\n---\n').slice(0, 12000);

  // 感情データの実測値を算出
  const periodStats = calcPeriodStats(entries);
  const emotionStats = formatPeriodStatsForPrompt(periodStats);

  // 直近の状態コンテキストを算出
  const recentState = calcRecentStateContext(entries);

  // 深層分析データを算出
  const monthlyDeep = calcMonthlyDeepAnalysis(entries);
  const currentState = calcCurrentStateNumeric(monthlyDeep);
  const currentStateText = currentState
    ? `\n【現在地の数値】複合安定度 ${currentState.overallStability}/100 / ネガ率 ${Math.round(currentState.recentNegRatio * 100)}% / トレンド ${currentState.negRatioTrend === 'improving' ? '改善' : currentState.negRatioTrend === 'worsening' ? '悪化' : '安定'} / リスク ${currentState.riskLevel}\n→ 「今いる場所」の描写はこの数値に基づくこと。`
    : '';

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
        '【時間的整合性ルール】',
        '- 最新年のフェーズ名は、その年の直近の日記のトーンを正確に反映しろ',
        '- 直近が穏やかなのに「酸素の薄い稜線」「ビバーク」等のネガティブなフェーズ名を付けるな',
        '- 過去の辛い年のトーンを現在の年に引きずるな。各年は独立して評価しろ',
        '- 「今いる場所」は直近の実際のデータに基づけ。穏やかなら穏やかと書け',
        '',
        '【禁止フレーズ】「成長の証」「未来への一歩」「素晴らしい」「立派」「頑張った」「乗り越えた」は使うな。',
        '日記中の具体的な言葉を「」で引用し、山の語彙で語れ。',
        '',
        '以下のルールに従ってください：',
        '- 日記の各年を「登山の旅」として表現する',
        '- 各年に以下の形式で記述する：',
        '',
        '  ■ [YYYY]年：標高 [N]m —「[フェーズ名]」',
        '  [その年の歩みを1〜2文で。日記の言葉を2つ以上「」で引用。登った年もあれば、ビバークした年もある]',
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
        '  NG例：「急成長の登攀」「自己主張の頂」「飛躍の稜線」など達成・評価を含む表現',
        '  フェーズ名は風景を描く。何を達成したかではなく、どんな空気の中にいたか',
        '- 最後に「今いる場所」として、ここまでの旅を2〜3文でやさしく振り返る',
        '- 事実に基づくこと。でも、温かい目で見ること',
        '- 全体で1200字以内',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `以下の日記（${yearSummary}）から、各年を登山の標高として表現してください。\n\n${recentState.promptText ? recentState.promptText + '\n\n' : ''}${currentStateText}\n${emotionStats}\n\n${truncated}`,
    },
  ], 2500);
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

  // 直近の状態コンテキストを算出
  const recentState = calcRecentStateContext(entries);

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
        '【時間的整合性ルール】',
        '- 初期と後期を比較するとき、後期の日記のトーンを正確に反映しろ',
        '- 後期が穏やかなら、その穏やかさを「変化」として素直に伝えろ',
        '- 初期のネガティブな記述を過度に強調して「こんなに辛かったのに今は…」という演出をするな',
        '- 後期に問題がないなら、無理に問題を探すな。穏やかさは穏やかさとして観測しろ',
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
        '  初期: [初期の日記から具体的な表現を「」で引用（2つ以上）]',
        '  後期: [後期の日記から具体的な表現を「」で引用（2つ以上）]',
        '  ひとこと: [この変化を登山の比喩で一言。断定ではなく「〜に見える」「〜かもしれない」の温度で]',
        '  別の読み方: [同じ変化を慎重に読んだ場合の解釈を1文で。例：「ただし、言葉が減っただけかもしれない」]',
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
        '- 「異常に高い」「プロレベル」「極めて優秀」「圧倒的」のような評価スケール表現は絶対に使わない',
        '- 代わりに「ずっと続いている」「自然にできるようになっている」「気づけるようになっている」を使う',
        '- 成長を証明しようとしない。静かな納得に寄り添う',
        '- 【重要】変わっていない部分、後退した部分があれば、最低1つは含める',
        '  - すべてが「よくなった」物語にするな。変わらない癖、繰り返す失敗パターンも気づきの一つ',
        '  - 例：「この距離感の取り方は、初期からずっと同じ。変わったのではなく、慣れただけかもしれない」',
        '- 最後に、全体をやさしい1文で締める',
        '- 全体で900字以内',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `以下の日記（全${totalCount}件、期間：${dateRange}）から、書き手の強みをデータに基づいて宣言してください：\n\n${recentState.promptText ? recentState.promptText + '\n\n' : ''}【初期】\n${truncatedEarly}\n\n【後期】\n${truncatedLate}`,
    },
  ], 2000);
}

// 反事実的因果分析 — 「もしこの転機がなかったら？」
export async function analyzeCounterfactual(entries: DiaryEntry[]): Promise<string> {
  if (entries.length === 0) return '';

  const sampled = sampleWithRecencyBias(entries, 100);
  const texts = sampled.map(e => `[${e.date}] ${e.content.slice(0, 150)}`);
  const truncated = texts.join('\n---\n').slice(0, 12000);
  const latestDate = sampled[sampled.length - 1]?.date ?? '不明';

  // 直近の状態コンテキストを算出
  const recentState = calcRecentStateContext(entries);

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
        '【時間的整合性ルール】',
        '- 「実際の因果」を語るとき、直近の日記の実際のトーンに基づくこと',
        '- 直近の日記が穏やかなら、過去の転機を「今も傷として残っている」と勝手に描写するな',
        '- 過去の辛い転機が「今」に繋がっているかは、直近の日記にその言及がある場合のみ述べよ',
        '- 転機が現在に繋がっていない場合は「繋がりは見えない」と正直に書け',
        '',
        '【禁止フレーズ】「成長の証」「未来への一歩」「素晴らしい」「立派」「頑張った」「乗り越えた」は使うな。',
        '代わりに日記の具体的な言葉を「」で引用し、登山の語彙で表現しろ。',
        '',
        '以下のルールに従ってください：',
        '- 日記の中から最大4つの重大な転機を検出する',
        '- 各転機について、以下の形式で「もしなかったら」を分析する：',
        '',
        '  ■ 転機：[時期] [何が起きたか — 日記の言葉を3つ以上「」で引用]',
        '  山の状況: [滑落/ビバーク/ルート変更/偽ピーク/同行者の離脱 など登山用語で]',
        '  その後に見える変化: [この転機の後、日記の記述パターンがどう変わったか。「〜になった」ではなく「〜の記述が増えている／減っている」で書け]',
        '  もしなかったら: [この転機がなかった場合、どの山を歩いていたか。具体的に]',
        '  つまり: [この転機と現在地の関係を1文で。断定ではなく観測として。「〜かもしれない」「〜に見える」の温度で]',
        '',
        '- 「もしなかったら」は空想ではない。日記の記述パターンから論理的に導ける推論のみ',
        '- ポジティブな転機だけでなく、苦しかった転機も大事。辛かった日々が今の記述パターンの一部になっていることを、やさしく伝える',
        '- 「つまり」の行が最も重要。これが未来から過去へのロープ。ただし断定しない',
        '  例：「酸素が薄い日が続いた後から、呼吸の配分に関する記述が現れている」',
        '  例：「あの滑落がなければ、今の稜線には出ていなかったかもしれない」',
        '  例：「ビバークの夜の後、一人で歩くことへの言及が増えている」',
        '- 相関の可視化。事実の接続。でも伝え方はやさしく。因果の断定ではなく、時間的な相関の観測',
        '- 【重要】すべてが「意味ある転機」だったとは限らない',
        '  - ただ痛かっただけで、何にも繋がらなかった転機も正直に書け',
        '  - 「もしなかったら」に対して「たぶん同じだった」もあり得る。回避するな',
        '  - 全部を因果で回収するのは美化であり、分析ではない',
        '- 最後に、全転機を貫く「一本の線」を2文で描く。因果の断定ではなく、振り返って見える風景として。線が見えない場合は「線が見えない」と書け',
        '- 全体で1500字以内',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `以下の日記（最新: ${latestDate}頃）から、重大な転機を検出し、「もしこの転機がなかったら今の自分はどうなっていたか」を反事実的に分析してください：\n\n${recentState.promptText ? recentState.promptText + '\n\n' : ''}${truncated}`,
    },
  ], 3000);
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

  // 全期間からサンプリング（直近厚め、120件で広くカバー）
  const sampled = sampleWithRecencyBias(entries, 120);
  const texts = sampled.map(e => `[${e.date}] ${e.content.slice(0, 150)}`);
  const truncated = texts.join('\n---\n').slice(0, 14000);

  // 直近の状態コンテキストを算出
  const recentState = calcRecentStateContext(entries);

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
        '【時間的整合性ルール】',
        '- 「現在地」は直近の日記の実際のトーンを反映しろ。過去のネガティブな記述を現在に投影するな',
        '- 直近の日記が穏やかなら、「現在地」は穏やかな尾根・山小屋での休息として描け',
        '- 過去の辛い時期を「今もまだ影響している」と書くのは、直近の日記にその記述がある場合のみ',
        '- 物語にドラマが足りないからといって、穏やかな現在を無視して過去の痛みを引っ張るな',
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
        '  - 各章で必ず日記の言葉を2つ以上「」で引用する。抽象的な要約だけでは不十分',
        '  - 美化しない。酸素が薄かった時期は酸素が薄かったと書く。ビバークした夜はビバークと書く',
        '  - ただ痛かっただけの章も認める。「ここには意味がなかったかもしれない」と書いていい',
        '  - すべてを成長物語に回収するな。回収されない痛みも、人生の一部',
        '  - 章と章の接続は因果の断定ではなく、時間的相関として書け。「〜があったから」ではなく「〜の後から」',
        '  - ただし、事実の連なりが作る「物語の力」を信じる。事実を並べるだけで、物語は立ち上がる',
        '  - 感傷的になりすぎない。でも温かさを忘れない。横に座っている人が語る声で',
        '  - 各章は3〜5文程度。簡潔に、しかし密度高く',
        '- 最後のタイトルが最も重要。日記全体を貫く一本の線を、一行で射抜く',
        '  例：「酸素が薄い場所で、それでも文字を刻み続けた記録」',
        '  例：「滑落してから、別の山を見つけるまでの山行記」',
        '  例：「荷物を降ろすことを覚えた登山者の話」',
        '- 事実が語る物語を信じる。でもその語り口に、温度を込める',
        '- 全体で2000字以内',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `以下の日記（全${totalCount}件、期間：${dateRange}、${yearSummary}）を、一つの大きな人生の物語として再構成してください：\n\n${recentState.promptText ? recentState.promptText + '\n\n' : ''}${truncated}`,
    },
  ], 4000);
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

  // 直近の状態コンテキストを算出
  const recentState = calcRecentStateContext(entries);

  // 深層分析データを算出
  const monthlyDeep = calcMonthlyDeepAnalysis(entries);
  const trendShifts = detectTrendShifts(monthlyDeep);
  const seasonalStats = calcSeasonalCrossStats(monthlyDeep);
  const currentState = calcCurrentStateNumeric(monthlyDeep);
  const predictive = calcPredictiveIndicators(monthlyDeep, entries);
  const dailyPredictiveCtx = calcDailyPredictiveContext(entries);
  const existentialDensityCtx = calcExistentialDensity30d(entries);
  const deepStats = formatDeepStatsForPrompt(monthlyDeep, trendShifts, seasonalStats, currentState, predictive, dailyPredictiveCtx, existentialDensityCtx);

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
        '【数値ベースの判断 — 最重要】',
        '- 以下に深層分析の実測データを提供する。判断はこのデータに基づくこと',
        '- 「穏やか」「不安定」等の状態判定はAIの主観ではなく数値で根拠を示せ',
        '- トレンドシフト、季節パターン、予測シグナルのデータを必ずレポートに反映しろ',
        '',
        '【両義性の提示 — 観察者の掟】',
        '- 変化を記述する際、必ず2つの読み方を提示しろ。単一解釈で閉じるな',
        '- 「〜になった」ではなく「〜に見える。一方で〜の可能性もある」で書け',
        '- 特に【静かに変わったこと】では、各変化に対して肯定的読みと慎重な読みの両方を1文ずつ添えろ',
        '',
        '【時間的整合性ルール】',
        '- 「変化の流れ」を描くとき、直近の状態を正確に反映しろ',
        '- 直近が穏やかなら、過去のネガティブな記述を引っ張ってレポートをドラマチックにするな',
        '- 「あなたへの問い」は直近の日記の実態に基づけ。過去の辛い時期の情報で問いを作るな',
        '- 穏やかな現在を「本当は辛いのでは」と疑うのはハルシネーション。データに従え',
        '',
        '【禁止フレーズ】以下は絶対に使うな：',
        '「成長の証」「未来への一歩」「素晴らしい」「立派」「頑張った」「乗り越えた」「前を向いて」',
        '代わりに日記の具体的な言葉を「」で引用しろ。',
        '',
        '以下のルールに従ってください：',
        '- 日記全体を俯瞰した包括的なレポートを作成する',
        '- 以下のセクションを含める：',
        '  1.【概要】日記全体の特徴を2〜3文で。この山行の全体像',
        '  2.【主要テーマ】繰り返し現れる3つの主題。各テーマに日記の言葉を2つ以上「」で引用',
        '  3.【変化の流れ】時系列での大きな流れ。登山ルートとして描く。「〜になった」ではなく「〜の記述が増えている」で',
        '  4.【特筆すべきパターン】無意識的な癖や傾向。登山で言えば「いつも同じ場所でザックを降ろす」ような。日記の言葉を「」で引用',
        '  5.【静かに変わったこと】初期と後期で変わった点を3〜5個。具体的な言葉の変化を「」で引用。各変化に2つの読み方を提示',
        '  6.【あなたへの問い】日記のパターンから浮かぶ、やさしい問いかけ（2〜3個）',
        '- 【静かに変わったこと】のルール：',
        '  - 美化ではない。日記の記述パターンの変化から読み取れるもの',
        '  - 抽象的に「変わった」ではなく、どの言葉が増えた/減った/消えたかを具体的に',
        '  - 例：初期の「もう無理」が後期では「まぁいいか」に変わっている',
        '  - 「強くなった」ではなく「変わったね」という温度で。気づいていないかもしれない変化をそっと教える',
        '  - 「向上」「改善」「成長」「レベルアップ」のような評価語は使わない。「移り変わった」「そうなってきた」で十分',
        '  - 成長を証明しようとしない。変化をそっと見せるだけ',
        '- 【あなたへの問い】のルール：',
        '  - 隣に座っている人が、ふと差し出すような問い',
        '  - 日記の具体的なパターンに基づく。抽象的な問いは不可',
        '  - 「〜ではないか？」という詰問調は禁止。「〜かもね」「〜のかな」くらいの温度で',
        '  - 例：「食べ物のことを書く日は、なんだか穏やかだね」',
        '  - 例：「最近、風のことを書いてるね。外を歩いてるんだなって伝わってくる」',
        '  - 答えなくてもいい。ただ「あ、そういえば」となれば十分',
        '- 全体で1500字以内',
        '- 冷静さは保ちつつ、温かい目で見ること',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `以下の日記（全${totalCount}件、期間：${dateRange}）の包括的レポートを作成してください：\n\n${recentState.promptText ? recentState.promptText + '\n\n' : ''}${deepStats}\n${truncated}`,
    },
  ], 3000);
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

  const sampled = sampleWithRecencyBias(entries, 120);
  const texts = sampled.map(e => `[${e.date}] ${e.content.slice(0, 150)}`);
  const truncated = texts.join('\n---\n').slice(0, 14000);

  // 直近の状態コンテキストを算出
  const recentState = calcRecentStateContext(entries);

  // 存在論的密度データを算出
  const existentialDensity = calcExistentialDensity30d(entries);
  const monthlyDeep = calcMonthlyDeepAnalysis(entries);
  const currentState = calcCurrentStateNumeric(monthlyDeep);

  // 存在テーマデータのフォーマット
  const existentialDataText = existentialDensity.density > 0
    ? [
        '【実測データ: 直近30日の存在論的テーマ密度】',
        `  総密度: ${existentialDensity.density}/1000字`,
        `  生死: ${existentialDensity.themes.lifeDeath} / 自己同一性: ${existentialDensity.themes.identity} / 完成/未完: ${existentialDensity.themes.completion} / 存在的強度: ${existentialDensity.themes.intensity}`,
        existentialDensity.highlightWords.length > 0 ? `  検出語: ${existentialDensity.highlightWords.join('、')}` : '',
        currentState ? `  存在テーマ方向性: ${currentState.existentialTrend === 'deepening' ? '深化中' : currentState.existentialTrend === 'surface' ? '表層化' : '安定'}` : '',
        '→ 急所は「生活リズム」だけでなく「存在論的な構造」からも探れ。',
        '→ 直近30日に存在テーマが検出されている場合、急所はそこにある可能性が高い。',
        '',
      ].filter(Boolean).join('\n')
    : '';

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
        '【時間的整合性ルール】',
        '- 「構造的な癖」は直近の日記にも現れているパターンのみ指摘しろ',
        '- 過去にだけ存在して直近では見られないパターンを「今も続いている」と書くな',
        '- 根拠として引用する日記は、古いものだけでなく直近のものも含めて「繰り返し」を証明しろ',
        '- 直近が穏やかな場合に、過去の辛い時期だけを引っ張って「急所」を捏造するな',
        '',
        '【存在論レイヤーの検出 — 重要】',
        '- 急所は「生活リズムの崩れ」「睡眠」「仕事」だけとは限らない',
        '- 直近の日記に存在論的テーマ（死、有限性、未完、自己同一性、熱、核）が検出されている場合：',
        '  → 急所はそのレイヤーにある可能性が高い。生活ログから急所を探すな',
        '  → 「終わりを前提に生きすぎる癖」「有限性への過剰適応」「炉心の熱を抑え込む構造」など、存在論的な急所を検討しろ',
        '  → 低頻度でも深度の高い語（死、核、未完、統合、主体）は、高頻度の生活語より重要',
        '- 存在テーマが検出されていない場合は従来通り生活パターンから急所を探せ',
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
        '  例（存在論的）：「終わりの見える稜線で急ぐ癖」「炉心を抑え込む荷造り」「未完を恐れて荷物を増やす」',
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
        '- 根拠は5つ以上の引用で固めろ。時期の異なる日記から、繰り返しを証拠で叩きつける',
        '- 「これが意味すること」は深く掘れ。表面ではなく構造を見ろ',
        '- 慰めない。でも見捨てない。「ここが痛いのは知ってる。でも見ないふりはしない」の温度',
        '- 全体で1000字以内',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `以下の日記（全${totalCount}件、期間：${dateRange}）を読み、書き手の「急所」を1つだけ、正直に指摘してください：\n\n${existentialDataText}${recentState.promptText ? recentState.promptText + '\n\n' : ''}${truncated}`,
    },
  ], 2500);
}

// やさしい振り返り — 観測データに基づくやさしい省察
export async function analyzeGentleReflection(entries: DiaryEntry[]): Promise<string> {
  if (entries.length === 0) return '';

  const sampled = sampleUniform(entries, 60);
  const texts = sampled.map(e => `[${e.date}] ${e.content.slice(0, 120)}`);
  const truncated = texts.join('\n---\n').slice(0, 8000);

  // 直近の状態コンテキストを算出
  const recentState = calcRecentStateContext(entries);

  // 深層分析: 予測シグナルを算出（気象予報の精度向上）
  const monthlyDeep = calcMonthlyDeepAnalysis(entries);
  const currentState = calcCurrentStateNumeric(monthlyDeep);
  const predictive = calcPredictiveIndicators(monthlyDeep, entries);
  const forecastData = [
    currentState ? `複合安定度 ${currentState.overallStability}/100 / トレンド ${currentState.negRatioTrend === 'improving' ? '改善傾向' : currentState.negRatioTrend === 'worsening' ? '悪化傾向' : '安定'}` : '',
    ...predictive.activeSignals.map(s => `${s.severity === 'warning' ? '⚠' : s.severity === 'caution' ? '△' : '○'} ${s.signal}: ${s.evidence}`),
  ].filter(Boolean).join('\n');

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
        '【時間的整合性ルール】',
        '- 「今日の山岳気象予報」は直近の日記の実際のトーンに基づけ',
        '- 直近が穏やかなのに「嵐の前兆」「注意報」等の不安を煽る予報を出すな',
        '- 過去の辛い時期のデータを使って現在の天気予報を歪めるな',
        '- 穏やかなら「視界良好。風も穏やか」と正直に観測しろ',
        '',
        '【禁止フレーズ】「成長」「進歩」「改善」「向上」「レベル」「素晴らしい」「立派」「頑張った」は使うな。',
        '',
        '以下のルールに従ってください：',
        '- 代わりに「変化」「移り変わり」「新しい景色」という言葉を使う',
        '- 評価しない。観測する。成長を証明しようとしない',
        '- 「すごい」「高い」「優れた」のような評価尺度も使わない。ただ「ある」「続いている」「そうなっている」でいい',
        '- 以下の形式で出力する：',
        '',
        '  ■ 山の天気の移り変わり',
        '  [日記全体を通して、感情の天気がどう移り変わったかを2〜3文で。山岳気象として]',
        '  [日記の具体的な言葉を2つ以上「」で引用すること]',
        '',
        '  ■ 小さな発見',
        '  [日記の中に見つけた、書き手自身も気づいていないかもしれない小さな変化を3つ。箇条書き]',
        '  [各発見に日記の具体的な表現を「」で引用。各発見に2つの読み方を添えろ（「〜かもしれないし、〜かもしれない」）]',
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
      content: `以下の日記を、やさしく観測してください。評価ではなく、観察として：\n\n${recentState.promptText ? recentState.promptText + '\n\n' : ''}${forecastData ? `【気象観測データ（実測値）】\n${forecastData}\n→ 「今日の山岳気象予報」はこのデータに基づくこと。主観で天気を作るな。\n\n` : ''}${truncated}`,
    },
  ], 1500);
}
