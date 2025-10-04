import { app, BrowserWindow, ipcMain, shell, dialog, Menu, Tray, nativeImage, Notification } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import isDev from 'electron-is-dev';

import { getStore } from './services/store';
import { DownloadManager } from './services/downloader/DownloadManager';
import { loginBilibiliByWeb, loginYouTubeByGoogle, importCookies } from './services/auth';
import { biliExtractor, youtubeExtractor } from './services/extractors';
import { planBatchByFavorite, planBatchBySeries } from './services/extractors/bili-batch';
import { downloadUserCard } from './services/space/bili-space';
import { exportBiliComments, exportYTComments } from './services/comments';
import { exportBiliDanmaku } from './services/danmaku';
import { runDiagnostics, exportDiagnosticsZip, importDiagnosticsZip } from './services/diagnostics';
import { log } from './services/logger';

// --- 全局变量和路径设置 ---
const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.DIST_ELECTRON = path.join(__dirname, '../');
process.env.DIST = path.join(process.env.DIST_ELECTRON, '../dist');
process.env.PUBLIC = process.env.VITE_DEV_SERVER_URL ? path.join(process.env.DIST_ELECTRON, '../public') : process.env.DIST;

let mainWindow: BrowserWindow | null;
let tray: Tray | null;
const store = getStore();

// --- 主窗口创建 ---
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    titleBarStyle: 'hidden',
    frame: false,
    icon: path.join(process.env.PUBLIC, 'icon.png'),
    backgroundColor: '#00000000',
    vibrancy: 'under-window', // macOS 毛玻璃效果
    visualEffectState: "active",
    backgroundMaterial: 'acrylic', // Windows 11 亚克力效果
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // 监听拖拽链接事件
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('http')) {
      event.preventDefault();
      mainWindow?.webContents.send('app:dnd-url', url);
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(process.env.DIST, 'index.html'));
  }

  // 根据设置决定关闭行为
  mainWindow.on('close', (event) => {
    if (store.get('settings.minimizeToTray', true) && !app.isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => (mainWindow = null));
}

// --- 系统托盘 ---
function createTray() {
  const iconPath = path.join(process.env.PUBLIC, 'icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: '打开', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type: 'separator' },
    { label: '退出', click: () => { app.isQuitting = true; app.quit(); } }
  ]);
  tray.setToolTip('BiliYoutu 下载器');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

// --- 应用生命周期 ---
app.whenReady().then(() => {
  createWindow();
  if (store.get('settings.minimizeToTray', true)) {
    createTray();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// --- 下载管理器与事件监听 ---
const manager = new DownloadManager({ store });

manager.on('task-complete', (task) => {
  if (store.get('settings.notifyOnComplete', true) && mainWindow) {
    new Notification({
      title: '下载完成',
      body: task.title,
      icon: path.join(process.env.PUBLIC, 'icon.png'),
    }).show();
  }
});

manager.on('update', (tasks) => {
  mainWindow?.webContents.send('app:task-update', tasks);
});

// --- IPC 统一错误处理与路由 ---
const wrap = async <T>(fn: () => Promise<T> | T): Promise<{ ok: true, data: T } | { ok: false, error: { name: string, message: string } }> => {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (e: any) {
    log.error('IPC Error', 'ipc', { name: e.name, message: e.message, stack: e.stack });
    return { ok: false, error: { name: e.name || 'Error', message: e.message || '发生未知错误' } };
  }
};

// --- IPC 路由实现 ---
// 窗口控制
ipcMain.handle('app:win:minimize', () => wrap(() => mainWindow?.minimize()));
ipcMain.handle('app:win:maximize', () => wrap(() => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize()));
ipcMain.handle('app:win:close', () => wrap(() => mainWindow?.close()));

// 媒体解析
ipcMain.handle('app:media:parse', (_e, url: string) => wrap(async () => {
  const u = new URL(url);
  if (/bilibili\.com|b23\.tv/.test(u.host)) return biliExtractor.parse(url);
  if (/youtube\.com|youtu\.be/.test(u.host)) return youtubeExtractor.parse(url);
  throw new Error('不支持的链接格式');
}));

// 任务管理
ipcMain.handle('app:task:create', (_e, payload) => wrap(() => manager.create(payload)));
ipcMain.handle('app:task:list', () => wrap(() => manager.list()));
ipcMain.handle('app:task:control', (_e, { id, action }) => wrap(() => manager.control(id, action)));

// 设置
ipcMain.handle('app:settings:get', () => wrap(() => store.get('settings')));
ipcMain.handle('app:settings:set', (_e, patch) => wrap(() => {
  store.set('settings', { ...store.get('settings'), ...patch });
  // 动态创建/销毁托盘
  if (patch.minimizeToTray === true && !tray) createTray();
  if (patch.minimizeToTray === false && tray) { tray.destroy(); tray = null; }
  return store.get('settings');
}));

// 用户认证
ipcMain.handle('app:auth:bili:web', () => wrap(loginBilibiliByWeb));
ipcMain.handle('app:auth:yt:web', () => wrap(loginYouTubeByGoogle));
ipcMain.handle('app:auth:cookie:import', (_e, { kind, cookie }) => wrap(() => importCookies(kind, cookie)));

// 批量与附加资源
ipcMain.handle('app:batch:bili:fav', (_e, mediaId: string) => wrap(() => planBatchByFavorite(mediaId, store.get('settings.downloadDir'))));
ipcMain.handle('app:batch:bili:series', (_e, mid: string) => wrap(() => planBatchBySeries(mid, store.get('settings.downloadDir'))));
ipcMain.handle('app:resource:user', (_e, mid: string) => wrap(() => downloadUserCard(mid, store.get('settings.downloadDir'))));
ipcMain.handle('app:resource:comments', (_e, meta: any) => wrap(() => meta.platform === 'bili' ? exportBiliComments(meta) : exportYTComments(meta)));
ipcMain.handle('app:resource:danmaku', (_e, { meta, fmt }) => wrap(() => exportBiliDanmaku(meta, fmt, store.get('settings.danmaku'))));

// 诊断与日志
ipcMain.handle('app:diag:run', () => wrap(runDiagnostics));
ipcMain.handle('app:log:export', () => wrap(() => exportDiagnosticsZip()));
ipcMain.handle('app:log:import', async () => wrap(async () => {
  const res = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'ZIP 压缩包', extensions: ['zip'] }] });
  return res.canceled || !res.filePaths[0] ? null : importDiagnosticsZip(res.filePaths[0]);
}));

// Shell 操作与对话框
ipcMain.handle('app:shell:openExternal', (_e, url: string) => wrap(() => shell.openExternal(url)));
ipcMain.handle('app:shell:openPath', (_e, p: string) => wrap(() => shell.openPath(p)));
ipcMain.handle('app:shell:showItem', (_e, p: string) => wrap(() => shell.showItemInFolder(p)));
ipcMain.handle('app:dialog:openDirectory', async () => wrap(async () => {
  const res = await dialog.showOpenDialog({ properties: ['openDirectory'], title: "选择下载目录" });
  return res.canceled ? null : res.filePaths[0];
}));
ipcMain.handle('app:dialog:openFile', async () => wrap(async () => {
  const res = await dialog.showOpenDialog({ properties: ['openFile'], title: "选择背景图片", filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp'] }] });
  return res.canceled ? null : res.filePaths[0];
}));