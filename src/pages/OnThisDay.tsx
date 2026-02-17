import { useState, useMemo } from 'react';
import { useEntries } from '../hooks/useEntries';
import type { DiaryEntry } from '../types';
import { format, parse } from 'date-fns';
import { ja } from 'date-fns/locale';

interface YearGroup {
  year: string;
  entries: DiaryEntry[];
}

export function OnThisDay() {
  const { entries, loading } = useEntries();
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });

  const monthDay = selectedDate; // MM-DD

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

  const displayLabel = useMemo(() => {
    try {
      const date = parse(monthDay, 'MM-dd', new Date());
      return format(date, 'M月d日', { locale: ja });
    } catch {
      return monthDay;
    }
  }, [monthDay]);

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
        <label className="onthisday-label">日付を選ぶ:</label>
        <input
          type="date"
          value={`2000-${monthDay}`}
          onChange={e => {
            const val = e.target.value;
            if (val) setSelectedDate(val.substring(5, 10));
          }}
          className="onthisday-input"
        />
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
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
