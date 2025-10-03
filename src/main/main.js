import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'node:path';
import Store from 'electron-store';
import isDevPkg from 'electron-is-dev';
const isDev = isDevPkg;

// 导入所有服务
import { DownloadManager } from './manager.js';
import { loginBilibiliByWeb, loginYouTubeByGoogle } from './login.js';
import { log, logger } from './service/logger.ts'; // 假设 logger.ts
import { runDiagnostics, exportDiagnosticsZip, importDiagnosticsZip } from './service/diagnostics.ts'; // 假设 diagnostics.ts
import * as biliExtractor from './service/extractors/bilibili.ts'; // 假设 bilibili.ts
import * as youtubeExtractor from './service/extractors/youtube.ts'; // 假设 youtube.ts
import * as biliBatch from './service/extractors/bili-batch.ts'; // 批量导入
import * as biliSpace from './service/space/bili-space.ts';   // UP主空间
import { exportBiliComments } from './service/comments/bili-comments.ts';
import { exportYTComments } from './service/comments/youtube-comments.ts';
import { exportBiliDanmaku } from './service/danmaku/bili-danmaku.ts';


const store = new Store({ name: 'prefs' });

// ---- 初始设置（含 FFmpeg 可配置）----
if (!store.get('settings')) {
  store.set('settings', {
    downloadDir: app.getPath('downloads'),
    concurrency: 4,                 
    chunkSizeMB: 8,
    codecPref: 'avc1',
    ffmpegPath: '',                 
    filenameTpl: '{title}-{id}',    // 新增：命名模板
    danmaku: { width:3840, height:2160, fps:120, fontName:'Microsoft YaHei', fontSize:42, outline:3, shadow:0, opacity:0, scrollDuration:8, staticDuration:4.5, trackHeight:48 }
  });
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#111111',
    backgroundMaterial: 'mica', // Windows 11 Mica 效果
    webPreferences: {
      // 预加载脚本路径需要根据实际构建路径调整
      preload: path.join(app.getAppPath(), 'dist-electron/preload.js'), 
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true, 
      webSecurity: true
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist/index.html'));
  }
  mainWindow.on('closed', () => (mainWindow = null));
}

app.whenReady().then(() => {
  const ff = store.get('settings')?.ffmpegPath || process.env.FFMPEG_PATH || 'ffmpeg';
  globalThis.__FFMPEG_BIN__ = ff; 
  createWindow();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!mainWindow) createWindow(); });

const mgr = new DownloadManager({
  log: (lvl, tag, data)=> log?.[lvl||'info']?.(String(tag||'mgr'), 'download', data),
  ffmpegBin: () => globalThis.__FFMPEG_BIN__ || 'ffmpeg',
  store
});


// ---------- 统一错误包装和 IPC 路由 ----------

// 统一错误结构体
function err(code, name, message, details) {
  const e = new Error(message); e.code = code; e.name = name; e.details = details; return e;
}
// IPC 包装器：捕获同步/异步错误并返回标准结构
async function wrap(fn) {
  try { const data = await fn(); return { ok: true, data }; }
  catch (e) {
    log.error('ipc error', 'ipc', { name: e.name, code: e.code, message: e.message, details: e.details });
    return { ok: false, error: { code: e.code || 500, name: e.name || 'IPC_ERROR', message: e.message || '未知错误', details: e.details || e.message } };
  }
}

// 解析器平台检测
function detectPlatform(url) {
  try {
    const u = new URL(url);
    if (/bilibili\.com|b23\.tv/.test(u.host)) return 'bili';
    if (/youtube\.com|youtu\.be/.test(u.host)) return 'yt';
  } catch {}
  return 'unknown';
}

// ---------- 命名空间化 IPC：app:* ----------

// 下载任务
ipcMain.handle('app:task:create', async (_e, payload) => wrap(async () => mgr.create(payload)));
ipcMain.handle('app:task:list',   async () => wrap(async () => mgr.list()));
ipcMain.handle('app:task:control',async (_e, { id, action }) => wrap(async () => mgr.control(id, action)));

// 设置
ipcMain.handle('app:settings:get', async () => wrap(async () => store.get('settings')));
ipcMain.handle('app:settings:set', async (_e, patch) => wrap(async () => {
  const s = store.get('settings') || {};
  store.set('settings', { ...s, ...patch });
  if (patch?.ffmpegPath) globalThis.__FFMPEG_BIN__ = patch.ffmpegPath;
  return store.get('settings');
}));

