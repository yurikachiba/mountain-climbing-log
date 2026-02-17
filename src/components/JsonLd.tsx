const BASE_URL = 'https://mountain-climbing-log.com';

export function WebSiteJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: '登山ログ',
    alternateName: 'Mountain Climbing Log',
    url: BASE_URL,
    description: '日記を取り込んで、過去の自分と再会する。検索、分析、可視化。静かに振り返るためのプライバシーファーストな日記管理ツール。',
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
    description: '日記を取り込んで、過去の自分と再会するためのウェブアプリケーション。検索、分析、可視化機能を備えたプライバシーファーストな日記管理ツール。',
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'All',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'JPY',
    },
    featureList: [
      '日記インポート（テキスト・Markdown対応）',
      'ランダム日記表示',
      '過去の同じ日の振り返り',
      'キーワード全文検索',
      'カレンダーヒートマップ表示',
      'ワードクラウド可視化',
      'タイムライン・感情分析グラフ',
      'AI分析（OpenAI API連携）',
      'オフライン対応（PWA）',
    ],
    browserRequirements: 'Requires JavaScript. Requires HTML5.',
    inLanguage: 'ja',
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
          text: '登山ログは、個人の日記・登山記録を管理するためのウェブアプリケーションです。テキストやMarkdownファイルをインポートし、検索、分析、可視化など様々な方法で過去の記録を振り返ることができます。',
        },
      },
      {
        '@type': 'Question',
        name: 'データはどこに保存されますか？',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'すべてのデータはお使いの端末のブラウザ内（IndexedDB）に保存されます。外部サーバーへの送信はありません。AI分析機能を使用する場合のみ、ユーザー自身のAPIキーでOpenAI APIと通信します。',
        },
      },
      {
        '@type': 'Question',
        name: '無料で使えますか？',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'はい、登山ログは無料でご利用いただけます。AI分析機能を利用する場合のみ、ユーザー自身でOpenAI APIキーを取得する必要があり、APIの利用料金が別途発生します。',
        },
      },
      {
        '@type': 'Question',
        name: 'オフラインでも使えますか？',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'はい、PWA（Progressive Web App）に対応しているため、一度アクセスした後はオフラインでもご利用いただけます。AI分析機能のみインターネット接続が必要です。',
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
