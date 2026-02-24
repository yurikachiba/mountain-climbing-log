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

// 標高 — 年単位（滑落あり）
export interface ElevationPoint {
  year: string; // YYYY
  elevation: number; // 累積標高（m）
  climb: number; // その年の変動量（m）— マイナスは滑落
  isSlide: boolean; // 滑落した年かどうか
}

// 標高 — 月単位（滑落あり）
export interface ElevationPointMonthly {
  month: string; // YYYY-MM
  elevation: number; // 累積標高（m）
  climb: number; // その月の変動量（m）— マイナスは滑落
  isSlide: boolean;
}

// 感情分析 — 日単位（1日おき）
export interface EmotionAnalysisDaily {
  date: string; // YYYY-MM-DD
  negativeRatio: number;
  selfDenialCount: number;
  topEmotionWords: { word: string; count: number }[];
}

// 標高 — 1日おき（滑落あり）
export interface ElevationPointDaily {
  date: string; // YYYY-MM-DD
  elevation: number; // 累積標高（m）
  climb: number; // その日の変動量（m）— マイナスは滑落
  isSlide: boolean;
}

// 回復力（レジリエンス）指標
export interface ResilienceMetrics {
  // 最大滑落
  deepestSlide: { period: string; depth: number } | null;
  // 滑落後の回復速度（滑落からプラスに転じるまでの期間数）
  avgRecoveryPeriods: number | null;
  // 回復率（滑落の何%を取り戻したか）
  recoveryRatio: number | null;
  // 滑落回数
  slideCount: number;
  // 総滑落量
  totalSlideDepth: number;
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
  textLength: number; // 月間総文字数（正規化の母数）
  avgSentenceLength: number; // 平均文長（文字数）
  firstPersonRate: number; // 一人称出現率（/1000字）
  otherPersonRate: number; // 他者固有名詞出現率（/1000字）
  taskWordRate: number; // タスク関連語出現率（/1000字）
  selfMonitorRate: number; // 自己モニタリング語出現率（/1000字）
  physicalSymptomCount: number; // 身体症状語の出現数（後方互換）
  physicalSymptomRate: number; // 身体症状語の出現率（/1000字）
  workWordRate: number; // 仕事関連語出現率（/1000字）
  negativeRate: number; // ネガティブ語出現率（/1000字）— negativeRatioとは別。絶対頻度
  positiveRate: number; // ポジティブ語出現率（/1000字）
  existentialRate: number; // 存在論的テーマ語出現率（/1000字）
  existentialIntensityScore: number; // 低頻度高強度加重スコア（存在論語×3 + 深度ネガ語×2）/1000字
}

// トレンドベースの転機検出
export interface TrendShift {
  startMonth: string; // 変化開始月
  endMonth: string; // 変化終了月
  type: 'deterioration' | 'recovery' | 'plateau' | 'vocabulary_shift' | 'existential_shift';
  magnitude: number; // 変化の大きさ（標準偏差単位）
  metrics: {
    negRatioBefore: number;
    negRatioAfter: number;
    vocabShiftScore: number; // 語彙変化スコア
    sentenceLengthChange: number;
    firstPersonChange: number;
    existentialRateChange: number; // 存在テーマ率の変化
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
  avgPhysicalSymptomRate: number; // /1000字で統一
  avgFirstPersonRate: number;
  avgSelfMonitorRate: number;
  avgNegativeRate: number; // ネガ語/1000字
  avgPositiveRate: number; // ポジ語/1000字
  entryCount: number;
  monthCount: number;
  totalTextLength: number; // 季節内の総文字数
  // 統計検定結果
  pValue: number | null; // 他季節との比較におけるp値（カイ二乗）
  isSignificant: boolean; // p < 0.05
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
  // 存在論レイヤー
  recentExistentialRate: number; // 直近3ヶ月の存在テーマ率（/1000字）
  historicalExistentialRate: number; // 全期間の存在テーマ率（/1000字）
  existentialTrend: 'deepening' | 'stable' | 'surface'; // 存在テーマの方向性
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
  textLength: number; // 総文字数（正規化の母数）
  // ネガティブ語の「深度」（軽い不満 vs 深い絶望）
  lightNegCount: number; // 疲れ、だるい等（後方互換）
  deepNegCount: number; // 死にたい、消えたい等（後方互換）
  lightNegRate: number; // /1000字
  deepNegRate: number; // /1000字
  depthRatio: number; // deep / (light + deep)
  // 主語の変化
  firstPersonCount: number; // （後方互換）
  otherPersonCount: number; // （後方互換）
  firstPersonRate: number; // /1000字
  otherPersonRate: number; // /1000字
  subjectRatio: number; // other / (first + other)
  // 文章の構造変化
  avgSentenceLength: number;
  questionCount: number; // 疑問文の数（後方互換）
  exclamationCount: number; // 感嘆文の数（後方互換）
  questionRate: number; // /1000字
  exclamationRate: number; // /1000字
}

// 深度比の解釈結果
export interface DepthInterpretation {
  pattern: 'frequency_down_depth_up' | 'frequency_down_depth_down' | 'frequency_up_depth_up' | 'stable' | 'other';
  label: string;
  description: string;
  riskNote: string;
  alternativeReading: string;
}

// 一人称変化の解釈結果
export interface FirstPersonShiftInterpretation {
  pattern: 'role_persona' | 'outward_adaptation' | 'self_disclosure_decrease' | 'genuine_growth' | 'insufficient_data' | 'self_axis_shift' | 'introspection_deepening' | 'first_person_increase';
  label: string;
  description: string;
  alternativeReading: string;
  evidence: string[];
}

// 統計検定結果
export interface StatisticalTest {
  testName: string; // 'chi_square' | 'z_test'
  statistic: number;
  pValue: number;
  significant: boolean; // p < 0.05
  effectSize: number; // クラメールのV or コーエンのh
  description: string;
}

// 存在論的密度（直近30日）
export interface ExistentialDensity {
  density: number; // 存在テーマ語出現率（/1000字）
  themes: {
    lifeDeath: number; // 生死テーマ率
    identity: number; // 自己同一性テーマ率
    completion: number; // 完成/未完テーマ率
    intensity: number; // 存在的強度テーマ率
    dignity: number; // 尊厳テーマ率（対等性への志向・境界線の設計・関係の再定義）
    agency: number; // 選択権テーマ率（選べない・縛られる・自由・逃げられないことへの反応）
  };
  recentEntryCount: number;
  highlightWords: string[]; // 実際に出現した存在論的語
}

// 日次レベルの予測用コンテキスト
export interface DailyPredictiveContext {
  // ネガ急上昇前N日間の共通語
  precursorWindowDays: number;
  dailyPrecursors: { word: string; frequency: number; occurrencesBeforeSpike: number }[];
  // 睡眠崩壊→ネガの遅延相関
  sleepDisruptionCorrelation: {
    lag: number; // 日数
    strength: number; // 相関強度 0-1
    sampleSize: number;
  } | null;
  // 感覚症状×対人イベント
  sensoryInterpersonalCorrelation: {
    sensorySymptom: string;
    interpersonalWord: string;
    coOccurrenceRate: number; // 同時出現率
    sampleSize: number;
  }[];
}
