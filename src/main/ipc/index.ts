import { ipcMain } from 'electron';
import { parseUrl } from '../services/extractors/types';
import { biliExtractor } from '../services/extractors/bilibili';
import { youtubeExtractor } from '../services/extractors/youtube';
import { DownloadManager } from '../services/downloader/DownloadManager';
import { getStore } from '../services/auth/store';
import { exportBiliComments } from '../services/comments/bili-comments';
import { exportYTComments } from '../services/comments/youtube-comments';
import { exportBiliDanmaku } from '../services/danmaku/bili-danmaku';

const manager = new DownloadManager();
const store = getStore();

ipcMain.handle('media:parse', async (_e, url: string) => {
  const kind = parseUrl(url);
  if (kind.platform === 'bili') return biliExtractor.parse(url, store);
  if (kind.platform === 'yt') return youtubeExtractor.parse(url);
  throw new Error('Unsupported URL');
});

ipcMain.handle('task:create', async (_e, payload) => manager.create(payload));
ipcMain.handle('task:list', async () => manager.list());
ipcMain.handle('task:control', async (_e, { id, action }) => manager.control(id, action));

ipcMain.handle('settings:get', async () => store.get('settings'));
ipcMain.handle('settings:set', async (_e, patch) => {
  const s = store.get('settings') || {};
  store.set('settings', { ...s, ...patch });
  return store.get('settings');
});

ipcMain.handle('comments:export', async (_e, mediaId: string) => {
  const meta = manager.meta(mediaId);
  if (!meta) throw new Error('No such task');
  if (meta.platform === 'bili') return exportBiliComments(meta);
  return exportYTComments(meta);
});

ipcMain.handle('danmaku:export', async (_e, { id, fmt }) => {
  const meta = manager.meta(id);
  if (!meta) throw new Error('No such task');
  if (meta.platform === 'bili') return exportBiliDanmaku(meta, fmt);
  throw new Error('YouTube danmaku not supported (use live chat export).');
});

ipcMain.handle('live:info', async (_e, { platform, id }) => {
  if (platform === 'bili') {
    const { getBiliLiveInfo } = await import('../services/live/bili-live');
    return getBiliLiveInfo(id);
  } else {
    const { getYTLiveInfo } = await import('../services/live/youtube-live');
    return getYTLiveInfo(id);
  }
});

// --- add at top ---
import { dialog, ipcMain } from 'electron';
import { logger, log } from '../services/logger';
import { runDiagnostics, exportDiagnosticsZip, importDiagnosticsZip } from '../services/diagnostics';

// --- add routes ---
ipcMain.handle('log:recent', async (_e, lines?: number) => logger.readRecent(lines || 2000));
ipcMain.handle('log:listFiles', async () => logger.listFiles());
ipcMain.handle('log:export', async async (_e) => {
  const { canceled, filePath } = await dialog.showSaveDialog({ title:'导出诊断包', defaultPath: 'diagnostics.zip', filters:[{ name:'ZIP', extensions:['zip'] }] });
  if (canceled || !filePath) return null;
  const out = await exportDiagnosticsZip(filePath);
  return out;
});
ipcMain.handle('log:import', async (_e) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ title:'导入诊断包', filters:[{ name:'ZIP', extensions:['zip'] }] });
  if (canceled || !filePaths?.[0]) return null;
  return importDiagnosticsZip(filePaths[0]);
});

ipcMain.handle('diag:run', async () => runDiagnostics());