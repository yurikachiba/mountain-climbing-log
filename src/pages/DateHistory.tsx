import { useState, useMemo, useCallback } from 'react';
import { useEntries } from '../hooks/useEntries';
import { useHead } from '../hooks/useHead';
import type { DiaryEntry } from '../types';

interface TimeSlot {
  label: string;
  sublabel: string;
  date: string; // YYYY-MM-DD
  entries: DiaryEntry[];
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

function addYears(d: Date, n: number): Date {
  const r = new Date(d);
  r.setFullYear(r.getFullYear() + n);
  return r;
}

function buildTimeSlots(base: Date): { label: string; sublabel: string; date: string }[] {
  const slots: { label: string; sublabel: string; date: string }[] = [];

  // 今日
  slots.push({ label: '今日', sublabel: formatDate(base), date: formatDate(base) });

  // 昨日
  const yesterday = addDays(base, -1);
  slots.push({ label: '1日前', sublabel: formatDate(yesterday), date: formatDate(yesterday) });

  // 3日前
  const threeDaysAgo = addDays(base, -3);
  slots.push({ label: '3日前', sublabel: formatDate(threeDaysAgo), date: formatDate(threeDaysAgo) });

  // 1週間前
  const weekAgo = addDays(base, -7);
  slots.push({ label: '1週間前', sublabel: formatDate(weekAgo), date: formatDate(weekAgo) });

  // 2週間前
  const twoWeeksAgo = addDays(base, -14);
  slots.push({ label: '2週間前', sublabel: formatDate(twoWeeksAgo), date: formatDate(twoWeeksAgo) });

  // 3週間前
  const threeWeeksAgo = addDays(base, -21);
  slots.push({ label: '3週間前', sublabel: formatDate(threeWeeksAgo), date: formatDate(threeWeeksAgo) });

  // 1ヶ月前
  const monthAgo = addMonths(base, -1);
  slots.push({ label: '1ヶ月前', sublabel: formatDate(monthAgo), date: formatDate(monthAgo) });

  // 3ヶ月前
  const threeMonthsAgo = addMonths(base, -3);
  slots.push({ label: '3ヶ月前', sublabel: formatDate(threeMonthsAgo), date: formatDate(threeMonthsAgo) });

  // 6ヶ月前
  const sixMonthsAgo = addMonths(base, -6);
  slots.push({ label: '半年前', sublabel: formatDate(sixMonthsAgo), date: formatDate(sixMonthsAgo) });

  // 1年前、2年前、… (存在する年数分)
  for (let y = 1; y <= 30; y++) {
    const past = addYears(base, -y);
    if (past.getFullYear() < 1900) break;
    slots.push({
      label: `${y}年前`,
      sublabel: formatDate(past),
      date: formatDate(past),
    });
  }

  return slots;
}

export function DateHistory() {
  const { entries, loading } = useEntries();

  useHead({
    title: '日月年の変化',
    description: '今日を基準に、1日前・1週間前・1ヶ月前・1年前の日記を並べて表示。時間のスケールを変えて、自分の変化を感じる。',
    keywords: '日記比較,変化,成長,過去と今,日月年',
    path: '/datehistory',
  });

  const [baseDate, setBaseDate] = useState(() => formatDate(new Date()));
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

  const base = useMemo(() => {
    const [y, m, d] = baseDate.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [baseDate]);

  const timeSlots: TimeSlot[] = useMemo(() => {
    // エントリを日付でインデックス化
    const byDate = new Map<string, DiaryEntry[]>();
    for (const entry of entries) {
      if (!entry.date) continue;
      const d = entry.date.substring(0, 10);
      const existing = byDate.get(d) ?? [];
      existing.push(entry);
      byDate.set(d, existing);
    }

    const rawSlots = buildTimeSlots(base);
    const result: TimeSlot[] = [];

    for (const slot of rawSlots) {
      const matched = byDate.get(slot.date) ?? [];
      // 日記がある時間帯のみ表示（ただし「今日」は常に表示）
      if (matched.length > 0 || slot.label === '今日') {
        result.push({
          label: slot.label,
          sublabel: slot.sublabel,
          date: slot.date,
          entries: matched,
        });
      }
    }

    return result;
  }, [entries, base]);

  const filledCount = timeSlots.filter(s => s.entries.length > 0).length;

  if (loading) return <div className="page"><p className="loading-text">読み込み中...</p></div>;

  return (
    <div className="page">
      <h1 className="page-title">日月年の変化</h1>
      <p className="subtitle">時間のスケールを変えて、自分の変化を感じる</p>

      <div className="datehistory-picker">
        <label className="datehistory-label">基準日:</label>
        <input
          type="date"
          value={baseDate}
          onChange={e => setBaseDate(e.target.value)}
          className="custom-select"
        />
        <button
          className="btn btn-small"
          onClick={() => setBaseDate(formatDate(new Date()))}
          style={{ marginLeft: 8 }}
        >
          今日に戻す
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="empty-message">日記をインポートすると表示されます</p>
      ) : filledCount === 0 ? (
        <div className="datehistory-empty">
          <p className="empty-message">この基準日に該当する過去の日記はありません</p>
          <p className="hint">別の日付を選んでみてください</p>
        </div>
      ) : (
        <div className="datehistory-list">
          <p className="datehistory-count">
            {filledCount}件の時点に日記があります
          </p>
          {timeSlots.map(slot => (
            <div key={slot.date} className="datehistory-slot">
              <div className="datehistory-slot-header">
                <span className="datehistory-slot-label">{slot.label}</span>
                <span className="datehistory-slot-date">{slot.sublabel}</span>
              </div>
              {slot.entries.length === 0 ? (
                <p className="datehistory-no-entry">この日の日記はありません</p>
              ) : (
                slot.entries.map(entry => (
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
                ))
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
