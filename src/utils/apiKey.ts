const STORAGE_KEY = 'climbing-log-openai-key';
const MODE_KEY = 'climbing-log-key-storage-mode';

export type KeyStorageMode = 'local' | 'session';

export function getKeyStorageMode(): KeyStorageMode {
  return (localStorage.getItem(MODE_KEY) as KeyStorageMode) ?? 'local';
}

export function setKeyStorageMode(mode: KeyStorageMode): void {
  const currentKey = getApiKey();
  // 古い保存先からキーを削除
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  // モードを保存(モード設定自体はlocalStorage固定)
  localStorage.setItem(MODE_KEY, mode);
  // キーがあれば新しい保存先に移動
  if (currentKey) {
    getStorage(mode).setItem(STORAGE_KEY, currentKey);
  }
}

function getStorage(mode?: KeyStorageMode): Storage {
  return (mode ?? getKeyStorageMode()) === 'session' ? sessionStorage : localStorage;
}

export function getApiKey(): string {
  // sessionStorageを先に確認し、なければlocalStorageを確認
  return sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY) ?? '';
}

export function setApiKey(key: string): void {
  // 両方からクリアしてから、現在のモードの保存先に保存
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  if (key.trim()) {
    getStorage().setItem(STORAGE_KEY, key.trim());
  }
}

export function hasApiKey(): boolean {
  return getApiKey().length > 0;
}
