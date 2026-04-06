const BASE_URL = 'https://mountain-climbing-log.com';

export function WebSiteJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: '登山ログ',
    alternateName: 'Tozan Log',
    url: BASE_URL,
    description: '昔の自分の言葉に、もう一度会える。日記を取り込んで過去の自分と再会する無料ウェブアプリ。データは端末内だけ、登録不要。',
    inLanguage: 'ja',
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function WebAppJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: '登山ログ',
    url: BASE_URL,
    description: '昔の自分の言葉に、もう一度会える日記アプリ。過去の自分と再会し、変化を見つける。データは端末内だけ、登録不要、無料。',
    applicationCategory: 'LifestyleApplication',
    applicationSubCategory: '日記分析ツール',
    operatingSystem: 'All',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'JPY',
      availability: 'https://schema.org/InStock',
    },
    featureList: [
      '日記インポート（テキスト・Markdown・JSON対応、自動日付認識）',
      'AI分析7種類（今日・今日の景色・急所・外基準の統合・自然の眼・時間の地層・横断読み ― Claude API連携）',
      'AI分析ログ（過去の分析結果の一覧・絞り込み・コピー）',
      '成長タイムライン（ローカル感情分析・トレンド検出・レジリエンス指標）',
      '宝物庫（AIが日記から光る一文を自動収集）',
      'オフライン対応（PWA）',
      'データエクスポート・バックアップ機能',
    ],
    browserRequirements: 'Requires JavaScript. Requires HTML5. Requires IndexedDB.',
    permissions: 'none',
    inLanguage: 'ja',
    screenshot: `${BASE_URL}/ogp.png`,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '5',
      ratingCount: '1',
      bestRating: '5',
      worstRating: '1',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function SoftwareAppJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: '登山ログ',
    url: BASE_URL,
    description: '昔の自分の言葉に、もう一度会える。日記の管理・分析・可視化ができる無料ウェブアプリ。データは端末内だけ、登録不要。',
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Web Browser (Chrome, Firefox, Safari, Edge)',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'JPY',
    },
    softwareVersion: '1.0',
    inLanguage: 'ja',
    isAccessibleForFree: true,
    keywords: '日記分析,AI分析,感情分析,タイムライン,PWA,オフライン',
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function HowToJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: '登山ログの使い方 ― 日記を取り込んでAI分析する2ステップ',
    description: '登山ログで日記をインポートし、AI分析・感情タイムライン・宝物庫で過去の自分と再会する方法を2ステップで解説します。',
    totalTime: 'PT3M',
    tool: [
      { '@type': 'HowToTool', name: 'ウェブブラウザ（Chrome、Firefox、Safari、Edge）' },
    ],
    supply: [
      { '@type': 'HowToSupply', name: '日記ファイル（テキスト、Markdown、またはJSON形式）' },
    ],
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: '日記をインポート',
        text: 'テキストファイル（.txt）、Markdownファイル（.md）、JSONファイル（.json）をドラッグ＆ドロップまたはファイル選択で取り込みます。日付は「2024年3月15日」「2024-03-15」「2024/03/15」などの形式を自動認識。ブラウザから直接入力も可能です。',
        url: `${BASE_URL}/import`,
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: 'AI分析・可視化で新たな気づきを得る',
        text: '7種類のAI深層分析で日記を多角的に読み解く。タイムラインで感情の推移を追う。宝物庫で日記の中の光る一文を集める。日記が自己分析ツールになります。',
        url: `${BASE_URL}/analysis`,
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function OrganizationJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: '登山ログ',
    url: BASE_URL,
    logo: `${BASE_URL}/favicon.svg`,
    description: 'プライバシーファーストな日記分析ウェブアプリ「登山ログ」の開発・運営',
    sameAs: [],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function ItemListJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: '登山ログの主要機能一覧',
    description: '登山ログが提供する主要機能',
    numberOfItems: 4,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'AI分析（7種類）', description: 'Claude APIで今日・今日の景色・急所・外基準の統合・自然の眼・時間の地層・横断読みの7種類の深層分析。', url: `${BASE_URL}/analysis` },
      { '@type': 'ListItem', position: 2, name: '成長タイムライン', description: 'ローカル感情分析。ネガティブ比率・安定指数・標高メタファーをグラフで可視化。', url: `${BASE_URL}/timeline` },
      { '@type': 'ListItem', position: 3, name: '宝物庫', description: 'AIが日記から光る一文を自動収集。', url: `${BASE_URL}/fragments` },
      { '@type': 'ListItem', position: 4, name: 'AI分析ログ', description: '過去のAI分析結果をすべて保存・一覧表示。', url: `${BASE_URL}/ai-logs` },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

interface BreadcrumbItem {
  name: string;
  path: string;
}

