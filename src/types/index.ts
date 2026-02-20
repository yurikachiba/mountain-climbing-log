export interface DiaryEntry {
  id: string;
  date: string | null; // ISO date string or null if unknown
  content: string;
  sourceFile: string;
  importedAt: string;
  comments: FutureComment[];
  isFavorite: boolean;
}

export interface FutureComment {
  id: string;
  text: string; // max 140 chars
  createdAt: string;
}

export interface Fragment {
  id: string;
  entryId: string;
  text: string;
  savedAt: string;
}

export interface EmotionAnalysis {
  month: string; // YYYY-MM
  negativeRatio: number;
  selfDenialCount: number;
  topEmotionWords: { word: string; count: number }[];
}

// 年単位の安定指数（0-100）
export interface StabilityIndex {
  year: string; // YYYY
  score: number; // 0-100
  positiveRatio: number; // ポジティブ比率
  volatility: number; // 感情のばらつき（低いほど安定）
  selfDenialAvg: number; // 月平均自己否定語数
}

// 標高（累積的な成長の高さ）— 年単位
export interface ElevationPoint {
  year: string; // YYYY
  elevation: number; // 累積標高（m）
  climb: number; // その年の登攀量（m）
}

// 標高（累積的な成長の高さ）— 月単位
export interface ElevationPointMonthly {
  month: string; // YYYY-MM
  elevation: number; // 累積標高（m）
  climb: number; // その月の登攀量（m）
}

// 感情分析 — 日単位（1日おき）
export interface EmotionAnalysisDaily {
  date: string; // YYYY-MM-DD
  negativeRatio: number;
  selfDenialCount: number;
  topEmotionWords: { word: string; count: number }[];
}

// 標高（累積的な成長の高さ）— 1日おき
export interface ElevationPointDaily {
  date: string; // YYYY-MM-DD
  elevation: number; // 累積標高（m）
  climb: number; // その日の登攀量（m）
}

// AI分析キャッシュ: 各分析タイプの最新結果を保持
export interface AiCache {
  type: string; // AnalysisType のキー
  result: string;
  analyzedAt: string; // ISO timestamp
  entryCount: number; // 分析時のエントリ数
  isStale: boolean; // データ更新があれば true になる
}

// AIログ: 過去の分析結果をすべて蓄積
export interface AiLog {
  id: string; // UUID
  type: string; // AnalysisType のキー
  result: string;
  analyzedAt: string; // ISO timestamp
  entryCount: number; // 分析時のエントリ数
}

// 観測所の観測記録
export interface Observation {
  id: string; // crypto.randomUUID()
  date: string; // YYYY-MM-DD
  sky: string; // 空模様の絵文字 (☀️🌤️⛅🌥️☁️🌧️⛈️)
  comfort: number; // 安心ゲージ 0-100
  wave: string; // 'calm' | 'ripple' | 'high'
  note: string; // 自由記述（任意）
  prompt: string; // 表示されたやさしいプロンプト
  createdAt: string; // ISO timestamp
}

// ── 深層分析型定義 ──

// 移動平均付き月次分析
export interface MonthlyDeepAnalysis {
  month: string; // YYYY-MM
  negativeRatio: number;
  negativeRatioMA3: number | null; // 3ヶ月移動平均
  negativeRatioMA6: number | null; // 6ヶ月移動平均
  seasonalBaseline: number | null; // 同月の季節ベースライン
  seasonalDeviation: number | null; // 季節補正後の偏差
  entryCount: number;
  avgSentenceLength: number; // 平均文長（文字数）
  firstPersonRate: number; // 一人称出現率
  otherPersonRate: number; // 他者固有名詞出現率
  taskWordRate: number; // タスク関連語出現率
  selfMonitorRate: number; // 自己モニタリング語出現率
  physicalSymptomCount: number; // 身体症状語の出現数
  workWordRate: number; // 仕事関連語出現率
}

// トレンドベースの転機検出
export interface TrendShift {
  startMonth: string; // 変化開始月
  endMonth: string; // 変化終了月
  type: 'deterioration' | 'recovery' | 'plateau' | 'vocabulary_shift';
  magnitude: number; // 変化の大きさ（標準偏差単位）
  metrics: {
    negRatioBefore: number;
    negRatioAfter: number;
    vocabShiftScore: number; // 語彙変化スコア
    sentenceLengthChange: number;
    firstPersonChange: number;
  };
  description: string; // 自動生成の説明文
}

// 季節×指標クロス集計
export interface SeasonalCrossStats {
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  seasonLabel: string;
  avgNegativeRatio: number;
  avgSentenceLength: number;
  avgWorkWordRate: number;
  avgPhysicalSymptoms: number;
  avgFirstPersonRate: number;
  avgSelfMonitorRate: number;
  entryCount: number;
  monthCount: number;
}

// 数値ベースの現在地評価
export interface CurrentStateNumeric {
  // 直近3ヶ月の実測値
  recentNegRatio: number;
  recentNegRatioMA: number;
  recentSelfDenialRate: number;
  recentAvgSentenceLength: number;
  recentFirstPersonRate: number;
  recentPhysicalSymptoms: number;
  recentWorkWordRate: number;
  // 全期間平均との比較
  historicalNegRatio: number;
  historicalSelfDenialRate: number;
  historicalAvgSentenceLength: number;
  historicalFirstPersonRate: number;
  historicalPhysicalSymptoms: number;
  // 傾向判定
  negRatioTrend: 'improving' | 'stable' | 'worsening';
  overallStability: number; // 0-100 複合安定度スコア
  riskLevel: 'low' | 'moderate' | 'elevated'; // リスクレベル
}

// 予測指標
export interface PredictiveIndicator {
  // ネガ率上昇の前兆語（過去パターンから抽出）
  precursorWords: { word: string; leadDays: number; correlation: number }[];
  // 直近のリスクシグナル
  activeSignals: {
    signal: string;
    severity: 'watch' | 'caution' | 'warning';
    evidence: string;
  }[];
  // 身体症状と感情の遅延相関
  symptomCorrelations: {
    symptom: string;
    emotionalLag: number; // 日数（症状→感情悪化の遅延）
    strength: number; // 相関強度 0-1
  }[];
}

// 語彙深度分析
export interface VocabularyDepth {
  period: string;
  // ネガティブ語の「深度」（軽い不満 vs 深い絶望）
  lightNegCount: number; // 疲れ、だるい等
  deepNegCount: number; // 死にたい、消えたい等
  depthRatio: number; // deep / (light + deep)
  // 主語の変化
  firstPersonCount: number;
  otherPersonCount: number;
  subjectRatio: number; // other / (first + other)
  // 文章の構造変化
  avgSentenceLength: number;
  questionCount: number; // 疑問文の数
  exclamationCount: number; // 感嘆文の数
}
