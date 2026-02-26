const BASE_URL = 'https://mountain-climbing-log.com';

export function WebSiteJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: '登山ログ',
    alternateName: 'Tozan Log',
    url: BASE_URL,
    description: '登山ログは日記やメモを取り込んで、ランダム再会・キーワード検索・カレンダー表示・ワードクラウド・AI感情分析で過去の自分と再会できる無料ウェブアプリです。データは端末内に保存、プライバシーファースト設計。',
    inLanguage: 'ja',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
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
    description: '日記やメモを取り込んで、ランダム再会・検索・カレンダー・ワードクラウド・AI分析で過去の自分と再会するウェブアプリ。データは端末内のみ保存。',
    applicationCategory: 'LifestyleApplication',
    applicationSubCategory: '日記管理・ナレッジ分析ツール',
    operatingSystem: 'All',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'JPY',
      availability: 'https://schema.org/InStock',
    },
    featureList: [
      '日記インポート（テキスト・Markdown・JSON対応、自動日付認識）',
      'ランダム再会（他人モード・未来からの報告機能付き）',
      'この日の記録（年をまたいだ同じ日の振り返り）',
      'キーワード全文検索（日付範囲絞り込み・ソート対応）',
      'カレンダーヒートマップ（記録密度の可視化）',
      '成長タイムライン（ローカル感情分析・トレンド検出・レジリエンス指標）',
      'ワードクラウド（語彙傾向の可視化）',
      'AI分析3種類（今日・急所・外基準の統合 ― OpenAI API連携）',
      '観測所（やさしい問いかけジャーナリング）',
      '宝物庫（お気に入りの一文を保存）',
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
    description: '日記やメモの管理・分析・可視化ができるプライバシーファーストな無料ウェブアプリ。アカウント登録不要、データは端末内のみ保存。PWAでオフライン対応。',
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
    keywords: '日記管理,ナレッジ分析,AI分析,感情分析,ワードクラウド,カレンダー,PWA,オフライン',
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
    name: '登山ログの使い方 ― 日記を取り込んで振り返る3ステップ',
    description: '登山ログで日記をインポートし、検索・分析・可視化で過去の自分と再会する方法を3ステップで解説します。',
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
        name: '好きな方法で読み返す',
        text: 'ランダム表示で偶然の再会を楽しむ、「この日」で年をまたいだ振り返りをする、キーワード検索であの日の言葉を探す、カレンダーで記録の密度を一望するなど、多彩な方法で日記を読み返せます。',
        url: `${BASE_URL}/random`,
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: '可視化・分析で新たな気づきを得る',
        text: 'タイムラインで感情の推移を追う、ワードクラウドで語彙の傾向を把握する、AI分析（3種類）で客観的な視点を得る。日記が自己分析ツールになります。',
        url: `${BASE_URL}/timeline`,
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
          text: '登山ログは、個人の日記やメモを管理・分析するためのウェブアプリケーションです。「登山」は自分を高めるという意味の比喩で、実際の登山記録アプリではありません。テキストやMarkdownファイルをインポートし、検索・分析・可視化など様々な方法で過去の記録を振り返ることができます。無料で利用でき、アカウント登録も不要です。',
        },
      },
      {
        '@type': 'Question',
        name: 'データはどこに保存されますか？',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'すべてのデータはお使いの端末のブラウザ内（IndexedDB）に保存されます。外部サーバーへの送信はありません。AI分析機能を使用する場合のみ、ユーザー自身のAPIキーでOpenAI APIと通信します。Cookie・トラッキングも一切使用しません。',
        },
      },
      {
        '@type': 'Question',
        name: '無料で使えますか？',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'はい、登山ログは完全無料でご利用いただけます。アカウント登録も不要です。AI分析機能を利用する場合のみ、ユーザー自身でOpenAI APIキーを取得する必要があり、APIの利用料金が別途発生します。',
        },
      },
      {
        '@type': 'Question',
        name: 'オフラインでも使えますか？',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'はい、PWA（Progressive Web App）に対応しているため、一度アクセスした後はオフラインでもご利用いただけます。日記の閲覧・検索・ワードクラウドなどすべての基本機能がオフラインで動作します。AI分析機能のみインターネット接続が必要です。',
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
          text: '「今日」「急所」「外基準の統合」の3種類の深層分析に対応しています。「今日」は友人視点で今日の日記だけを深く読む分析、「急所」は直近1週間から本質を突く指摘、「外基準の統合」は内側を守ったまま外基準を武器に変えているかを診る分析です。ユーザー自身のOpenAI APIキーを使用するため、データがサービス提供者に渡ることはありません。',
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
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
