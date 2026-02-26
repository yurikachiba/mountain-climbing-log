import { useState, useMemo, useCallback } from 'react';
import { useEntries } from '../hooks/useEntries';
import { useHead } from '../hooks/useHead';
import type { DiaryEntry } from '../types';

interface YearGroup {
  year: string;
  entries: DiaryEntry[];
}

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function OnThisDay() {
  const { entries, loading } = useEntries();

  useHead({
    title: 'この日の記録',
    description: '1年前、3年前、5年前 ― 同じ月日の日記を年をまたいで読み返す機能。時間を縦に貫いて、自分の変化や成長を感じられます。月日を自由に選んで過去のどの日でも振り返り可能。',
    keywords: 'この日の日記,過去の同じ日,年またぎ振り返り,日記比較,成長記録',
    path: '/onthisday',
  });
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = useCallback(async (entry: DiaryEntry) => {
    const parts: string[] = [];
    if (entry.date) parts.push(entry.date);
    parts.push(entry.content);
    if (entry.comments.length > 0) {
      parts.push('未来からの報告:\n' + entry.comments.map(c => c.text).join('\n'));
    }
    try {
      await navigator.clipboard.writeText(parts.join('\n'));
      setCopiedId(entry.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { /* ignore */ }
  }, []);

  const maxDay = DAYS_IN_MONTH[selectedMonth - 1] ?? 31;
  const day = Math.min(selectedDay, maxDay);

  const monthDay = `${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const yearGroups = useMemo(() => {
    if (!monthDay) return [];
    const groups = new Map<string, DiaryEntry[]>();

    for (const entry of entries) {
      if (!entry.date) continue;
      const entryMD = entry.date.substring(5, 10); // MM-DD
      if (entryMD === monthDay) {
        const year = entry.date.substring(0, 4);
        const existing = groups.get(year) ?? [];
        existing.push(entry);
        groups.set(year, existing);
      }
    }

    const result: YearGroup[] = [];
    for (const [year, yearEntries] of groups) {
      result.push({ year, entries: yearEntries });
    }
    return result.sort((a, b) => b.year.localeCompare(a.year));
  }, [entries, monthDay]);

  const displayLabel = `${selectedMonth}月${day}日`;

  const yearsAgo = (year: string) => {
    const diff = new Date().getFullYear() - parseInt(year);
    if (diff === 0) return '今年';
    return `${diff}年前`;
  };

  if (loading) return <div className="page"><p className="loading-text">読み込み中...</p></div>;

  return (
    <div className="page">
      <h1 className="page-title">この日の記録</h1>
      <p className="subtitle">同じ月日の日記を、年をまたいで読む</p>

      <div className="onthisday-picker">
        <label className="onthisday-label">月日を選ぶ:</label>
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(Number(e.target.value))}
          className="custom-select"
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>{i + 1}月</option>
          ))}
        </select>
        <select
          value={day}
          onChange={e => setSelectedDay(Number(e.target.value))}
          className="custom-select"
        >
          {Array.from({ length: maxDay }, (_, i) => (
            <option key={i + 1} value={i + 1}>{i + 1}日</option>
          ))}
        </select>
        <span className="onthisday-display">{displayLabel}</span>
      </div>

      {entries.length === 0 ? (
        <p className="empty-message">日記をインポートすると表示されます</p>
      ) : yearGroups.length === 0 ? (
        <div className="onthisday-empty">
          <p className="empty-message">{displayLabel}の日記はありません</p>
          <p className="hint">別の日付を選んでみてください</p>
        </div>
      ) : (
        <div className="onthisday-list">
          <p className="onthisday-count">
            {displayLabel}の日記: {yearGroups.length}年分
          </p>
          {yearGroups.map(group => (
            <div key={group.year} className="onthisday-year">
              <div className="onthisday-year-header">
                <span className="onthisday-year-label">{group.year}年</span>
                <span className="onthisday-years-ago">{yearsAgo(group.year)}</span>
              </div>
              {group.entries.map(entry => (
                <div key={entry.id} className="entry-card">
                  <div className="entry-content">
                    {entry.content.split('\n').map((line, i) => (
                      <p key={i}>{line || '\u00A0'}</p>
                    ))}
                  </div>
                  {entry.comments.length > 0 && (
                    <div className="comments-section">
                      <p className="comments-label">未来からの報告:</p>
                      {entry.comments.map(c => (
                        <p key={c.id} className="comment-text">{c.text}</p>
                      ))}
                    </div>
                  )}
                  <div className="entry-actions">
                    <button onClick={() => handleCopy(entry)} className="btn btn-small">
                      {copiedId === entry.id ? 'コピーしました' : 'コピー'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