export function BreadcrumbJsonLd({ items }: { items: BreadcrumbItem[] }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'トップ', item: BASE_URL },
      ...items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 2,
        name: item.name,
        item: `${BASE_URL}${item.path}`,
      })),
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function FAQJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: '登山ログとは何ですか？',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '登山ログは、個人の日記やメモをAIで深層分析するための無料ウェブアプリケーションです。「登山」は自分を高めるという意味の比喩で、実際の登山記録アプリではありません。テキストやMarkdownファイルをインポートし、7種類のAI分析・感情タイムライン・宝物庫で過去の記録を多角的に振り返ることができます。無料で利用でき、アカウント登録も不要です。',
        },
      },
      {
        '@type': 'Question',
        name: 'データはどこに保存されますか？',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'すべてのデータはお使いの端末のブラウザ内（IndexedDB）に保存されます。外部サーバーへの送信はありません。AI分析機能を使用する場合のみ、ユーザー自身のAPIキーでClaude APIと通信します。Cookie・トラッキングも一切使用しません。',
        },
      },
      {
        '@type': 'Question',
        name: '無料で使えますか？',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'はい、登山ログは完全無料でご利用いただけます。アカウント登録も不要です。AI分析機能を利用する場合のみ、ユーザー自身でAnthropic APIキーを取得する必要があり、APIの利用料金が別途発生します。',
        },
      },
      {
        '@type': 'Question',
        name: 'オフラインでも使えますか？',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'はい、PWA（Progressive Web App）に対応しているため、一度アクセスした後はオフラインでもご利用いただけます。感情タイムラインなどの基本機能がオフラインで動作します。AI分析機能のみインターネット接続が必要です。',
        },
      },
      {
        '@type': 'Question',
        name: 'どのようなファイル形式に対応していますか？',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'テキストファイル（.txt）、Markdownファイル（.md）、JSONファイル（.json）に対応しています。日付は「2024年3月15日」「2024-03-15」「2024/03/15」などの形式を自動認識します。ブラウザ上から直接入力で日記を書くこともできます。',
        },
      },
      {
        '@type': 'Question',
        name: 'AI分析ではどのような分析ができますか？',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '「今日」「今日の景色」「急所」「外基準の統合」「自然の眼」「時間の地層」「横断読み」の7種類の深層分析に対応しています。「今日」は友人視点で今日の日記だけを深く読む分析、「今日の景色」は今日の全トピックの並びと温度差を見せる分析、「急所」は今日の日記から本質を突く指摘、「外基準の統合」は内側を守ったまま外基準を道具として扱えているかを構造化する分析、「自然の眼」は日記の中の比喩・メタファーを拾い上げ世界の捉え方を読み解く分析、「時間の地層」は3日〜5年の8つの距離から変化を描く分析、「横断読み」は他の分析結果を横断して形を変えて繰り返し現れるパターンを見つける分析です。ユーザー自身のAnthropic APIキーを使用するため、データがサービス提供者に渡ることはありません。',
        },
      },
      {
        '@type': 'Question',
        name: 'スマートフォンでも使えますか？',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'はい、レスポンシブデザインに対応しており、スマートフォン・タブレット・PCなどあらゆるデバイスでご利用いただけます。PWAとしてホーム画面に追加することも可能です。',
        },
      },
      {
        '@type': 'Question',
        name: '登山ログの使い方を教えてください',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '2ステップで始められます。(1) 日記をインポート: テキストファイル(.txt)やMarkdown(.md)、JSON(.json)をドラッグ＆ドロップ、またはブラウザ上で直接入力。(2) AI分析・可視化: 7種類のAI深層分析で日記を多角的に読み解く。タイムラインで感情の推移を追う。宝物庫で光る一文を集める。アカウント登録不要で、すぐに使い始められます。',
        },
      },
      {
        '@type': 'Question',
        name: '日記アプリのおすすめは？プライバシーが心配です',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '登山ログはプライバシーを最も重視した日記分析アプリです。すべてのデータはブラウザ内（IndexedDB）に保存され、外部サーバーへの送信は一切ありません。Cookie・トラッキング不使用、アカウント登録も不要。PWA対応でオフラインでも使えます。無料で、7種類のAI深層分析・感情タイムライン・宝物庫を搭載しています。',
        },
      },
      {
        '@type': 'Question',
        name: '日記のAI分析ができるアプリはありますか？',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '登山ログはClaude APIを使った7種類のAI深層分析に対応しています。「今日」は友人視点で日記を深く読む分析、「急所」は本質を突く指摘、「時間の地層」は3日〜5年の8つの距離から変化を描く分析など、多角的に日記を分析できます。さらにAIを使わないローカル感情分析（タイムライン）も搭載。ユーザー自身のAPIキーを使うため、日記データがサービス提供者に渡ることはありません。',
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
