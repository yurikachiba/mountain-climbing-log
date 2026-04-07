import { useState, useMemo, useCallback } from 'react';
import { useEntries } from '../hooks/useEntries';
import { useHead } from '../hooks/useHead';
import { BreadcrumbJsonLd } from '../components/JsonLd';
import { toDateOnly, compareDateOnly } from '../utils/dateNormalize';

export function DiaryLookup() {
  useHead({
    title: '日記検索',
    description: '年月日を指定して日記を一件ずつ読み返せるページ。過去の特定の日に何を書いていたか、すぐに見つかります。',
    keywords: '日記検索,日付検索,日記閲覧,過去の日記',
    path: '/diary',
  });

  const { entries, loading } = useEntries();

  // 日付のあるエントリだけを日付順にソート
  const dated = useMemo(() => {
    const filtered = entries.filter((e): e is typeof e & { date: string } => e.date !== null);
    filtered.sort((a, b) => compareDateOnly(a.date, b.date));
    return filtered;
  }, [entries]);

  // 日付リスト（正規化して重複なし）
  const dates = useMemo(() => [...new Set(dated.map(e => toDateOnly(e.date)))], [dated]);

  // 年・月の選択肢を生成
  const years = useMemo(() => [...new Set(dates.map(d => d.slice(0, 4)))].sort(), [dates]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // 初期選択: エントリが読み込まれたら最新の日付を選ぶ
  const currentDate = selectedDate ?? dates[dates.length - 1] ?? null;

  const currentYear = currentDate?.slice(0, 4) ?? years[years.length - 1] ?? '';
  const currentMonth = currentDate?.slice(5, 7) ?? '';

  const months = useMemo(
    () => [...new Set(dates.filter(d => d.startsWith(currentYear)).map(d => d.slice(5, 7)))].sort(),
    [dates, currentYear],
  );

  const days = useMemo(
    () => dates.filter(d => d.startsWith(`${currentYear}-${currentMonth}`)).map(d => d.slice(8, 10)),
    [dates, currentYear, currentMonth],
  );

  const currentDay = currentDate?.slice(8, 10) ?? '';

  // 該当日のエントリ
  const matchedEntries = useMemo(
    () => (currentDate ? dated.filter(e => toDateOnly(e.date) === currentDate) : []),
    [dated, currentDate],
  );

  // 日付インデックス（前後ナビ用）
  const currentIdx = currentDate ? dates.indexOf(currentDate) : -1;
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx >= 0 && currentIdx < dates.length - 1;

  const goTo = useCallback((date: string) => setSelectedDate(date), []);

  const handleYearChange = useCallback((year: string) => {
    const candidates = dates.filter(d => d.startsWith(year));
    if (candidates.length > 0) goTo(candidates[candidates.length - 1]);
  }, [dates, goTo]);

  const handleMonthChange = useCallback((month: string) => {
    const prefix = `${currentYear}-${month}`;
    const candidates = dates.filter(d => d.startsWith(prefix));
    if (candidates.length > 0) goTo(candidates[candidates.length - 1]);
  }, [dates, currentYear, goTo]);

  const handleDayChange = useCallback((day: string) => {
    goTo(`${currentYear}-${currentMonth}-${day}`);
  }, [currentYear, currentMonth, goTo]);

  if (loading) {
    return <div className="page"><p>読み込み中…</p></div>;
  }

  if (dated.length === 0) {
    return (
      <div className="page">
        <BreadcrumbJsonLd items={[{ name: '日記検索', path: '/diary' }]} />
        <h1>日記検索</h1>
        <p>日付のある日記がまだありません。先に日記をインポートしてください。</p>
      </div>
    );
  }

  return (
    <div className="page diary-lookup">
      <BreadcrumbJsonLd items={[{ name: '日記検索', path: '/diary' }]} />
      <h1>日記検索</h1>
      <p className="diary-lookup-summary">{dates.length}日分の日記（{dated.length}件）</p>

      {/* 日付セレクター */}
      <div className="diary-lookup-selectors">
        <label>
          <span className="diary-lookup-label">年</span>
          <select value={currentYear} onChange={e => handleYearChange(e.target.value)}>
            {years.map(y => <option key={y} value={y}>{y}年</option>)}
          </select>
        </label>
        <label>
          <span className="diary-lookup-label">月</span>
          <select value={currentMonth} onChange={e => handleMonthChange(e.target.value)}>
            {months.map(m => <option key={m} value={m}>{Number(m)}月</option>)}
          </select>
        </label>
        <label>
          <span className="diary-lookup-label">日</span>
          <select value={currentDay} onChange={e => handleDayChange(e.target.value)}>
            {days.map(d => <option key={d} value={d}>{Number(d)}日</option>)}
          </select>
        </label>
      </div>

      {/* 前後ナビ */}
      <div className="diary-lookup-nav">
        <button
          className="btn"
          disabled={!hasPrev}
          onClick={() => hasPrev && goTo(dates[currentIdx - 1])}
        >
          ← 前の日
        </button>
        <span className="diary-lookup-current">
          {currentDate ? formatDateJa(currentDate) : '—'}
        </span>
        <button
          className="btn"
          disabled={!hasNext}
          onClick={() => hasNext && goTo(dates[currentIdx + 1])}
        >
          次の日 →
        </button>
      </div>

      {/* エントリ表示 */}
      {matchedEntries.length === 0 ? (
        <p>この日の日記はありません。</p>
      ) : (
        matchedEntries.map((entry, i) => (
          <article key={entry.id} className="diary-lookup-entry">
            {matchedEntries.length > 1 && (
              <p className="diary-lookup-entry-num">{i + 1} / {matchedEntries.length}件</p>
            )}
            <div className="diary-lookup-content">{entry.content}</div>
            <p className="diary-lookup-meta">
              ソース: {entry.sourceFile}
            </p>
          </article>
        ))
      )}
    </div>
  );
}

function formatDateJa(date: string): string {
  const [y, m, d] = date.split('-');
  return `${y}年${Number(m)}月${Number(d)}日`;
}
