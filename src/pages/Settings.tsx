import { useState } from 'react';
import { deleteAllEntries, exportAllData, importAllData, clearAllAiCache, markAllAiCacheStale } from '../db';
import { getApiKey, setApiKey, getKeyStorageMode, setKeyStorageMode } from '../utils/apiKey';
import type { KeyStorageMode } from '../utils/apiKey';
import { useHead } from '../hooks/useHead';

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function Settings() {
  useHead({
    title: '設定・データ管理',
    description: '登山ログの設定ページ。データのエクスポート・バックアップ復元・一括削除、Anthropic APIキーの管理が行えます。すべてのデータはブラウザ内に保存。',
    keywords: 'データ管理,バックアップ,エクスポート,APIキー設定,データ削除',
    path: '/settings',
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const savedKey = getApiKey();
  const [apiKeyInput, setApiKeyInput] = useState(() => savedKey ?? '');
  const [keyMasked, setKeyMasked] = useState(() => !!savedKey);
  const [storageMode, setStorageMode] = useState<KeyStorageMode>(() => getKeyStorageMode());

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

  function handleStorageModeChange(mode: KeyStorageMode) {
    setKeyStorageMode(mode);
    setStorageMode(mode);
    if (mode === 'session') {
      setMessage('セッションモードに切り替えました。タブを閉じるとキーが消去されます。');
    } else {
      setMessage('永続モードに切り替えました。キーはブラウザに保存されます。');
    }
  }

  function maskKey(key: string): string {
    if (key.length <= 8) return '••••••••';
    return key.slice(0, 4) + '••••••••' + key.slice(-4);
  }

  async function handleExport() {
    try {
      const data = await exportAllData();
      downloadJson(data, `climbing-log-backup-${new Date().toISOString().slice(0, 10)}.json`);
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
      await markAllAiCacheStale();
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
    // 削除前に自動バックアップを生成してダウンロード
    try {
      const data = await exportAllData();
      if (data.entries.length > 0 || data.fragments.length > 0) {
        downloadJson(data, `climbing-log-pre-delete-backup-${new Date().toISOString().slice(0, 10)}.json`);
      }
    } catch {
      // バックアップ失敗でも削除は続行（ユーザーは既に2回確認済み）
    }
    await deleteAllEntries();
    await clearAllAiCache();
    setConfirmDelete(false);
    setMessage('削除前のバックアップをダウンロードしました。すべてのデータを削除しました。');
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
            <p className="settings-desc">
              {confirmDelete
                ? '削除前にバックアップが自動ダウンロードされます'
                : 'この操作は取り消せません'}
            </p>
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
        <h2>AI分析（Claude API）</h2>
        <p className="settings-desc" style={{ marginBottom: 16 }}>
          日記の深層分析に使用します。キーはこの端末のブラウザにのみ保存されます。
        </p>

        <div className="api-key-guide" style={{
          background: 'var(--surface-bg, #f8f9fa)',
          border: '1px solid var(--border, #e0e0e0)',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 16,
          fontSize: '0.85em',
          lineHeight: 1.7,
        }}>
          <p style={{ fontWeight: 'bold', marginBottom: 8 }}>APIキーの取得方法</p>
          <ol style={{ margin: 0, paddingLeft: 20, marginBottom: 12 }}>
            <li><a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>Anthropic Console</a> にアクセスし、アカウントを作成・ログイン</li>
            <li>ダッシュボードから「API Keys」を選択</li>
            <li>「Create Key」で新しいキーを作成し、コピー</li>
            <li>下のフィールドに貼り付けて「保存」を押す</li>
          </ol>
          <p style={{ color: 'var(--text-muted, #888)', fontSize: '0.95em', marginBottom: 8 }}>
            ※ Anthropic Consoleは英語表示ですが、翻訳せずそのまま操作する方がスムーズです。ブラウザの自動翻訳をオフにしてお使いください。
          </p>
        </div>

        <div className="api-key-warning" style={{
          background: 'var(--warning-bg, #fff8e1)',
          border: '1px solid var(--warning-border, #ffe082)',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 16,
          fontSize: '0.85em',
          lineHeight: 1.6,
        }}>
          <p style={{ fontWeight: 'bold', marginBottom: 4 }}>APIキーの安全な運用について</p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>このキーはブラウザ内に保存されます。端末の共有時は注意してください</li>
            <li>専用の低権限キーを作成し、使用量上限（月額制限）を設定することを推奨します</li>
            <li>セッションモードを使うと、タブを閉じた時点でキーが自動消去されます</li>
          </ul>
        </div>

        <div className="settings-row">
          <div style={{ flex: 1 }}>
            <p className="settings-label">Anthropic APIキー</p>
            {keyMasked ? (
              <p className="api-key-masked">{maskKey(apiKeyInput)}</p>
            ) : (
              <input
                type="password"
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                placeholder="sk-ant-..."
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

        <div className="settings-row" style={{ marginTop: 8 }}>
          <div style={{ flex: 1 }}>
            <p className="settings-label">キーの保存方法</p>
            <p className="settings-desc">
              {storageMode === 'session'
                ? 'セッションモード：タブを閉じるとキーが消去されます'
                : '永続モード：ブラウザに保存され、次回アクセス時も使えます'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => handleStorageModeChange('local')}
              className={`btn btn-small${storageMode === 'local' ? ' btn-active' : ''}`}
              style={storageMode === 'local' ? { fontWeight: 'bold' } : {}}
            >
              永続
            </button>
            <button
              onClick={() => handleStorageModeChange('session')}
              className={`btn btn-small${storageMode === 'session' ? ' btn-active' : ''}`}
              style={storageMode === 'session' ? { fontWeight: 'bold' } : {}}
            >
              セッション
            </button>
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
          AI分析を使用した場合のみ、日記の一部がAnthropic Claude APIに送信されます。
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
