import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-links">
          <Link to="/privacy" className="footer-link">プライバシーポリシー</Link>
          <Link to="/terms" className="footer-link">利用規約</Link>
          <Link to="/sitemap" className="footer-link">サイトマップ</Link>
        </div>
        <p className="footer-copy">&copy; 2026 登山ログ</p>
      </div>
    </footer>
  );
}
