import { useState, useMemo, useCallback } from 'react';
import { useHead } from '../hooks/useHead';
import { useObservations } from '../hooks/useObservations';
import { addObservation } from '../db';
import type { Observation } from '../types';

const gentlePrompts = [
  '今日、おいしいって感じたものはあった？',
  '5分寝て、どんな夢を見た？',
  '体が冷えたとき、どうやって温めた？',
  '今日、ふと目に止まった色は？',
  '最後に深呼吸したのはいつ？',
  '今日、誰かの声を聞いた？どんな声だった？',
  '窓の外は今、どんな景色？',
  '今日のご飯で、一番記憶に残ってるのは？',
  '手を温めたくなったとき、何をした？',
  '今日、体のどこが一番疲れてる？',
];

const skyOptions = [
  { emoji: '\u2600\uFE0F', label: '快晴' },
  { emoji: '\uD83C\uDF24\uFE0F', label: '晴れ' },
  { emoji: '\u26C5', label: 'くもり' },
  { emoji: '\uD83C\uDF25\uFE0F', label: '曇り' },
  { emoji: '\u2601\uFE0F', label: '重い曇り' },
  { emoji: '\uD83C\uDF27\uFE0F', label: '雨' },
  { emoji: '\u26C8\uFE0F', label: '嵐' },
];

const waveOptions = [
  { value: 'calm', label: '凪（なぎ）' },
  { value: 'ripple', label: 'さざ波' },
  { value: 'high', label: '高波' },
];

function getTodayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getRandomPrompt(): string {
  return gentlePrompts[Math.floor(Math.random() * gentlePrompts.length)];
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${y}/${m}/${d}`;
}

export function Observatory() {
  useHead({
    title: '山頂の観測所',
    description: '毎日の気分や状態をやさしく記録する観測所。空模様、安心ゲージ、波の高さで今日の自分を観測します。',
    keywords: '観測所,気分記録,セルフケア,やさしいログ,日記',
    path: '/observatory',
  });

  const { observations, loading, refresh } = useObservations();

  const [sky, setSky] = useState('\u26C5');
  const [comfort, setComfort] = useState(50);
  const [wave, setWave] = useState('calm');
  const [note, setNote] = useState('');
  const [currentPrompt] = useState(getRandomPrompt);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const todayStr = getTodayString();
  const todayObservation = useMemo(
    () => observations.find(o => o.date === todayStr),
    [observations, todayStr],
  );

  // 同じ月日の過去の観測記録（足跡の確認）
  const footprints = useMemo(() => {
    const mmdd = todayStr.substring(5);
    const thisYear = todayStr.substring(0, 4);
    return observations
      .filter(o => o.date.substring(5) === mmdd && o.date.substring(0, 4) !== thisYear)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [observations, todayStr]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const observation: Observation = {
      id: crypto.randomUUID(),
      date: todayStr,
      sky,
      comfort,
      wave,
      note,
      prompt: currentPrompt,
      createdAt: new Date().toISOString(),
    };
    await addObservation(observation);
    await refresh();
    setSaving(false);
    setSaved(true);
  }, [todayStr, sky, comfort, wave, note, currentPrompt, refresh]);

  if (loading) {
    return (
      <div className="page">
        <p className="loading-text">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">山頂の観測所</h1>
      <p className="subtitle">今日の風景を、やさしく記録する</p>

      {todayObservation && !saved ? (
        <div className="obs-today-summary">
          <p className="obs-today-label">今日の観測は完了しています</p>
          <div className="obs-today-card">
            <div className="obs-today-row">
              <span className="obs-field-label">空模様</span>
              <span className="obs-field-value">{todayObservation.sky}</span>
            </div>
            <div className="obs-today-row">
              <span className="obs-field-label">安心ゲージ</span>
              <span className="obs-field-value">{todayObservation.comfort}%</span>
            </div>
            <div className="obs-today-row">
              <span className="obs-field-label">波の高さ</span>
              <span className="obs-field-value">
                {waveOptions.find(w => w.value === todayObservation.wave)?.label ?? todayObservation.wave}
              </span>
            </div>
            {todayObservation.note && (
              <div className="obs-today-note">
                <p className="obs-field-label">小さな発見</p>
                <p className="obs-note-text">{todayObservation.note}</p>
              </div>
            )}
          </div>
        </div>
      ) : saved ? (
        <div className="obs-saved-message">
          <p className="obs-saved-text">今日の観測を記録しました</p>
          <p className="obs-saved-sub">お疲れさまでした。</p>
        </div>
      ) : (
        <>
          <section className="obs-section">
            <h2 className="obs-section-title">今日の風景（状態）</h2>

            <div className="obs-field">
              <label className="obs-field-label">空模様</label>
              <div className="obs-sky-selector">
                {skyOptions.map(opt => (
                  <button
                    key={opt.emoji}
                    className={`obs-sky-btn ${sky === opt.emoji ? 'selected' : ''}`}
                    onClick={() => setSky(opt.emoji)}
                    title={opt.label}
                    type="button"
                  >
                    <span className="obs-sky-emoji">{opt.emoji}</span>
                    <span className="obs-sky-label">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="obs-field">
              <label className="obs-field-label">
                安心ゲージ
                <span className="obs-comfort-value">{comfort}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={comfort}
                onChange={e => setComfort(Number(e.target.value))}
                className="obs-comfort-slider"
              />
              <div className="obs-comfort-labels">
                <span>不安</span>
                <span>ふつう</span>
                <span>安心</span>
              </div>
            </div>

            <div className="obs-field">
              <label className="obs-field-label">波の高さ</label>
              <div className="obs-wave-selector">
                {waveOptions.map(opt => (
                  <button
                    key={opt.value}
                    className={`obs-wave-btn ${wave === opt.value ? 'selected' : ''}`}
                    onClick={() => setWave(opt.value)}
                    type="button"
                  >
                    <span className="obs-wave-label">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="obs-section">
            <h2 className="obs-section-title">今日の小さな発見</h2>
            <p className="obs-prompt">{currentPrompt}</p>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              className="obs-note-input"
              placeholder="何も書かなくても大丈夫です"
              rows={4}
            />
          </section>

          <div className="obs-save-area">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? '記録中...' : '今日の観測を記録する'}
            </button>
          </div>
        </>
      )}

      {footprints.length > 0 && (
        <section className="obs-section obs-footprints">
          <h2 className="obs-section-title">足跡の確認</h2>
          <p className="obs-footprints-lead">
            同じ日の過去の観測記録
          </p>
          {footprints.map(fp => (
            <div key={fp.id} className="obs-footprint-card">
              <div className="obs-footprint-date">
                {formatDate(fp.date)}
              </div>
              <div className="obs-footprint-row">
                <span>{fp.sky}</span>
                <span>{fp.comfort}%</span>
                <span>{waveOptions.find(w => w.value === fp.wave)?.label ?? fp.wave}</span>
              </div>
              {fp.note && (
                <p className="obs-footprint-note">{fp.note}</p>
              )}
            </div>
          ))}
        </section>
      )}

      {observations.length > 0 && (
        <section className="obs-section">
          <h2 className="obs-section-title">最近の観測</h2>
          <div className="obs-history-list">
            {[...observations].reverse().slice(0, 14).map(obs => (
              <div key={obs.id} className="obs-history-item">
                <span className="obs-history-date">{formatDate(obs.date)}</span>
                <span className="obs-history-sky">{obs.sky}</span>
                <span className="obs-history-comfort">{obs.comfort}%</span>
                <span className="obs-history-wave">
                  {waveOptions.find(w => w.value === obs.wave)?.label ?? obs.wave}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
