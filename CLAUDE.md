# CLAUDE.md

## 基本ルール

- 日本語で話してください
- 機能を追加・変更・削除したら、以下のファイルを**毎回すべて**確認して更新すること：
  - `src/pages/Landing.tsx` — 以下の**すべて**を確認：
    - `features`配列（機能カード一覧、タイトル・説明・アイコン・リンク）
    - `useCases`配列（「こんな方におすすめ」セクション）
    - `faqs`配列（よくある質問）
    - 「機能の詳細」セクション（`landing-detail-block`）
    - セクション見出しの数字（「9つの主要機能」など）
  - `src/components/JsonLd.tsx` — 構造化データ（featureList、HowTo、FAQ）
  - `public/llms.txt` — LLM向けサイト説明（機能一覧、ページ一覧）
  - `public/sitemap.xml` — サイトマップ（新しいページを追加した場合）
  - 機能の数・名前・説明が変わったら、上記すべてを同時に更新する。一部だけ更新して古い記述を残さない
- AI分析タイプを追加・変更・削除したら、以下の**両方**を必ず同時に更新すること：
  - `src/pages/Analysis.tsx` — `AnalysisType`、`analysisMap`、`categories`
  - `src/pages/AiLogs.tsx` — `AnalysisType`、`typeLabels`、`allTypes`、`currentTypeSet`
  - 両ファイルの `AnalysisType` は常に一致させる。AiLogs に削除済みタイプを残さない

## コード概要

### 技術スタック
- **フレームワーク**: React 19 + TypeScript
- **ルーティング**: react-router-dom v7（BrowserRouter）
- **ビルド**: Vite + vite-plugin-pwa（PWA対応）
- **データベース**: IndexedDB（`idb`ライブラリ経由）— すべてのデータはブラウザローカル保存
- **チャート**: recharts
- **日付操作**: date-fns
- **外部API**: OpenAI Chat Completions API（AI分析用）

### ディレクトリ構成
```
src/
├── main.tsx                    # エントリポイント（ReactDOM.createRoot）
├── App.tsx                     # ルーティング定義（全16ルート）
├── App.css / index.css         # グローバルスタイル
├── components/
│   ├── Nav.tsx                 # ナビゲーションバー
│   ├── Footer.tsx              # フッター
│   ├── AiResultBody.tsx        # AI分析結果の表示コンポーネント（マークダウン風パース）
│   └── JsonLd.tsx              # SEO用JSON-LD構造化データ
├── pages/
│   ├── Landing.tsx             # ランディングページ（/）— 機能紹介・FAQ・ユースケース
│   ├── Home.tsx                # ホーム（/home）— 日記一覧・統計サマリー
│   ├── Import.tsx              # インポート（/import）— テキストファイルから日記取り込み
│   ├── Random.tsx              # ランダム（/random）— ランダムに過去の日記を表示
│   ├── OnThisDay.tsx           # 今日は何の日（/onthisday）— 過去の同日エントリ
│   ├── Search.tsx              # 検索（/search）— 全文キーワード検索
│   ├── Calendar.tsx            # カレンダー（/calendar）— 月別カレンダービュー
│   ├── Fragments.tsx           # 断片（/fragments）— 保存した日記の抜粋
│   ├── Timeline.tsx            # タイムライン（/timeline）— 感情分析・標高チャート・深層分析（561行、最大のページ）
│   ├── WordCloud.tsx           # ワードクラウド（/wordcloud）— 頻出語の可視化
│   ├── Analysis.tsx            # AI分析（/analysis）— OpenAI APIによる3種類の分析
│   ├── AiLogs.tsx              # AI分析ログ（/ai-logs）— 過去の分析結果一覧・コピー
│   ├── Observatory.tsx         # 観測所（/observatory）— 日々の気分・安心ゲージ記録
│   ├── Settings.tsx            # 設定（/settings）— APIキー管理・データエクスポート/インポート・全削除
│   ├── Privacy.tsx             # プライバシーポリシー
│   ├── Terms.tsx               # 利用規約
│   └── Sitemap.tsx             # HTMLサイトマップ
├── hooks/
│   ├── useEntries.ts           # 日記エントリの取得・件数管理
│   ├── useAiCache.ts           # AI分析キャッシュの読み書き + aiLogsへの蓄積
│   ├── useObservations.ts      # 観測所データの取得・件数管理
│   └── useHead.ts              # ページごとのtitle/meta/OGP/canonical設定
├── db/
│   └── index.ts                # IndexedDB操作（idb）— スキーマ定義・マイグレーション・全CRUD関数
├── types/
│   └── index.ts                # 全型定義（DiaryEntry, AiCache, AiLog, Observation, 深層分析型など）
└── utils/
    ├── apiKey.ts               # OpenAI APIキーの保存・取得（localStorage/sessionStorage切替対応）
    ├── importer.ts             # テキストファイルを日記エントリに分割・パース
    ├── dateExtractor.ts        # 日記テキストから日付を抽出（和暦・西暦対応）
    ├── emotionAnalyzer.ts      # 感情分析ロジック（ネガティブ率・自己否定語・感情語辞書マッチング）
    ├── deepAnalyzer.ts         # 深層分析（月次分析・トレンド転機検出・季節クロス集計・語彙深度・存在論的密度）
    └── openai.ts               # OpenAI API呼び出し（21種類の分析関数、プロンプト構築含む）
```

### データベース（IndexedDB: `climbing-log`）
| ストア | キー | インデックス | 用途 |
|--------|------|-------------|------|
| `entries` | `id` | `by-date`, `by-imported`, `by-favorite` | 日記エントリ本体 |
| `fragments` | `id` | `by-entry`, `by-saved` | 日記の抜粋（お気に入り断片） |
| `aiCache` | `type` | — | AI分析の最新結果キャッシュ（タイプごとに1件、上書き） |
| `aiLogs` | `id` | `by-type`, `by-analyzed` | AI分析の全履歴ログ（蓄積、削除しない） |
| `observations` | `id` | `by-date`, `by-created` | 観測所の記録（空模様・安心ゲージ） |

現在のスキーマバージョン: **v4**（マイグレーションは `db/index.ts` の `runMigrations` に集約）

### AI分析（Analysis.tsx ↔ AiLogs.tsx）
現行の分析タイプは3種類:
- `todaysEntry`（今日）— 当日の日記を深く読む
- `vitalPoint`（急所）— 直近1週間から本質を突く指摘
- `externalStandardsMastery`（外基準の統合）— 今日の日記から、内側を守りつつ外基準を道具として扱えているかを構造化

分析実行 → `useAiCache.save()` → aiCache更新 + aiLog追加（同時）

### ローカル分析（Timeline.tsx）
OpenAI APIを使わないクライアント完結の分析:
- 感情分析（emotionAnalyzer.ts）: ネガティブ率・安定指数・標高メタファー
- 深層分析（deepAnalyzer.ts）: 移動平均・トレンド転機検出・季節クロス集計・語彙深度・存在論的密度・予測指標

### ビルドとデプロイ
```bash
npm run dev      # 開発サーバー（Vite）
npm run build    # tsc -b && vite build
npm run lint     # eslint
npm run preview  # ビルド済みのプレビュー
```
