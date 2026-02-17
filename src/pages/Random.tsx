import { useState, useCallback } from 'react';
import type { DiaryEntry, FutureComment } from '../types';
import { getRandomEntry, updateEntry, addFragment } from '../db';
import { anonymize } from '../utils/emotionAnalyzer';
import { useHead } from '../hooks/useHead';

export function Random() {
  useHead({
    title: 'ランダム過去',
    description: '過去の日記にランダムで再会。忘れていた日の自分と出会い直す機能。',
    path: '/random',
  });
  const [entry, setEntry] = useState<DiaryEntry | null>(null);
  const [showDate, setShowDate] = useState(false);
  const [strangerMode, setStrangerMode] = useState(true);
  const [comment, setComment] = useState('');
  const [saved, setSaved] = useState(false);
  const [empty, setEmpty] = useState(false);

  const draw = useCallback(async () => {
    const e = await getRandomEntry();
    if (!e) {
      setEmpty(true);
      return;
    }
    setEntry(e);
    setComment('');
    setSaved(false);
    setEmpty(false);
  }, []);

  async function handleComment() {
    if (!entry || !comment.trim()) return;
    const newComment: FutureComment = {
      id: crypto.randomUUID(),
      text: comment.trim().slice(0, 140),
      createdAt: new Date().toISOString(),
    };
    const updated = {
      ...entry,
      comments: [...entry.comments, newComment],
    };
    await updateEntry(updated);
    setEntry(updated);
    setComment('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleSaveFragment() {
    if (!entry) return;
    // テキスト選択があればそれを保存、なければ全文
    const selection = window.getSelection()?.toString().trim();
    const text = selection || entry.content.slice(0, 500);
    await addFragment({
      id: crypto.randomUUID(),
      entryId: entry.id,
      text,
      savedAt: new Date().toISOString(),
    });
    // フラグも立てる
    if (!entry.isFavorite) {
      const updated = { ...entry, isFavorite: true };
      await updateEntry(updated);
      setEntry(updated);
    }
  }

  const displayContent = entry
    ? strangerMode
      ? anonymize(entry.content)
      : entry.content
    : '';

  return (
    <div className="page">
      <h1 className="page-title">ランダム過去</h1>

      <div className="controls">
        <button onClick={draw} className="btn btn-primary">
          一件引く
        </button>
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={showDate}
            onChange={e => setShowDate(e.target.checked)}
          />
          日付を表示
        </label>
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={strangerMode}
            onChange={e => setStrangerMode(e.target.checked)}
          />
          他人モード
        </label>
      </div>

      {empty && <p className="empty-message">日記がありません。先にインポートしてください。</p>}

      {entry && (
        <div className="entry-card">
          {showDate && entry.date && (
            <p className="entry-date">{entry.date}</p>
          )}
          <div className="entry-content">
            {displayContent.split('\n').map((line, i) => (
              <p key={i}>{line || '\u00A0'}</p>
            ))}
          </div>

          <div className="entry-actions">
            <button onClick={handleSaveFragment} className="btn btn-small">
              宝物庫に保存
            </button>
          </div>

          {/* 既存コメント表示 */}
          {entry.comments.length > 0 && (
            <div className="comments-section">
              <p className="comments-label">未来からの報告:</p>
              {entry.comments.map(c => (
                <p key={c.id} className="comment-text">
                  {c.text}
                </p>
              ))}
            </div>
          )}

          {/* コメント入力 */}
          <div className="comment-input-area">
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value.slice(0, 140))}
              placeholder="未来からの一行（140字以内）"
              maxLength={140}
              rows={2}
              className="comment-input"
            />
            <div className="comment-footer">
              <span className="char-count">{comment.length}/140</span>
              <button
                onClick={handleComment}
                disabled={!comment.trim()}
                className="btn btn-small"
              >
                報告する
              </button>
            </div>
            {saved && <p className="saved-notice">保存しました</p>}
          </div>
        </div>
      )}
    </div>
  );
}
