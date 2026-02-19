import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useEntries } from '../hooks/useEntries';
import { useHead } from '../hooks/useHead';
import { getAllFragments, getRandomEntry } from '../db';
import type { DiaryEntry, Fragment } from '../types';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '...';
}

export function Home() {
  const { entries, count, loading } = useEntries();
  const [fragments, setFragments] = useState<Fragment[]>([]);
  const [randomEntry, setRandomEntry] = useState<DiaryEntry | null>(null);

  useHead({
    title: 'ダッシュボード',
    description: '登山ログのダッシュボード。インポートした日記やメモの総件数を確認できます。ここから検索、ランダム表示、カレンダー、AI分析など各機能へアクセス。',
    keywords: '日記ダッシュボード,日記管理,日記件数',
    path: '/home',
  });

  useEffect(() => {
    getAllFragments().then(setFragments);
  }, []);

  useEffect(() => {
    if (!loading && count > 0) {
      getRandomEntry().then(e => setRandomEntry(e ?? null));
    }
  }, [loading, count]);

  const handleNewRandom = useCallback(async () => {
    const e = await getRandomEntry();
    setRandomEntry(e ?? null);
  }, []);

  // 統計データ
  const stats = useMemo(() => {
    if (entries.length === 0) return null;
    const dated = entries.filter(e => e.date);
    const sorted = dated.sort((a, b) => (a.date! > b.date! ? 1 : -1));
    const oldest = sorted[0]?.date ?? null;
    const newest = sorted[sorted.length - 1]?.date ?? null;
    const favorites = entries.filter(e => e.isFavorite).length;

    let spanYears = 0;
    if (oldest && newest) {
      const diff = new Date(newest).getTime() - new Date(oldest).getTime();
      spanYears = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
    }

    return { oldest, newest, favorites, spanYears };
  }, [entries]);

  // 今日と同じ月日の過去記録
  const onThisDayEntries = useMemo(() => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const suffix = `-${mm}-${dd}`;
    const thisYear = String(now.getFullYear());
    return entries
      .filter(e => e.date && e.date.endsWith(suffix) && !e.date.startsWith(thisYear))
      .sort((a, b) => (a.date! > b.date! ? -1 : 1));
  }, [entries]);

  if (loading) {
    return (
      <div className="page">
        <h1 className="page-title">登山ログ</h1>
        <p className="subtitle">未来から過去へロープを垂らす装置</p>
        <div className="stats-card">
          <p className="loading-text">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (count === 0) {
    return (
      <div className="page">
        <h1 className="page-title">登山ログ</h1>
        <p className="subtitle">未来から過去へロープを垂らす装置</p>
        <div className="stats-card">
          <p className="empty-message">まだ日記がありません</p>
          <p className="hint">「インポート」から日記を取り込んでください</p>
        </div>
        <div className="home-empty-cta">
          <Link to="/import" className="btn btn-primary">インポートする</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">登山ログ</h1>
      <p className="subtitle">未来から過去へロープを垂らす装置</p>

      {/* 統計グリッド */}
      <div className="home-stats-grid">
        <div className="home-stat-item">
          <span className="home-stat-value">{count}</span>
          <span className="home-stat-label">件の記録</span>
        </div>
        {stats && stats.spanYears > 0 && (
          <div className="home-stat-item">
            <span className="home-stat-value">{stats.spanYears}</span>
            <span className="home-stat-label">年分の軌跡</span>
          </div>
        )}
        {stats && stats.favorites > 0 && (
          <div className="home-stat-item">
            <span className="home-stat-value">{stats.favorites}</span>
            <span className="home-stat-label">お気に入り</span>
          </div>
        )}
        {fragments.length > 0 && (
          <div className="home-stat-item">
            <span className="home-stat-value">{fragments.length}</span>
            <span className="home-stat-label">宝物</span>
          </div>
        )}
      </div>

      {stats && stats.oldest && stats.newest && (
        <p className="home-date-range">
          {formatDate(stats.oldest)} — {formatDate(stats.newest)}
        </p>
      )}

      {/* 今日の一篇 */}
      {randomEntry && (
        <section className="home-section">
          <div className="home-section-header">
            <h2 className="home-section-title">今日の一篇</h2>
            <button className="btn btn-small" onClick={handleNewRandom}>別の記録</button>
          </div>
          <div className="home-encounter-card">
            {randomEntry.date && (
              <p className="entry-date">{formatDate(randomEntry.date)}</p>
            )}
            <p className="home-encounter-text">
              {truncate(randomEntry.content, 280)}
            </p>
            <Link to={`/random`} className="home-encounter-link">
              ランダムで読み返す
            </Link>
          </div>
        </section>
      )}

      {/* この日の記録 */}
      {onThisDayEntries.length > 0 && (
        <section className="home-section">
          <div className="home-section-header">
            <h2 className="home-section-title">
              {new Date().getMonth() + 1}月{new Date().getDate()}日の記録
            </h2>
            <Link to="/onthisday" className="btn btn-small">すべて見る</Link>
          </div>
          <div className="home-onthisday-list">
            {onThisDayEntries.slice(0, 3).map(entry => (
              <div key={entry.id} className="home-onthisday-item">
                <span className="home-onthisday-year">
                  {entry.date ? entry.date.slice(0, 4) : ''}
                </span>
                <p className="home-onthisday-text">
                  {truncate(entry.content, 120)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* クイックナビ */}
      <section className="home-section">
        <h2 className="home-section-title">探索する</h2>
        <div className="home-nav-grid">
          <Link to="/random" className="home-nav-card">
            <span className="home-nav-label">ランダム</span>
            <span className="home-nav-desc">偶然の再会</span>
          </Link>
          <Link to="/onthisday" className="home-nav-card">
            <span className="home-nav-label">この日</span>
            <span className="home-nav-desc">時を縦に貫く</span>
          </Link>
          <Link to="/search" className="home-nav-card">
            <span className="home-nav-label">検索</span>
            <span className="home-nav-desc">言葉で辿る</span>
          </Link>
          <Link to="/calendar" className="home-nav-card">
            <span className="home-nav-label">カレンダー</span>
            <span className="home-nav-desc">日々の地図</span>
          </Link>
          <Link to="/fragments" className="home-nav-card">
            <span className="home-nav-label">宝物庫</span>
            <span className="home-nav-desc">大切な断片</span>
          </Link>
          <Link to="/analysis" className="home-nav-card">
            <span className="home-nav-label">AI分析</span>
            <span className="home-nav-desc">俯瞰する</span>
          </Link>
          <Link to="/observatory" className="home-nav-card">
            <span className="home-nav-label">観測所</span>
            <span className="home-nav-desc">やさしく記録</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
