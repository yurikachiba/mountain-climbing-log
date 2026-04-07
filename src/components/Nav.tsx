import { useState, useCallback, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const links = [
  { to: '/', label: 'トップ' },
  { to: '/timeline', label: 'タイムライン' },
  { to: '/fragments', label: '宝物庫' },
  { to: '/import', label: 'インポート' },
  { to: '/analysis', label: 'AI分析' },
  { to: '/ai-logs', label: 'AIログ' },
  { to: '/settings', label: '設定' },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // ページ遷移時にメニューを閉じる
  useEffect(() => {
    setOpen(false); // eslint-disable-line react-hooks/set-state-in-effect -- パス変更時のメニュー閉じ
  }, [location.pathname]);

  const toggle = useCallback(() => {
    setOpen(prev => !prev);
  }, []);

  return (
    <nav className="nav" aria-label="メインナビゲーション">
      <div className="nav-bar">
        <NavLink to="/" className="nav-brand">登山ログ</NavLink>
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
