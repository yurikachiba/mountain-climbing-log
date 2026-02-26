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
