import { useState, useEffect } from 'react';
import type { Fragment } from '../types';
import { getAllFragments, deleteFragment } from '../db';

export function Fragments() {
  const [fragments, setFragments] = useState<Fragment[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const all = await getAllFragments();
    setFragments(all.reverse()); // 新しい順
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: string) {
    await deleteFragment(id);
    setFragments(prev => prev.filter(f => f.id !== id));
  }

  if (loading) return <div className="page"><p className="loading-text">読み込み中...</p></div>;

  return (
    <div className="page">
      <h1 className="page-title">宝物庫</h1>
      <p className="subtitle">光ってる文だけ集めたページ</p>

      {fragments.length === 0 ? (
        <p className="empty-message">まだ何も保存されていません</p>
      ) : (
        <div className="fragments-list">
          {fragments.map(f => (
            <div key={f.id} className="fragment-card">
              <p className="fragment-text">{f.text}</p>
              <div className="fragment-meta">
                <span className="fragment-date">
                  {new Date(f.savedAt).toLocaleDateString('ja-JP')}
                </span>
                <button
                  onClick={() => handleDelete(f.id)}
                  className="btn btn-danger btn-small"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
