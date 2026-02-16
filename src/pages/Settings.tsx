import { useState, useEffect } from 'react';
import { deleteAllEntries, exportAllData, importAllData } from '../db';
import { getApiKey, setApiKey } from '../utils/apiKey';

export function Settings() {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [keyMasked, setKeyMasked] = useState(false);

  useEffect(() => {
    const saved = getApiKey();
    if (saved) {
      setApiKeyInput(saved);
      setKeyMasked(true);
    }
  }, []);

  function handleSaveKey() {
    setApiKey(apiKeyInput);
    if (apiKeyInput.trim()) {
      setKeyMasked(true);
      setMessage('APIキーを保存しました');
    } else {
      setKeyMasked(false);
      setMessage('APIキーを削除しました');
    }
  }

  function handleEditKey() {
    setKeyMasked(false);
  }

  function maskKey(key: string): string {
    if (key.length <= 8) return '••••••••';
    return key.slice(0, 4) + '••••••••' + key.slice(-4);
  }

  async function handleExport() {
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `climbing-log-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage('エクスポートしました');
    } catch {
      setMessage('エクスポートに失敗しました');
    }
  }

  async function handleImportBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.entries || !data.fragments) {
        setMessage('無効なバックアップファイルです');
        return;
      }
      await importAllData(data);
      setMessage('バックアップを復元しました');
    } catch {
      setMessage('復元に失敗しました');
    }
  }

  async function handleDeleteAll() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await deleteAllEntries();
    setConfirmDelete(false);
    setMessage('すべてのデータを削除しました');
  }

  return (
    <div className="page">
      <h1 className="page-title">設定</h1>

      <section className="settings-section">
        <h2>データ管理</h2>

        <div className="settings-row">
          <div>
            <p className="settings-label">バックアップをエクスポート</p>
            <p className="settings-desc">すべてのデータをJSONファイルとして保存</p>
          </div>
          <button onClick={handleExport} className="btn">
            エクスポート
          </button>
        </div>

        <div className="settings-row">
          <div>
            <p className="settings-label">バックアップを復元</p>
            <p className="settings-desc">エクスポートしたJSONファイルから復元</p>
          </div>
          <label className="btn">
            ファイルを選択
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        <div className="settings-row danger-zone">
          <div>
            <p className="settings-label">すべてのデータを削除</p>
            <p className="settings-desc">この操作は取り消せません</p>
          </div>
          <button
            onClick={handleDeleteAll}
            className={`btn ${confirmDelete ? 'btn-danger-confirm' : 'btn-danger'}`}
          >
            {confirmDelete ? '本当に削除する' : '一括削除'}
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h2>AI分析（OpenAI API）</h2>
        <p className="settings-desc" style={{ marginBottom: 16 }}>
          年代別要約・感情タグ・トーン分析に使用します。キーはこの端末のブラウザにのみ保存されます。
        </p>
        <div className="settings-row">
          <div style={{ flex: 1 }}>
            <p className="settings-label">OpenAI APIキー</p>
            {keyMasked ? (
              <p className="api-key-masked">{maskKey(apiKeyInput)}</p>
            ) : (
              <input
                type="password"
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                placeholder="sk-..."
                className="api-key-input"
                autoComplete="off"
              />
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {keyMasked ? (
              <button onClick={handleEditKey} className="btn btn-small">
                変更
              </button>
            ) : (
              <button onClick={handleSaveKey} className="btn btn-small">
                保存
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h2>このアプリについて</h2>
        <p className="about-text">
          登山ログ ― 未来から過去へロープを垂らす装置
        </p>
        <p className="about-text">
          日記データはこの端末のブラウザ内にのみ保存されます。
          AI分析を使用した場合のみ、日記の一部がOpenAI APIに送信されます。
        </p>
      </section>

      {message && (
        <div className="toast" onClick={() => setMessage(null)}>
          {message}
        </div>
      )}
    </div>
  );
}
