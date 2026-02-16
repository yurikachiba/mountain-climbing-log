import { useEntries } from '../hooks/useEntries';

export function Home() {
  const { count, loading } = useEntries();

  return (
    <div className="page">
      <h1 className="page-title">登山ログ</h1>
      <p className="subtitle">未来から過去へロープを垂らす装置</p>

      <div className="stats-card">
        {loading ? (
          <p className="loading-text">読み込み中...</p>
        ) : count === 0 ? (
          <div>
            <p className="empty-message">まだ日記がありません</p>
            <p className="hint">「インポート」から日記を取り込んでください</p>
          </div>
        ) : (
          <div>
            <p className="count">{count}</p>
            <p className="count-label">件の記録</p>
          </div>
        )}
      </div>
    </div>
  );
}
