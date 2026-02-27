import { Link } from 'react-router-dom';
import { useHead } from '../hooks/useHead';
import { WebSiteJsonLd, WebAppJsonLd, FAQJsonLd, HowToJsonLd, SoftwareAppJsonLd } from '../components/JsonLd';

const features = [
  {
    title: 'ランダム再会',
    desc: '過去の日記にランダムで再会。「他人モード」で匿名化して新鮮な目線で読み返し、「未来からの報告」で過去の自分にコメントを残せる。ワンクリックで日記をコピー可能。',
    icon: '🎲',
    link: '/random',
  },
  {
    title: 'この日の記録',
    desc: '1年前、3年前、5年前の同じ日を振り返る。時間を縦に貫いて、自分の変化を感じる。各日記をワンクリックでコピー可能。',
    icon: '📅',
    link: '/onthisday',
  },
  {
    title: 'キーワード検索',
    desc: 'あの日のあの言葉を探す全文検索。日付範囲の絞り込みやソート順の切り替えにも対応。検索結果の日記をワンクリックでコピー可能。',
    icon: '🔍',
    link: '/search',
  },
  {
    title: 'カレンダー表示',
    desc: '書いた日、書かなかった日。記録の密度をヒートマップカレンダーで一望。日付クリックでその日の日記を表示・コピー。',
    icon: '📆',
    link: '/calendar',
  },
  {
    title: '成長タイムライン',
    desc: 'AIを使わずに端末内で完結する感情分析。ネガティブ比率・安定指数・標高メタファー・トレンド検出・季節補正・レジリエンス指標をグラフで可視化。',
    icon: '📈',
    link: '/timeline',
  },
  {
    title: 'ワードクラウド',
    desc: 'よく使う言葉を可視化して語彙の傾向を把握。全期間・年別の切り替え、出現回数のフィルタリングに対応。',
    icon: '☁️',
    link: '/wordcloud',
  },
  {
    title: 'AI分析（4種類）',
    desc: 'OpenAI APIで日記を深層分析。「今日」は友人視点で深く読む。「今日の景色」はフィルターなしで全トピックをマッピング。「急所」は今日の日記から本質を突く。「外基準の統合」は内側を守ったまま外基準を道具として扱えているかを診る。',
    icon: '🤖',
    link: '/analysis',
  },
  {
    title: '観測所',
    desc: 'やさしい問いかけで日々を記録するジャーナリング。空模様・波の高さ・体温を選び、短いメモを残す。分析ではなく、ただ今日を観測する場所。',
    icon: '🔭',
    link: '/observatory',
  },
  {
    title: '宝物庫',
    desc: '日記を読み返す中で見つけた光っている一文を保存。テキストを選択して保存すれば、お気に入りの断片をいつでも読み返せる。',
    icon: '💎',
    link: '/fragments',
  },
];

const useCases = [
  {
    title: '日記を書き続けている方',
    desc: '何年分もの日記をインポートして、過去の自分と再会。タイムラインで感情の推移を追い、書き続けてきた記録が「資産」になります。',
  },
  {
    title: '自己分析・内省をしたい方',
    desc: 'ローカル感情分析でネガティブ比率やトレンドを把握。AI分析で友人視点の深い読み解きも。自分では気づけなかったパターンが見えてきます。',
  },
  {
    title: '今日をやさしく記録したい方',
    desc: '観測所のやさしい問いかけで、身体感覚や些細な気づきを記録。分析ではなく、ただ今日を観測する静かな場所。',
  },
  {
    title: 'プライバシーを重視する方',
    desc: 'データは一切外部に送信されません。ブラウザ内のみで完結する、安心の設計です。',
  },
];

