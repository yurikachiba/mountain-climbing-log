# クリップボードコピーボタン機能 要件定義・仕様書

## 1. 背景・目的

「登山ログ」アプリにおいて、日記エントリーやAI分析結果などのテキストをワンタップでクリップボードにコピーできるボタンを各所に追加する。現状、コピー機能は AiLogs ページのみに実装済み。他のページでも同様のUXを提供し、外部への共有・転記を容易にする。

## 2. 現状分析

- フレームワーク: React 19 + TypeScript + Vite
- スタイリング: グローバルCSS（src/index.css、約2000行）
- 既存コピー実装: src/pages/AiLogs.tsx に navigator.clipboard.writeText ベースの実装あり
- フィードバックUI: .toast クラスによるトースト通知（2500ms自動消去）
- データソース: IndexedDB（idb ライブラリ経由）

## 3. 対象ページ・コピー対象

| # | ページ | ファイル | コピー対象 | コピー形式 |
|---|--------|----------|------------|------------|
| 1 | ランダム | src/pages/Random.tsx | 表示中の日記エントリー | 【{日付}】\n{本文} |
| 2 | この日の日記 | src/pages/OnThisDay.tsx | 各エントリー個別 | 【{日付}】\n{本文} |
| 3 | 検索結果 | src/pages/Search.tsx | 各検索結果エントリー | 【{日付}】\n{本文} |
| 4 | フラグメント | src/pages/Fragments.tsx | 各フラグメント | {テキスト} |
| 5 | AI分析 | src/pages/Analysis.tsx | 分析結果テキスト | 【{分析タイプ}】\n{結果} |
| 6 | AIログ | src/pages/AiLogs.tsx | 実装済み（変更なし） | — |

## 4. 機能仕様

### 4.1 共通コピーボタンコンポーネント

新規作成: src/components/CopyButton.tsx

Props:
- getText: () => string — コピー対象テキストを返す関数
- label?: string — ボタンラベル（デフォルト: "コピー"）

動作仕様:
- navigator.clipboard.writeText() を使用
- 成功時: ボタンテキストを「コピーしました」に一時変更（2500ms後に復帰）
- 失敗時: ボタンテキストを「コピーに失敗しました」に一時変更（2500ms後に復帰）
- コピー中の二重クリック防止（状態変化中はdisabled）

### 4.2 各ページでの配置

Random.tsx:
- 日記表示カードの右上またはフッター部分にコピーボタンを1つ配置
- コメント（FutureComment）は含めず、日付＋本文のみコピー

OnThisDay.tsx:
- 各エントリーカードにコピーボタンを配置

Search.tsx:
- 各検索結果アイテムにコピーボタンを配置

Fragments.tsx:
- 各フラグメントカードにコピーボタンを配置
- フラグメントはテキスト断片のため、テキストのみコピー

Analysis.tsx:
- 各分析結果セクションにコピーボタンを配置
- 分析タイプラベル＋結果テキストをコピー

### 4.3 フィードバックUI

既存の .toast パターンは使用しない。代わりにボタン自体の状態変化でフィードバックする（インライン方式）。理由: 複数コピーボタンが並ぶ画面では、どのボタンの結果か判別しやすいため。

## 5. UIデザイン仕様

ボタンスタイル:
- 外観: テキストボタン（ゴーストボタン）
- フォントサイズ: 0.8rem
- 色: var(--text-muted) → hover時 var(--text)
- アイコン: なし（テキストのみ「コピー」）
- 配置: カード内右上 or アクションエリア
- 状態変化時の色: 成功 → var(--accent)、失敗 → var(--danger)

CSSクラス:
- .copy-button
- .copy-button:hover
- .copy-button--copied
- .copy-button--failed

## 6. 実装方針

1. 共通コンポーネント CopyButton.tsx を作成
2. CSSクラスを index.css に追加
3. 各対象ページに CopyButton を組み込み
4. AiLogs.tsx の既存実装はリファクタ対象外（動作中のため触らない）

## 7. 技術的注意事項

- navigator.clipboard.writeText() はHTTPSまたはlocalhost環境でのみ動作
- フォーカスがウィンドウ外にある場合は失敗する（ブラウザ制約）
- PWA環境でも問題なく動作する（Service Worker経由ではない）
- iOS Safariでの clipboard API 対応状況を考慮（iOS 13.4+で対応済み）

## 8. 影響範囲

| ファイル | 変更内容 |
|----------|----------|
| src/components/CopyButton.tsx | 新規作成 |
| src/index.css | .copy-button 関連スタイル追加 |
| src/pages/Random.tsx | CopyButton 組み込み |
| src/pages/OnThisDay.tsx | CopyButton 組み込み |
| src/pages/Search.tsx | CopyButton 組み込み |
| src/pages/Fragments.tsx | CopyButton 組み込み |
| src/pages/Analysis.tsx | CopyButton 組み込み |

## 9. 受け入れ条件

- [ ] 各対象ページでコピーボタンが表示される
- [ ] ボタン押下でクリップボードに正しいテキストがコピーされる
- [ ] 成功・失敗のフィードバックがボタン上に表示される
- [ ] 2500ms後にボタンが元の状態に戻る
- [ ] 既存の AiLogs ページのコピー機能に影響がない
- [ ] モバイル（600px以下）でもボタンが操作可能
- [ ] TypeScriptの型チェック（tsc -b）がエラーなく通る
- [ ] ESLintエラーがない
