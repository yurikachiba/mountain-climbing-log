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
