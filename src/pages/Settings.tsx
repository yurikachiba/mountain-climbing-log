import { useState } from 'react';
import { deleteAllEntries, exportAllData, importAllData } from '../db';

export function Settings() {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
        <h2>このアプリについて</h2>
        <p className="about-text">
          登山ログ ― 未来から過去へロープを垂らす装置
        </p>
        <p className="about-text">
          すべてのデータはこの端末のブラウザ内にのみ保存されます。
          サーバーへの送信は一切行いません。
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
