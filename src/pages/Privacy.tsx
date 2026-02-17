import { Link } from 'react-router-dom';

export function Privacy() {
  return (
    <div className="page">
      <h1 className="page-title">プライバシーポリシー</h1>
      <p className="subtitle">最終更新日：2026年2月17日</p>

      <div className="legal-content">
        <section className="legal-section">
          <h2>1. はじめに</h2>
          <p>
            登山ログ（以下「本アプリ」）は、ユーザーのプライバシーを尊重し、個人情報の保護に努めます。
            本プライバシーポリシーでは、本アプリにおけるデータの取り扱いについて説明します。
          </p>
        </section>

        <section className="legal-section">
          <h2>2. データの保存場所</h2>
          <p>
            本アプリで作成・インポートされた日記データは、すべてお使いの端末のブラウザ内（IndexedDB）にのみ保存されます。
            データが外部のサーバーに送信・保存されることはありません。
          </p>
        </section>

        <section className="legal-section">
          <h2>3. 外部サービスとの通信</h2>
          <p>
            AI分析機能を使用する場合に限り、日記の一部がOpenAI APIに送信されます。
            この通信はユーザーが自身のAPIキーを設定し、明示的に分析を実行した場合にのみ行われます。
            OpenAIへのデータ送信に関する詳細は、
            <a href="https://openai.com/privacy" target="_blank" rel="noopener noreferrer">OpenAIのプライバシーポリシー</a>
            をご確認ください。
          </p>
        </section>

        <section className="legal-section">
          <h2>4. Cookie・トラッキング</h2>
          <p>
            本アプリは、分析や広告目的のCookieやトラッキング技術を使用しません。
            PWA（Progressive Web App）の動作に必要なService Workerおよびローカルストレージのみを使用します。
          </p>
        </section>

        <section className="legal-section">
          <h2>5. APIキーの管理</h2>
          <p>
            OpenAI APIキーは、お使いの端末のブラウザ内（localStorage）にのみ保存されます。
            APIキーが本アプリの開発者に送信されることはありません。
            APIキーの管理はユーザー自身の責任のもとで行ってください。
          </p>
        </section>

        <section className="legal-section">
          <h2>6. データの削除</h2>
          <p>
            設定ページからすべてのデータを削除できます。
            また、ブラウザのサイトデータを削除することでも、本アプリに関連するすべてのデータが消去されます。
          </p>
        </section>

        <section className="legal-section">
          <h2>7. お子様のプライバシー</h2>
          <p>
            本アプリは特定の年齢層を対象としておらず、意図的にお子様の個人情報を収集することはありません。
          </p>
        </section>

        <section className="legal-section">
          <h2>8. ポリシーの変更</h2>
          <p>
            本プライバシーポリシーは、必要に応じて更新されることがあります。
            変更があった場合は、本ページに掲載します。
          </p>
        </section>

        <div className="legal-back">
          <Link to="/" className="btn btn-small">ホームに戻る</Link>
        </div>
      </div>
    </div>
  );
}
