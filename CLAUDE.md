# CLAUDE.md

## 基本ルール

- 日本語で、タメ口で話す。敬語・へつらい・持ち上げは不要。友達みたいにやる
- 曖昧な指示や大きな変更の場合、仕様をよく聞いてから実装すること。思い込みで先に進まない

## 変更時に毎回やること

### 機能を追加・変更・削除したら
以下のファイルを**すべて同時に**更新する。一部だけ更新して古い記述を残さない：
- `src/pages/Landing.tsx` — `features`配列、`useCases`配列、`faqs`配列、`landing-detail-block`、セクション見出しの数字
- `src/components/JsonLd.tsx` — 構造化データ（featureList、HowTo、FAQ）
- `public/llms.txt` — LLM向けサイト説明（機能一覧、ページ一覧）
- `public/sitemap.xml` — 新しいページを追加した場合

### AI分析タイプを追加・変更・削除したら
以下の**両方**を必ず同時に更新する：
- `src/pages/Analysis.tsx` — `AnalysisType`、`analysisMap`、`categories`
- `src/pages/AiLogs.tsx` — `AnalysisType`、`typeLabels`、`allTypes`、`currentTypeSet`
- 両ファイルの `AnalysisType` は常に一致させる。AiLogs に削除済みタイプを残さない

## 技術スタック

- React 19 + TypeScript + Vite + vite-plugin-pwa
- IndexedDB（`idb`ライブラリ経由）— すべてのデータはブラウザローカル保存
- Anthropic Claude API（AI分析用、`src/utils/claude.ts`）
- recharts（チャート）、date-fns（日付操作）

## ビルド

- **ビルド前に必ず `npm install` を実行すること**（絶対）
```bash
npm install      # 依存関係のインストール（ビルド前に必ず実行）
npm run dev      # 開発サーバー
npm run build    # tsc -b && vite build
npm run lint     # eslint
```

## 最終確認（コミット前に毎回やること）

- `npm run build`（`tsc -b && vite build`）が通ること
- `npm run lint`（eslint）がエラー・警告なしで通ること
- 変更したファイルを目視で読み返し、意図通りか確認すること

## 実装上の注意点

### IndexedDB のデータ取得
- 全件取得は必ず `cursorGetAll` を使うこと（内部で `db.count()` との照合 + 多段フォールバックを行う）
- インデックス経由のカーソル走査は、対象フィールドが欠落したレコードを取りこぼす。全件取得には絶対に使わない
- インデックス経由はソート・フィルタ（特定の値で絞り込む場合）にのみ使う
- データ件数を表示するときは、取得件数と `db.count()` を比較し、不一致があればユーザーに警告を出すこと

### API呼び出し（callChat / callChatRaw）
- `callChatRaw` は `{ text, stopReason }` を返す。レスポンスの切り詰めを検出する必要がある場合はこちらを使う
- `callChat` は互換ラッパー（text のみ返す）。切り詰め検出が不要な通常の分析に使う
- バッチ処理で API を呼ぶ場合、`max_tokens` を十分に確保すること（レスポンスが `stop_reason: 'max_tokens'` で切れるとデータが失われる）
- 切り詰めが起きうる場面では `stopReason` をチェックし、必要に応じてリトライする

### 宝物庫（Fragments）のスキップマーカー
- AI が「光る文なし」と判断したエントリには `source: 'auto-skip'` のマーカーフラグメントが保存される
- これにより `getFragmentEntryIds()` が処理済みと認識し、再処理を防止する
- 表示時は `source !== 'auto-skip'` でフィルタすること
