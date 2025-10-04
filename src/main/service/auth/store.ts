import Store from 'electron-store';
import crypto from 'node:crypto';
import { app } from 'electron';

let store: Store | null = null;

export function getStore() {
  if (store) return store;
  // 使用一个简单的固定值或基于机器的唯一ID作为加密密钥
  const key = crypto.createHash('sha256').update(process.execPath || 'bili-downloader-secret').digest('hex').slice(0, 16);
  store = new Store({
    name: 'prefs',
    encryptionKey: key, // 启用加密
  });

  // 初始化默认设置
  if (!store.get('settings')) {
    store.set('settings', {
      downloadDir: app.getPath('downloads'),
      concurrency: 4,
      filenameTpl: '{title}-{id}',
      theme: 'system', // 'light', 'dark', 'system'
      notify: true,
      minimizeToTray: true,
      backgroundImagePath: '',
      backgroundOpacity: 0.7,
      danmaku: {
        fontName:'Microsoft YaHei',
        fontSize:42,
        outline:3,
        shadow:0,
        opacity:0.8,
        scrollDuration:8.0,
        staticDuration:4.5
      }
    });
  }
  return store!;
}