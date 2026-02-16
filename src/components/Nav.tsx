import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'ホーム' },
  { to: '/import', label: 'インポート' },
  { to: '/random', label: 'ランダム' },
  { to: '/fragments', label: '宝物庫' },
  { to: '/timeline', label: 'タイムライン' },
  { to: '/analysis', label: 'AI分析' },
  { to: '/settings', label: '設定' },
];

export function Nav() {
  return (
    <nav className="nav">
      {links.map(link => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