// 登录
ipcMain.handle('app:auth:bili', async () => wrap(async () => loginBilibiliByWeb(store)));
ipcMain.handle('app:auth:yt',   async () => wrap(async () => loginYouTubeByGoogle(store)));
ipcMain.handle('app:auth:cookie:import', async (_e, { kind, cookie }) => wrap(async () => {
  if (kind === 'bili') store.set('bili.cookie', cookie);
  if (kind === 'yt') store.set('yt.cookie', cookie);
  return true;
}));

// 解析
ipcMain.handle('app:media:parse', async (_e, url) => wrap(async () => {
  const platform = detectPlatform(url);
  log.info('parse request', 'parse', { url, platform });
  if (platform === 'bili') return biliExtractor.parse(url, store);
  if (platform === 'yt') return youtubeExtractor.parse(url);
  throw err(400, 'UNSUPPORTED_LINK', '暂不支持的链接');
}));

// 扩展资源/批量 (新增)
ipcMain.handle('app:resource:bili:userCard', async (_e, { mid, targetDir }) => wrap(async () => {
  return biliSpace.downloadUserCard(mid, targetDir);
}));
ipcMain.handle('app:resource:bili:batchFav', async (_e, { mediaId, rootDir }) => wrap(async () => {
  return biliBatch.planBatchByFavorite(mediaId, rootDir);
}));
ipcMain.handle('app:resource:bili:batchSeries', async (_e, { mid, rootDir }) => wrap(async () => {
  return biliBatch.planBatchBySeries(mid, rootDir);
}));

// 评论/弹幕导出 (新增：用于 SearchPage 附加资源按钮)
ipcMain.handle('app:resource:comments:export', async (_e, { meta }) => wrap(async () => {
  if (meta.platform === 'bili') return exportBiliComments(meta);
  if (meta.platform === 'yt') return exportYTComments(meta);
  throw err(400, 'UNSUPPORTED', '不支持的平台评论导出');
}));
ipcMain.handle('app:resource:danmaku:export', async (_e, { meta, fmt }) => wrap(async () => {
  const settings = store.get('settings');
  if (meta.platform === 'bili') return exportBiliDanmaku(meta, fmt, settings?.danmaku);
  throw err(400, 'UNSUPPORTED', 'YouTube 暂不支持弹幕导出');
}));


// 日志/诊断
ipcMain.handle('app:log:recent', async (_e, lines) => wrap(async () => logger.readRecent(lines || 2000)));
ipcMain.handle('app:log:list',   async () => wrap(async () => logger.listFiles()));
ipcMain.handle('app:log:export', async (_e) => wrap(async () => {
  const { canceled, filePath } = await dialog.showSaveDialog({ title: '导出诊断包', defaultPath: 'diagnostics.zip', filters: [{ name: 'ZIP', extensions: ['zip'] }] });
  if (canceled || !filePath) return null;
  return exportDiagnosticsZip(filePath);
}));
ipcMain.handle('app:log:import', async (_e) => wrap(async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ title: '导入诊断包', filters: [{ name: 'ZIP', extensions: ['zip'] }] });
  if (canceled || !filePaths?.[0]) return null;
  return importDiagnosticsZip(filePaths[0]);
}));
ipcMain.handle('app:diag:run',   async () => wrap(async () => runDiagnostics()));

// 窗口控制
ipcMain.handle('app:win:min',  () => { mainWindow?.minimize(); return { ok:true }; });
ipcMain.handle('app:win:max',  () => { mainWindow?.isMaximized()? mainWindow?.unmaximize(): mainWindow?.maximize(); return { ok:true }; });
ipcMain.handle('app:win:close',() => { mainWindow?.close(); return { ok:true }; });

// 打开 FFmpeg 官网（缺失时友好引导）
ipcMain.handle('app:help:ffmpeg', async () => { await shell.openExternal('https://ffmpeg.org/download.html'); return { ok:true }; });
// 打开文件/目录 (新增)
ipcMain.handle('app:shell:openFile', async (_e, filePath) => { await shell.openPath(filePath); return { ok: true }; });
ipcMain.handle('app:shell:openDir', async (_e, dirPath) => { await shell.openPath(dirPath); return { ok: true }; });