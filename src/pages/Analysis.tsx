import { useState } from 'react';
import { useEntries } from '../hooks/useEntries';
import { hasApiKey } from '../utils/apiKey';
import { summarizeByPeriod, extractEmotionTags, analyzeTone } from '../utils/openai';

type AnalysisType = 'summary' | 'tags' | 'tone';

const analysisLabels: Record<AnalysisType, { title: string; desc: string }> = {
  summary: { title: '年代別要約', desc: '年ごとの傾向を500字以内で要約' },
  tags: { title: '頻出感情タグ', desc: '日記全体から感情タグを抽出' },
  tone: { title: '文章トーン分析', desc: '前期と後期でトーンの変化を比較' },
};

export function Analysis() {
  const { entries, loading } = useEntries();
  const [results, setResults] = useState<Record<string, string>>({});
  const [running, setRunning] = useState<AnalysisType | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(type: AnalysisType) {
    if (!hasApiKey()) {
      setError('APIキーが設定されていません。設定ページで入力してください。');
      return;
    }
    setRunning(type);
    setError(null);
    try {
      let result = '';
      switch (type) {
        case 'summary':
          result = await summarizeByPeriod(entries);
          break;
        case 'tags':
          result = await extractEmotionTags(entries);
          break;
        case 'tone':
          result = await analyzeTone(entries);
          break;
      }
      setResults(prev => ({ ...prev, [type]: result }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析に失敗しました');
    } finally {
      setRunning(null);
    }
  }

  if (loading) return <div className="page"><p className="loading-text">読み込み中...</p></div>;

  if (entries.length === 0) {
    return (
      <div className="page">
        <h1 className="page-title">AI分析</h1>
        <p className="empty-message">日記をインポートすると分析できます</p>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">AI分析</h1>
      <p className="subtitle">分析だけ。人格は禁止。</p>

      {!hasApiKey() && (
        <p className="hint" style={{ color: 'var(--danger)' }}>
          設定ページでOpenAI APIキーを入力してください
        </p>
      )}

      {error && <p className="error-text">{error}</p>}

      <div className="analysis-list">
        {(Object.keys(analysisLabels) as AnalysisType[]).map(type => (
          <section key={type} className="analysis-section">
            <div className="analysis-header">
              <div>
                <h2>{analysisLabels[type].title}</h2>
                <p className="settings-desc">{analysisLabels[type].desc}</p>
              </div>
              <button
                onClick={() => run(type)}
                disabled={running !== null}
                className="btn btn-small"
              >
                {running === type ? '分析中...' : '実行'}
              </button>
            </div>
            {results[type] && (
              <div className="analysis-result">
                {results[type].split('\n').map((line, i) => (
                  <p key={i}>{line || '\u00A0'}</p>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      <p className="hint" style={{ marginTop: 48 }}>
        日記の一部がOpenAI APIに送信されます。ローカル分析はタイムラインページで確認できます。
      </p>
    </div>
  );
}
