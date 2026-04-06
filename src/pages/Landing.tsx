import { Link } from 'react-router-dom';
import { useHead } from '../hooks/useHead';
import { WebSiteJsonLd, WebAppJsonLd, FAQJsonLd, HowToJsonLd, SoftwareAppJsonLd, OrganizationJsonLd, ItemListJsonLd } from '../components/JsonLd';

const features = [
  {
    title: 'AI分析（7種類）',
    desc: 'Claude APIで日記を深層分析。「今日」は友人視点で深く読む。「今日の景色」は全トピックの並びを見せる。「急所」は本質を突く。「外基準の統合」は内側を守ったまま外基準を扱えているかを診る。「自然の眼」は比喩・メタファーから世界の捉え方を読む。「時間の地層」は3日〜5年の8つの距離から変化を描く。「横断読み」は複数の分析結果を横断して、形を変えて繰り返し現れるパターンを見つける。',
    icon: '🔭',
    link: '/analysis',
  },
  {
    title: '成長タイムライン',
    desc: 'AIを使わずに端末内で完結する感情分析。ネガティブ比率・安定指数・標高メタファー・トレンド検出・季節補正・レジリエンス指標をグラフで可視化。',
    icon: '⛰️',
    link: '/timeline',
  },
  {
    title: '宝物庫',
    desc: 'AIが日記の中から「光っている一文」を自動で見つけて集める。一括収集で過去の日記すべてから抽出。手動保存にも対応。',
    icon: '💎',
    link: '/fragments',
  },
  {
    title: 'AI分析ログ',
    desc: '過去のAI分析結果をすべて保存・一覧表示。分析タイプごとの絞り込み、結果のコピーに対応。分析の蓄積が、振り返りの資産になる。',
    icon: '📜',
    link: '/ai-logs',
  },
];

const useCases = [
  {
    title: '日記を書き続けている方',
    desc: '何年分もの日記をインポートして、AI分析で多角的に読み解く。タイムラインで感情の推移を追い、書き続けてきた記録が「資産」になります。',
  },
  {
    title: '自己分析・内省をしたい方',
    desc: 'ローカル感情分析でネガティブ比率やトレンドを把握。AI分析で友人視点の深い読み解きも。自分では気づけなかったパターンが見えてきます。',
  },
  {
    title: 'プライバシーを重視する方',
    desc: 'データは一切外部に送信されません。ブラウザ内のみで完結する、安心の設計です。',
  },
];

