import { Link } from 'react-router-dom';

const features = [
  {
    title: 'ランダム再会',
    desc: '過去の日記にランダムで再会。忘れていた日の自分と出会い直す。',
    icon: '🎲',
  },
  {
    title: 'この日の記録',
    desc: '1年前、3年前、5年前の同じ日。時間を縦に貫いて振り返る。',
    icon: '📅',
  },
  {
    title: 'キーワード検索',
    desc: 'あの日のあの言葉を探す。日付範囲の絞り込みにも対応。',
    icon: '🔍',
  },
  {
    title: 'カレンダー表示',
    desc: '書いた日、書かなかった日。記録の密度を一望する。',
    icon: '📆',
  },
  {
    title: 'ワードクラウド',
    desc: 'よく使う言葉を可視化。自分の語彙の癖に気づく。',
    icon: '☁️',
  },
  {
    title: 'AI分析',
    desc: 'OpenAI APIで日記を分析。感情の推移やトーンを客観的に。',
    icon: '🤖',
  },
];

export function Landing() {
  return (
    <div className="landing">
      {/* Hero */}
      <section className="landing-hero">
        <h1 className="landing-title">登山ログ</h1>
        <p className="landing-tagline">未来から過去へロープを垂らす装置</p>
        <p className="landing-lead">
          日記を取り込んで、過去の自分と再会する。<br />
          検索、分析、可視化。静かに振り返るためのツール。
        </p>
        <div className="landing-cta">
          <Link to="/import" className="btn btn-primary">はじめる</Link>
          <Link to="/home" className="btn">ダッシュボードへ</Link>
        </div>
      </section>

      {/* Features */}
      <section className="landing-section">
        <h2 className="landing-section-title">できること</h2>
        <div className="landing-features">
          {features.map(f => (
            <div key={f.title} className="landing-feature">
              <span className="landing-feature-icon">{f.icon}</span>
              <h3 className="landing-feature-title">{f.title}</h3>
              <p className="landing-feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="landing-section">
        <h2 className="landing-section-title">使い方</h2>
        <div className="landing-steps">
          <div className="landing-step">
            <span className="landing-step-num">1</span>
            <div>
              <h3 className="landing-step-title">日記をインポート</h3>
              <p className="landing-step-desc">
                テキストファイルやMarkdownファイルをドラッグ＆ドロップ。日付を自動で認識します。
              </p>
            </div>
          </div>
          <div className="landing-step">
            <span className="landing-step-num">2</span>
            <div>
              <h3 className="landing-step-title">読み返す</h3>
              <p className="landing-step-desc">
                ランダム表示、「この日」の振り返り、キーワード検索。好きな方法で過去に触れる。
              </p>
            </div>
          </div>
          <div className="landing-step">
            <span className="landing-step-num">3</span>
            <div>
              <h3 className="landing-step-title">可視化・分析する</h3>
              <p className="landing-step-desc">
                タイムライン、ワードクラウド、AI分析で日記を別の角度から眺める。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="landing-section">
        <div className="landing-privacy-card">
          <h2 className="landing-privacy-title">あなたのデータは、あなたの手元に</h2>
          <p className="landing-privacy-desc">
            すべてのデータはブラウザ内に保存されます。外部サーバーへの送信はありません。
            AI分析を使う場合のみ、あなた自身のAPIキーでOpenAIと通信します。
          </p>
          <div className="landing-privacy-badges">
            <span className="landing-badge">ローカル保存</span>
            <span className="landing-badge">サーバー不要</span>
            <span className="landing-badge">オフライン対応</span>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="landing-bottom-cta">
        <p className="landing-bottom-text">過去の自分に、ロープを垂らそう。</p>
        <Link to="/import" className="btn btn-primary">日記をインポートする</Link>
      </section>
    </div>
  );
}
