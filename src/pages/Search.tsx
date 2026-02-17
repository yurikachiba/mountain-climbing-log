import { useState, useMemo, useCallback } from 'react';
import { useEntries } from '../hooks/useEntries';
import { useHead } from '../hooks/useHead';

export function Search() {
  const { entries, loading } = useEntries();

  useHead({
    title: '検索',
    description: '日記のキーワード全文検索。日付範囲やソート順での絞り込みに対応。',
    path: '/search',
  });
  const [keyword, setKeyword] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [sortOrder, setSortOrder] = useState<'new' | 'old'>('new');

  const results = useMemo(() => {
    let filtered = [...entries];

    // キーワードフィルター
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      filtered = filtered.filter(e =>
        e.content.toLowerCase().includes(kw) ||
        e.comments.some(c => c.text.toLowerCase().includes(kw))
      );
    }

    // 日付範囲フィルター
    if (dateFrom) {
      filtered = filtered.filter(e => e.date && e.date >= dateFrom);
    }
    if (dateTo) {
      filtered = filtered.filter(e => e.date && e.date <= dateTo);
    }

    // ソート
    filtered.sort((a, b) => {
      const dateA = a.date ?? '';
      const dateB = b.date ?? '';
      return sortOrder === 'new'
        ? dateB.localeCompare(dateA)
        : dateA.localeCompare(dateB);
    });

    return filtered;
  }, [entries, keyword, dateFrom, dateTo, sortOrder]);

  const highlightText = useCallback((text: string) => {
    if (!keyword.trim()) return text;
    const kw = keyword.trim();
    const regex = new RegExp(`(${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part)
        ? <mark key={i} className="search-highlight">{part}</mark>
        : part
    );
  }, [keyword]);

  const hasFilter = keyword.trim() || dateFrom || dateTo;

  if (loading) return <div className="page"><p className="loading-text">読み込み中...</p></div>;

  return (
    <div className="page">
      <h1 className="page-title">検索</h1>
      <p className="subtitle">過去の記録を探す</p>

      <div className="search-controls">
        <div className="search-bar">
          <input
            type="text"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder="キーワードで検索..."
            className="search-input"
          />
        </div>

        <div className="search-filters">
          <div className="search-date-range">
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="search-date-input"
              placeholder="開始日"
            />
            <span className="search-date-sep">〜</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="search-date-input"
              placeholder="終了日"
            />
          </div>

          <div className="search-options">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={showComments}
                onChange={e => setShowComments(e.target.checked)}
              />
              コメントも表示
            </label>
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value as 'new' | 'old')}
              className="custom-select"
            >
              <option value="new">新しい順</option>
              <option value="old">古い順</option>
            </select>
          </div>
        </div>

        {hasFilter && (
          <button
            onClick={() => { setKeyword(''); setDateFrom(''); setDateTo(''); }}
            className="btn btn-small"
          >
            フィルターをクリア
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="empty-message">日記をインポートすると検索できます</p>
      ) : (
        <div className="search-results">
          <p className="search-result-count">
            {hasFilter ? `${results.length}件 / ${entries.length}件` : `全${entries.length}件`}
          </p>

          {results.slice(0, 50).map(entry => (
            <div key={entry.id} className="entry-card">
              {entry.date && (
                <p className="entry-date">{entry.date}</p>
              )}
              <div className="entry-content search-entry-content">
                {entry.content.split('\n').slice(0, 8).map((line, i) => (
                  <p key={i}>{highlightText(line) || '\u00A0'}</p>
                ))}
                {entry.content.split('\n').length > 8 && (
                  <p className="search-truncated">…</p>
                )}
              </div>
              {showComments && entry.comments.length > 0 && (
                <div className="comments-section">
                  <p className="comments-label">未来からの報告:</p>
                  {entry.comments.map(c => (
                    <p key={c.id} className="comment-text">{highlightText(c.text)}</p>
                  ))}
                </div>
              )}
            </div>
          ))}

          {results.length > 50 && (
            <p className="hint">最初の50件を表示しています（全{results.length}件）</p>
          )}
        </div>
      )}
    </div>
  );
}
