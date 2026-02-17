import { Link } from 'react-router-dom';

const pages = [
  {
    category: 'メイン',
    items: [
      { to: '/', label: 'トップ', desc: 'ランディングページ・アプリの紹介' },
      { to: '/home', label: 'ホーム', desc: 'ダッシュボード・記録数の表示' },
      { to: '/import', label: 'インポート', desc: '日記ファイルの取り込み' },
    ],
  },
  {
    category: '日記を読む',
    items: [
      { to: '/random', label: 'ランダム', desc: 'ランダムな日記を表示' },
      { to: '/onthisday', label: 'この日', desc: '過去の同じ日の日記を振り返る' },
      { to: '/search', label: '検索', desc: 'キーワード・日付で日記を検索' },
      { to: '/calendar', label: 'カレンダー', desc: 'カレンダー形式で日記を閲覧' },
      { to: '/fragments', label: '宝物庫', desc: '保存したテキスト断片の一覧' },
    ],
  },
  {
    category: '分析・可視化',
    items: [
      { to: '/timeline', label: 'タイムライン', desc: '時系列グラフによる記録の推移' },
      { to: '/wordcloud', label: 'ワード', desc: '頻出語のワードクラウド表示' },
      { to: '/analysis', label: 'AI分析', desc: 'OpenAI APIによる日記の分析' },
    ],
  },
  {
    category: '設定・情報',
    items: [
      { to: '/settings', label: '設定', desc: 'データ管理・APIキー設定' },
      { to: '/privacy', label: 'プライバシーポリシー', desc: '個人情報の取り扱いについて' },
      { to: '/terms', label: '利用規約', desc: '本アプリの利用条件' },
    ],
  },
];

export function Sitemap() {
  return (
    <div className="page">
      <h1 className="page-title">サイトマップ</h1>
      <p className="subtitle">登山ログの全ページ一覧</p>

      <div className="sitemap-list">
        {pages.map(group => (
          <section key={group.category} className="sitemap-group">
            <h2 className="sitemap-category">{group.category}</h2>
            <ul className="sitemap-items">
              {group.items.map(item => (
                <li key={item.to} className="sitemap-item">
                  <Link to={item.to} className="sitemap-link">
                    <span className="sitemap-label">{item.label}</span>
                    <span className="sitemap-desc">{item.desc}</span>
                    <span className="sitemap-url">https://mountain-climbing-log.com{item.to}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
