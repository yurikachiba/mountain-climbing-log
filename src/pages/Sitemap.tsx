import { Link } from 'react-router-dom';
import { useHead } from '../hooks/useHead';

const pages = [
  {
    category: 'メイン',
    items: [
      { to: '/', label: 'トップ', desc: 'ランディングページ・アプリの紹介' },
      { to: '/import', label: 'インポート', desc: '日記ファイルの取り込み・直接入力' },
    ],
  },
  {
    category: '分析・可視化',
    items: [
      { to: '/analysis', label: 'AI分析', desc: 'Claude APIによる7種類の深層分析' },
      { to: '/ai-logs', label: 'AI分析ログ', desc: '過去のAI分析結果の閲覧' },
      { to: '/timeline', label: 'タイムライン', desc: '感情分析グラフ・トレンド検出' },
      { to: '/fragments', label: '宝物庫', desc: 'AIが日記から光る一文を自動収集' },
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
  useHead({
    title: 'サイトマップ',
    description: '登山ログの全ページ一覧。インポート、AI分析、タイムライン、宝物庫など全ページへの導線を確認できます。',
    keywords: 'サイトマップ,ページ一覧,機能一覧',
    path: '/sitemap',
  });

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
