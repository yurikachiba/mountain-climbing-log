import { Link } from 'react-router-dom';
import { useHead } from '../hooks/useHead';

export function Terms() {
  useHead({
    title: '利用規約',
    description: '登山ログの利用規約。サービスの概要、ブラウザ内データ管理の責任、AI分析機能（OpenAI API）の利用条件、免責事項、知的財産権について。',
    keywords: '利用規約,サービス規約,免責事項',
    path: '/terms',
  });

  return (
    <div className="page">
      <h1 className="page-title">利用規約</h1>
      <p className="subtitle">最終更新日：2026年2月17日</p>

      <div className="legal-content">
        <section className="legal-section">
          <h2>1. はじめに</h2>
          <p>
            本利用規約（以下「本規約」）は、登山ログ（以下「本アプリ」）の利用条件を定めるものです。
            本アプリを利用することにより、本規約に同意したものとみなします。
          </p>
        </section>

        <section className="legal-section">
          <h2>2. サービスの概要</h2>
          <p>
            本アプリは、個人の日記・登山記録を管理するためのウェブアプリケーションです。
            日記のインポート、閲覧、検索、分析などの機能を提供します。
          </p>
        </section>

        <section className="legal-section">
          <h2>3. データの管理</h2>
          <p>
            本アプリのデータはお使いの端末のブラウザ内に保存されます。
            データのバックアップおよび管理はユーザー自身の責任で行ってください。
            ブラウザのデータ消去、端末の変更等によりデータが失われた場合、復元することはできません。
          </p>
        </section>

        <section className="legal-section">
          <h2>4. AI分析機能について</h2>
          <p>
            AI分析機能はOpenAI APIを利用しています。この機能を利用するには、ユーザー自身でOpenAI APIキーを取得・設定する必要があります。
            APIの利用料金はユーザー自身の負担となります。
            AI分析の結果は参考情報であり、その正確性を保証するものではありません。
          </p>
        </section>

        <section className="legal-section">
          <h2>5. 禁止事項</h2>
          <p>本アプリの利用にあたり、以下の行為を禁止します。</p>
          <ul>
            <li>本アプリの改ざん、リバースエンジニアリング、不正アクセス</li>
            <li>他者の権利を侵害するコンテンツの保存・共有</li>
            <li>本アプリを利用した違法行為</li>
            <li>本アプリのサーバーやネットワークに過度な負荷をかける行為</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>6. 免責事項</h2>
          <p>
            本アプリは「現状のまま」提供されます。
            開発者は、本アプリの利用によって生じたいかなる損害（データの消失、端末の不具合等を含む）についても、一切の責任を負いません。
            本アプリの動作やサービスの継続を保証するものではありません。
          </p>
        </section>

        <section className="legal-section">
          <h2>7. 知的財産権</h2>
          <p>
            本アプリに関する著作権その他の知的財産権は、開発者に帰属します。
            ユーザーが本アプリに入力したコンテンツの権利は、ユーザー自身に帰属します。
          </p>
        </section>

        <section className="legal-section">
          <h2>8. 規約の変更</h2>
          <p>
            本規約は、必要に応じて変更されることがあります。
            変更後に本アプリを利用した場合、変更後の規約に同意したものとみなします。
          </p>
        </section>

        <section className="legal-section">
          <h2>9. 準拠法</h2>
          <p>
            本規約の解釈および適用は、日本法に準拠するものとします。
          </p>
        </section>

        <div className="legal-back">
          <Link to="/" className="btn btn-small">ホームに戻る</Link>
        </div>
      </div>
    </div>
  );
}