const faqs = [
  {
    q: '登山ログとは何ですか？',
    a: '登山ログは、個人の日記やメモをAIで深層分析するためのウェブアプリケーションです。「登山」は自分を高めるという意味の比喩で、実際の登山記録アプリではありません。テキストやMarkdownファイルをインポートし、7種類のAI分析・感情タイムライン・宝物庫で過去の記録を多角的に振り返ることができます。無料で利用でき、アカウント登録も不要です。',
  },
  {
    q: 'データはどこに保存されますか？',
    a: 'すべてのデータはお使いの端末のブラウザ内（IndexedDB）に保存されます。外部サーバーへの送信はありません。AI分析機能を使用する場合のみ、ユーザー自身のAPIキーでClaude APIと通信します。',
  },
  {
    q: '無料で使えますか？',
    a: 'はい、登山ログは完全無料でご利用いただけます。アカウント登録も不要です。AI分析機能を利用する場合のみ、ユーザー自身でAnthropic APIキーを取得する必要があり、APIの利用料金が別途発生します。',
  },
  {
    q: 'オフラインでも使えますか？',
    a: 'はい、PWA（Progressive Web App）に対応しているため、一度アクセスした後はオフラインでもご利用いただけます。感情タイムラインなどの基本機能がオフラインで動作します。AI分析機能のみインターネット接続が必要です。',
  },
  {
    q: 'どのようなファイル形式に対応していますか？',
    a: 'テキストファイル（.txt）、Markdownファイル（.md）、JSONファイル（.json）に対応しています。日付は「2024年3月15日」「2024-03-15」「2024/03/15」などの形式を自動認識します。直接入力でブラウザ上から日記を書くこともできます。',
  },
  {
    q: 'AI分析ではどのような分析ができますか？',
    a: '「今日」「今日の景色」「急所」「外基準の統合」「自然の眼」「時間の地層」「横断読み」の7種類の深層分析に対応しています。「今日」は友人視点で今日の日記だけを深く読む分析。「今日の景色」は今日の全トピックの並びと温度差を見せる分析。「急所」は今日の日記から本質を突く指摘。「外基準の統合」は内側を守ったまま外基準を道具として扱えているかを構造化する分析。「自然の眼」は日記の中の比喩・メタファーを拾い上げ、世界の捉え方を読み解く分析。「時間の地層」は3日・1週間・1ヶ月・3ヶ月・半年・1年・3年・5年の8つの距離から今日を見て、変化の事実を評価せずに描く分析。「横断読み」は他の分析結果を横断して読み、同じ急所が形を変えて繰り返し現れるパターンや分析間のつながりを見つける分析です。ユーザー自身のAnthropic APIキーを使用するため、データがサービス提供者に渡ることはありません。',
  },
  {
    q: 'スマートフォンでも使えますか？',
    a: 'はい、レスポンシブデザインに対応しており、スマートフォン・タブレット・PCなどあらゆるデバイスでご利用いただけます。PWAとしてホーム画面に追加することも可能です。',
  },
  {
    q: '登山ログの使い方を教えてください',
    a: '2ステップで始められます。(1) 日記をインポート: テキストファイル(.txt)やMarkdown(.md)、JSON(.json)をドラッグ＆ドロップ、またはブラウザ上で直接入力。(2) AI分析・可視化: 7種類のAI深層分析で日記を多角的に読み解く。タイムラインで感情の推移を追う。宝物庫で光る一文を集める。アカウント登録不要で、すぐに使い始められます。',
  },
  {
    q: '日記アプリのおすすめは？プライバシーが心配です',
    a: '登山ログはプライバシーを最も重視した日記分析アプリです。すべてのデータはブラウザ内（IndexedDB）に保存され、外部サーバーへの送信は一切ありません。Cookie・トラッキング不使用、アカウント登録も不要。PWA対応でオフラインでも使えます。無料で、7種類のAI深層分析・感情タイムライン・宝物庫を搭載しています。',
  },
  {
    q: '日記のAI分析ができるアプリはありますか？',
    a: '登山ログはClaude APIを使った7種類のAI深層分析に対応しています。「今日」は友人視点で日記を深く読む分析、「急所」は本質を突く指摘、「時間の地層」は3日〜5年の8つの距離から変化を描く分析など、多角的に日記を分析できます。さらにAIを使わないローカル感情分析（タイムライン）も搭載。ユーザー自身のAPIキーを使うため、日記データがサービス提供者に渡ることはありません。',
  },
];