const faqs = [
  {
    q: '登山ログとは何ですか？',
    a: '登山ログは、個人の日記やメモを管理・分析するためのウェブアプリケーションです。「登山」は自分を高めるという意味の比喩で、実際の登山記録アプリではありません。テキストやMarkdownファイルをインポートし、検索・分析・可視化など様々な方法で過去の記録を振り返ることができます。無料で利用でき、アカウント登録も不要です。',
  },
  {
    q: 'データはどこに保存されますか？',
    a: 'すべてのデータはお使いの端末のブラウザ内（IndexedDB）に保存されます。外部サーバーへの送信はありません。AI分析機能を使用する場合のみ、ユーザー自身のAPIキーでOpenAI APIと通信します。',
  },
  {
    q: '無料で使えますか？',
    a: 'はい、登山ログは完全無料でご利用いただけます。アカウント登録も不要です。AI分析機能を利用する場合のみ、ユーザー自身でOpenAI APIキーを取得する必要があり、APIの利用料金が別途発生します。',
  },
  {
    q: 'オフラインでも使えますか？',
    a: 'はい、PWA（Progressive Web App）に対応しているため、一度アクセスした後はオフラインでもご利用いただけます。日記の閲覧・検索・ワードクラウドなどすべての基本機能がオフラインで動作します。AI分析機能のみインターネット接続が必要です。',
  },
  {
    q: 'どのようなファイル形式に対応していますか？',
    a: 'テキストファイル（.txt）、Markdownファイル（.md）、JSONファイル（.json）に対応しています。日付は「2024年3月15日」「2024-03-15」「2024/03/15」などの形式を自動認識します。直接入力でブラウザ上から日記を書くこともできます。',
  },
  {
    q: 'AI分析ではどのような分析ができますか？',
    a: '「今日」「今日の景色」「急所」「外基準の統合」の4種類の深層分析に対応しています。「今日」は友人視点で今日の日記だけを深く読む分析。「今日の景色」はフィルターなしで今日の全トピックをマッピングする分析。「急所」は今日の日記から本質を突く指摘。「外基準の統合」は今日の日記から、内側を守ったまま外基準を道具として扱えているかを構造化する分析です。ユーザー自身のOpenAI APIキーを使用するため、データがサービス提供者に渡ることはありません。',
  },
  {
    q: 'スマートフォンでも使えますか？',
    a: 'はい、レスポンシブデザインに対応しており、スマートフォン・タブレット・PCなどあらゆるデバイスでご利用いただけます。PWAとしてホーム画面に追加することも可能です。',
  },
];

