import Store from 'electron-store';
import crypto from 'node:crypto';

let store: Store | null = null;

export function getStore() {
  if (store) return store;
  const key = crypto.createHash('sha256').update(process.execPath).digest('hex'); // 简化示例
  store = new Store({ name: 'prefs', encryptionKey: key });
  if (!store.get('settings')) store.set('settings', {
    downloadDir: '',
    concurrency: 4,
    filenameTpl: '{title}-{id}',
    theme: 'system',
    notify: true,
    minimizeToTray: true
  });
  return store!;
}
