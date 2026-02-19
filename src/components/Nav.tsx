import { useState, useCallback, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const links = [
  { to: '/', label: 'トップ' },
  { to: '/home', label: 'ホーム' },
  { to: '/import', label: 'インポート' },
  { to: '/random', label: 'ランダム' },
  { to: '/onthisday', label: 'この日' },
  { to: '/search', label: '検索' },
  { to: '/calendar', label: 'カレンダー' },
  { to: '/fragments', label: '宝物庫' },
  { to: '/timeline', label: 'タイムライン' },
  { to: '/wordcloud', label: 'ワード' },
  { to: '/analysis', label: 'AI分析' },
  { to: '/ai-logs', label: 'AIログ' },
  { to: '/observatory', label: '観測所' },
  { to: '/settings', label: '設定' },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // ページ遷移時にメニューを閉じる
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const toggle = useCallback(() => {
    setOpen(prev => !prev);
  }, []);

  return (
    <nav className="nav" aria-label="メインナビゲーション">
      <div className="nav-bar">
        <NavLink to="/home" className="nav-brand">登山ログ</NavLink>
        <button
          className="nav-toggle"
          onClick={toggle}
          aria-expanded={open}
          aria-label="メニューを開く"
          type="button"
        >
          <span className={`nav-hamburger ${open ? 'open' : ''}`} />
        </button>
      </div>
      {open && (
        <div className="nav-menu">
          {links.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => isActive ? 'nav-menu-link active' : 'nav-menu-link'}
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      )}
    </nav>
  );
}
