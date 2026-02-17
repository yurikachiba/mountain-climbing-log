import { useState, useMemo } from 'react';
import { useEntries } from '../hooks/useEntries';
import type { DiaryEntry } from '../types';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export function Calendar() {
  const { entries, loading } = useEntries();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedEntries, setSelectedEntries] = useState<DiaryEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // 月ごとの日記マップ
  const entryMap = useMemo(() => {
    const map = new Map<string, DiaryEntry[]>();
    for (const entry of entries) {
      if (!entry.date) continue;
      const existing = map.get(entry.date) ?? [];
      existing.push(entry);
      map.set(entry.date, existing);
    }
    return map;
  }, [entries]);

  // カレンダーグリッド生成
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: (number | null)[] = [];
    for (let i = 0; i < startPad; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) days.push(d);
    // 末尾パディング
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [year, month]);

  const navigate = (dir: -1 | 1) => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + dir, 1));
    setSelectedEntries([]);
    setSelectedDate(null);
  };

  const handleDayClick = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEntries = entryMap.get(dateStr) ?? [];
    setSelectedEntries(dayEntries);
    setSelectedDate(dateStr);
  };

  // この月の統計
  const monthStats = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    let count = 0;
    for (const [date, dayEntries] of entryMap) {
      if (date.startsWith(prefix)) count += dayEntries.length;
    }
    return count;
  }, [entryMap, year, month]);

  // 年全体のヒートマップ用データ
  const yearMonthCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const [date, dayEntries] of entryMap) {
      const ym = date.substring(0, 7);
      counts.set(ym, (counts.get(ym) ?? 0) + dayEntries.length);
    }
    return counts;
  }, [entryMap]);

  // 全年分のリスト
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const entry of entries) {
      if (entry.date) years.add(parseInt(entry.date.substring(0, 4)));
    }
    return [...years].sort((a, b) => a - b);
  }, [entries]);

  if (loading) return <div className="page"><p className="loading-text">読み込み中...</p></div>;

  return (
    <div className="page">
      <h1 className="page-title">カレンダー</h1>
      <p className="subtitle">記録のある日を見わたす</p>

      {entries.length === 0 ? (
        <p className="empty-message">日記をインポートすると表示されます</p>
      ) : (
        <>
          {/* 年の概要 */}
          <div className="calendar-year-overview">
            <p className="calendar-year-title">{year}年の記録密度</p>
            <div className="calendar-year-months">
              {Array.from({ length: 12 }, (_, i) => {
                const ym = `${year}-${String(i + 1).padStart(2, '0')}`;
                const count = yearMonthCounts.get(ym) ?? 0;
                const intensity = count === 0 ? 0 : Math.min(count / 10, 1);
                return (
                  <button
                    key={i}
                    className={`calendar-month-cell ${month === i ? 'current' : ''}`}
                    style={{
                      backgroundColor: count > 0
                        ? `rgba(51, 51, 51, ${0.1 + intensity * 0.6})`
                        : undefined,
                      color: intensity > 0.4 ? '#fff' : undefined,
                    }}
                    onClick={() => setCurrentDate(new Date(year, i, 1))}
                  >
                    <span className="calendar-month-label">{i + 1}月</span>
                    {count > 0 && <span className="calendar-month-count">{count}</span>}
                  </button>
                );
              })}
            </div>
            {availableYears.length > 1 && (
              <div className="calendar-year-nav">
                {availableYears.map(y => (
                  <button
                    key={y}
                    className={`btn btn-small ${y === year ? 'btn-primary' : ''}`}
                    onClick={() => setCurrentDate(new Date(y, month, 1))}
                  >
                    {y}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 月カレンダー */}
          <div className="calendar-nav">
            <button onClick={() => navigate(-1)} className="btn btn-small">&lt;</button>
            <span className="calendar-current">{year}年{month + 1}月</span>
            <button onClick={() => navigate(1)} className="btn btn-small">&gt;</button>
            <span className="calendar-month-stat">{monthStats}件</span>
          </div>

          <div className="calendar-grid">
            {WEEKDAYS.map(d => (
              <div key={d} className="calendar-weekday">{d}</div>
            ))}
            {calendarDays.map((day, i) => {
              if (day === null) return <div key={i} className="calendar-cell empty" />;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const count = entryMap.get(dateStr)?.length ?? 0;
              const isSelected = dateStr === selectedDate;
              return (
                <button
                  key={i}
                  className={`calendar-cell ${count > 0 ? 'has-entry' : ''} ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleDayClick(day)}
                >
                  <span className="calendar-day-num">{day}</span>
                  {count > 0 && <span className="calendar-dot" />}
                </button>
              );
            })}
          </div>

          {/* 選択した日のエントリ */}
          {selectedDate && (
            <div className="calendar-detail">
              <h2 className="calendar-detail-title">{selectedDate}</h2>
              {selectedEntries.length === 0 ? (
                <p className="hint">この日の日記はありません</p>
              ) : (
                selectedEntries.map(entry => (
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
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