export function Landing() {
  useHead({
    title: undefined,
    description: '登山ログは日記やメモを取り込んで、ランダム再会・キーワード検索・カレンダー表示・ワードクラウド・AI感情分析で過去の自分と再会できる無料ウェブアプリです。データは端末内に保存。PWA対応でオフラインでも利用可能。',
    path: '/',
  });

  return (
    <div className="landing">
      <WebSiteJsonLd />
      <WebAppJsonLd />
      <SoftwareAppJsonLd />
      <HowToJsonLd />
      <FAQJsonLd />

      {/* Hero */}
      <section className="landing-hero">
        <h1 className="landing-title">登山ログ</h1>
        <p className="landing-tagline">未来から過去へロープを垂らす装置</p>
        <p className="landing-lead">
          日記を取り込んで、過去の自分と再会する。<br />
          検索・分析・可視化。静かに振り返るための無料ウェブアプリ。
        </p>
        <p className="landing-sub-lead">
          アカウント登録不要・データは端末内のみ保存・オフライン対応
        </p>
        <div className="landing-cta">
          <Link to="/import" className="btn btn-primary">はじめる（無料）</Link>
          <Link to="/home" className="btn">ダッシュボードへ</Link>
        </div>
      </section>

      {/* Features */}
      <section className="landing-section" id="features">
        <h2 className="landing-section-title">登山ログでできること ― 9つの主要機能</h2>
        <p className="landing-section-lead">
          日記をインポートするだけで、検索・分析・可視化のすべてが使えます。
        </p>
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
          <h3>ローカル感情分析 ― タイムライン・安定指数・標高メタファー</h3>
          <p>
            AIを使わずに端末内で完結する感情分析機能です。
            ネガティブ比率の推移、自己否定語の出現頻度、年ごとの安定指数をグラフで可視化。
            「どれだけ登ったか」を標高メタファーで表現する独自の成長指標も搭載しています。
          </p>
          <p><Link to="/timeline">成長タイムラインを見る</Link></p>
        </div>

        <div className="landing-detail-block">
          <h3>AI分析 ― 4種類の深層分析</h3>
          <p>
            OpenAI APIを使って日記を多角的に分析。「今日」は友人視点で今日の日記だけを深く読む。
            「今日の景色」はフィルターなしで今日の全トピックをマッピング ― 不安だけでなく好奇心も遊びも日常も等しく拾う。
            「急所」は今日の日記から本質を突くたった一つの指摘。「外基準の統合」は今日の日記から、内側を守ったまま外基準を道具として扱えているかを構造化する。
            ユーザー自身のAPIキーを使用するため、データがサービス提供者に渡ることはありません。
          </p>
          <p><Link to="/analysis">AI分析について詳しく見る</Link></p>
        </div>

        <div className="landing-detail-block">
          <h3>観測所 ― やさしい問いかけで今日を記録</h3>
          <p>
            「今日、おいしいって感じたものはあった？」「体が冷えたとき、どうやって温めた？」
            やさしい問いかけに答えるジャーナリング。空模様・波の高さ・体温を選び、短いメモを残す。
            分析や評価ではなく、ただ今日を観測する場所です。
          </p>
          <p><Link to="/observatory">観測所を開く</Link></p>
        </div>

        <div className="landing-detail-block">
          <h3>宝物庫 ― お気に入りの一文を収集</h3>
          <p>
            日記を読み返す中で見つけた、光っている一文を「宝物庫」に保存できます。
            テキストを選択して保存すれば、お気に入りの断片をいつでも読み返せます。
          </p>
          <p><Link to="/fragments">宝物庫を見る</Link></p>
        </div>
      </section>

      {/* How it works */}
      <section className="landing-section" id="howto">
        <h2 className="landing-section-title">使い方 ― 3ステップで始められます</h2>
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
              <h3 className="landing-step-title">好きな方法で読み返す</h3>
              <p className="landing-step-desc">
                ランダム表示で偶然の再会を楽しむ。「この日」で年をまたいだ振り返りをする。
                キーワード検索であの日の言葉を探す。カレンダーで記録の密度を一望する。
              </p>
            </div>
          </li>
          <li className="landing-step">
            <span className="landing-step-num" aria-hidden="true">3</span>
            <div>
              <h3 className="landing-step-title">可視化・分析で新たな気づきを得る</h3>
              <p className="landing-step-desc">
                タイムラインで感情の推移を追う。ワードクラウドで語彙の傾向を把握する。
                AI分析で客観的な視点を得る。日記が「自己分析ツール」になります。
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
              <dd>OpenAI API連携（ユーザー自身のAPIキー使用）</dd>
            </div>
            <div className="landing-spec-item">
              <dt>対応ファイル形式</dt>
              <dd>テキスト（.txt）・Markdown（.md）・JSON（.json）</dd>
            </div>
            <div className="landing-spec-item">
              <dt>料金</dt>
              <dd>完全無料（AI分析利用時のみOpenAI API利用料が別途発生）</dd>
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
            AI分析を使う場合のみ、あなた自身のAPIキーでOpenAIと通信します。
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
        <p className="landing-bottom-text">過去の自分に、ロープを垂らそう。</p>
        <p style={{ marginBottom: 16, color: 'var(--text-muted, #888)' }}>
          無料・登録不要・データは端末内のみ保存
        </p>
        <Link to="/import" className="btn btn-primary">日記をインポートする</Link>
      </section>
    </div>
  );
}