export function Landing() {
  useHead({
    title: undefined,
    description: '昔の自分の言葉に、もう一度会える。日記を取り込んでAIで深層分析する無料ウェブアプリ。7種類のAI分析・感情タイムライン・宝物庫。データは端末内だけ、登録不要。',
    path: '/',
  });

  return (
    <div className="landing">
      <WebSiteJsonLd />
      <WebAppJsonLd />
      <SoftwareAppJsonLd />
      <HowToJsonLd />
      <FAQJsonLd />
      <OrganizationJsonLd />
      <ItemListJsonLd />

      {/* Hero */}
      <section className="landing-hero">
        <p className="landing-brand">登山ログ</p>
        <h1 className="landing-title">昔の自分の言葉に、もう一度会える</h1>
        <p className="landing-lead">
          記録しただけで終わらない。<br />
          日記をAIで深層分析して、自分の変化を見つける。
        </p>
        <p className="landing-sub-lead">
          データは端末内だけ。登録不要。無料。
        </p>
        <div className="landing-cta">
          <Link to="/import" className="btn btn-primary">はじめる（無料）</Link>
          <Link to="/analysis" className="btn">AI分析を見る</Link>
        </div>
      </section>

      {/* 3 Pillars */}
      <section className="landing-section" id="pillars">
        <div className="landing-pillars">
          <div className="landing-pillar">
            <span className="landing-pillar-icon" aria-hidden="true">🪞</span>
            <h2 className="landing-pillar-title">AIが日記を深く読む</h2>
            <p className="landing-pillar-desc">
              7種類の深層分析で、自分では気づけないパターンを発見。友人視点、急所、時間の地層、横断読み。日記が「自分を知る道具」になる。
            </p>
          </div>
          <div className="landing-pillar">
            <span className="landing-pillar-icon" aria-hidden="true">🏠</span>
            <h2 className="landing-pillar-title">データは端末内だけで安全</h2>
            <p className="landing-pillar-desc">
              すべてのデータはブラウザ内に保存。外部送信なし、Cookie不使用、アカウント登録不要。日記という最もプライベートなデータを、最も安全な場所に。
            </p>
          </div>
          <div className="landing-pillar">
            <span className="landing-pillar-icon" aria-hidden="true">⛰️</span>
            <h2 className="landing-pillar-title">変化がグラフで見える</h2>
            <p className="landing-pillar-desc">
              感情の推移・安定指数・トレンド検出をタイムラインで可視化。AIを使わず端末内で完結する分析で、長期的な自分の変化を追える。
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="landing-section" id="features">
        <h2 className="landing-section-title">すべての機能</h2>
        <div className="landing-features" role="list">
          {features.map(f => (
            <article key={f.title} className="landing-feature" role="listitem">
              <span className="landing-feature-icon" aria-hidden="true">{f.icon}</span>
              <h3 className="landing-feature-title">
                <Link to={f.link} className="landing-feature-link">{f.title}</Link>
              </h3>
              <p className="landing-feature-desc">{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Detailed Features */}
      <section className="landing-section" id="details">
        <h2 className="landing-section-title">機能の詳細</h2>

        <div className="landing-detail-block">
          <h3>日記インポート ― 対応フォーマットと自動日付認識</h3>
          <p>
            テキストファイル（.txt）、Markdownファイル（.md）、JSONファイル（.json）をドラッグ＆ドロップまたはファイル選択で取り込めます。
            「2024年3月15日」「2024-03-15」「2024/03/15」などの日付形式を自動認識し、日記エントリとして整理します。
            ブラウザ上から直接入力で日記を書くことも可能です。
          </p>
          <p><Link to="/import">日記のインポートを試す</Link></p>
        </div>

        <div className="landing-detail-block">
          <h3>AI分析 ― 7種類の深層分析</h3>
          <p>
            Claude APIを使って日記を多角的に分析。「今日」は友人視点で今日の日記だけを深く読む。
            「今日の景色」は今日の全トピックの並びと温度差を見せる。
            「急所」は今日の日記から本質を突くたった一つの指摘。「外基準の統合」は今日の日記から、内側を守ったまま外基準を道具として扱えているかを構造化する。
            「自然の眼」は日記の中の比喩・メタファー・自然的イメージを拾い上げ、書き手がどんなレンズで世界を見ているかを読み解く。
            「時間の地層」は3日・1週間・1ヶ月・3ヶ月・半年・1年・3年・5年の8つの距離から今日を見て、変化の事実を評価せずに描く。
            「横断読み」は他の分析結果を横断して読み、同じ急所が形を変えて繰り返し現れるパターンや分析間のつながりを見つける。
            ユーザー自身のAPIキーを使用するため、データがサービス提供者に渡ることはありません。
          </p>
          <p><Link to="/analysis">AI分析について詳しく見る</Link></p>
        </div>

        <div className="landing-detail-block">
          <h3>ローカル感情分析 ― タイムライン・安定指数・標高メタファー</h3>
          <p>
            AIを使わずに端末内で完結する感情分析機能です。
            ネガティブ比率の推移、自己否定語の出現頻度、年ごとの安定指数をグラフで可視化。
            「どれだけ登ったか」を標高メタファーで表現する独自の成長指標も搭載しています。
          </p>
          <p><Link to="/timeline">成長タイムラインを見る</Link></p>
        </div>

        <div className="landing-detail-block">
          <h3>宝物庫 ― AIが光る一文を自動収集</h3>
          <p>
            Claude APIが日記の中から「光っている一文」を自動で見つけて集めます。
            一括収集ボタンで過去の日記すべてから抽出。手動保存にも対応しています。
          </p>
          <p><Link to="/fragments">宝物庫を見る</Link></p>
        </div>
      </section>

      {/* How it works */}
      <section className="landing-section" id="howto">
        <h2 className="landing-section-title">使い方 ― 2ステップで始められます</h2>
        <ol className="landing-steps">
          <li className="landing-step">
            <span className="landing-step-num" aria-hidden="true">1</span>
            <div>
              <h3 className="landing-step-title">日記をインポート</h3>
              <p className="landing-step-desc">
                テキストファイルやMarkdownファイルをドラッグ＆ドロップ。日付を自動で認識します。
                直接入力でブラウザ上から書くことも可能です。アカウント登録は不要です。
              </p>
            </div>
          </li>
          <li className="landing-step">
            <span className="landing-step-num" aria-hidden="true">2</span>
            <div>
              <h3 className="landing-step-title">AI分析・可視化で新たな気づきを得る</h3>
              <p className="landing-step-desc">
                7種類のAI深層分析で日記を多角的に読み解く。タイムラインで感情の推移を追う。
                宝物庫で日記の中の光る一文を集める。日記が「自己分析ツール」になります。
              </p>
            </div>
          </li>
        </ol>
      </section>

      {/* Use Cases */}
      <section className="landing-section" id="usecases">
        <h2 className="landing-section-title">こんな方におすすめ</h2>
        <div className="landing-features" role="list">
          {useCases.map(u => (
            <article key={u.title} className="landing-feature" role="listitem">
              <h3 className="landing-feature-title">{u.title}</h3>
              <p className="landing-feature-desc">{u.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Technical Highlights */}
      <section className="landing-section" id="tech">
        <h2 className="landing-section-title">技術的特徴</h2>
        <div className="landing-detail-block">
          <dl className="landing-spec-list">
            <div className="landing-spec-item">
              <dt>フレームワーク</dt>
              <dd>React + TypeScript + Vite</dd>
            </div>
            <div className="landing-spec-item">
              <dt>データ保存</dt>
              <dd>IndexedDB（ブラウザ内完結・サーバー不要）</dd>
            </div>
            <div className="landing-spec-item">
              <dt>オフライン対応</dt>
              <dd>PWA（Progressive Web App）で完全オフライン動作</dd>
            </div>
            <div className="landing-spec-item">
              <dt>AI分析</dt>
              <dd>Claude API連携（ユーザー自身のAPIキー使用）</dd>
            </div>
            <div className="landing-spec-item">
              <dt>対応ファイル形式</dt>
              <dd>テキスト（.txt）・Markdown（.md）・JSON（.json）</dd>
            </div>
            <div className="landing-spec-item">
              <dt>料金</dt>
              <dd>完全無料（AI分析利用時のみClaude API利用料が別途発生）</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Privacy */}
      <section className="landing-section" id="privacy">
        <div className="landing-privacy-card">
          <h2 className="landing-privacy-title">あなたのデータは、あなたの手元に</h2>
          <p className="landing-privacy-desc">
            すべてのデータはブラウザ内（IndexedDB）に保存されます。外部サーバーへの送信はありません。
            Cookie・トラッキングは一切使用しません。
            AI分析を使う場合のみ、あなた自身のAPIキーでAnthropic Claudeと通信します。
            いつでも設定ページからデータを完全に削除できます。
          </p>
          <div className="landing-privacy-badges">
            <span className="landing-badge">ローカル保存</span>
            <span className="landing-badge">サーバー不要</span>
            <span className="landing-badge">オフライン対応</span>
            <span className="landing-badge">Cookie不使用</span>
            <span className="landing-badge">アカウント登録不要</span>
          </div>
          <p style={{ marginTop: 12, fontSize: '0.9em' }}>
            <Link to="/privacy">プライバシーポリシー</Link> ／ <Link to="/terms">利用規約</Link>
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="landing-section" id="faq">
        <h2 className="landing-section-title">よくある質問（FAQ）</h2>
        <div className="landing-faq-list">
          {faqs.map(faq => (
            <details key={faq.q} className="landing-faq-item">
              <summary className="landing-faq-question">{faq.q}</summary>
              <p className="landing-faq-answer">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="landing-bottom-cta">
        <p className="landing-bottom-text">昔の自分の言葉に、もう一度会いに行く。</p>
        <p style={{ marginBottom: 16, color: 'var(--text-muted, #888)' }}>
          無料・登録不要・データは端末内のみ保存
        </p>
        <Link to="/import" className="btn btn-primary">日記をインポートする</Link>
      </section>
    </div>
  );
}
