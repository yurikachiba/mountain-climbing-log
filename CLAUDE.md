# CLAUDE.md

## 基本ルール

- 日本語で話してください
- 機能を追加・変更・削除したら、以下のファイルを**毎回すべて**確認して更新すること：
  - `src/pages/Landing.tsx` — ランディングページ（features配列、機能詳細セクション、FAQのすべて）
  - `src/components/JsonLd.tsx` — 構造化データ（featureList、HowTo、FAQ）
  - `public/llms.txt` — LLM向けサイト説明（機能一覧、ページ一覧）
  - `public/sitemap.xml` — サイトマップ（新しいページを追加した場合）
  - 機能の数・名前・説明が変わったら、上記すべてを同時に更新する。一部だけ更新して古い記述を残さない
