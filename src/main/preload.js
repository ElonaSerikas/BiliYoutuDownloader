import { contextBridge, ipcRenderer } from 'electron';

const call = (ch, ...args) => ipcRenderer.invoke(ch, ...args).then((r) => {
  if (r?.ok) return r.data;
  const e = r?.error || { code: 500, name: 'IPC_ERROR', message: 'unknown' };
  const err = new Error(e.message); err.name = e.name; err.code = e.code; err.details = e.details; throw err;
});

contextBridge.exposeInMainWorld('api', {
  // 解析
  parse: (url) => call('app:media:parse', url),

  // 任务
  createTask: (payload) => call('app:task:create', payload),
  listTasks: () => call('app:task:list'),
  controlTask: (id, action) => call('app:task:control', { id, action }),

  // 设置
  getSettings: () => call('app:settings:get'),
  setSettings: (patch) => call('app:settings:set', patch),

  // 登录
  openBiliLogin: () => call('app:auth:bili'),
  openYTLogin: () => call('app:auth:yt'),
  importCookie: (kind, cookie) => call('app:auth:cookie:import', { kind, cookie }),

  // 扩展资源/批量 (NEW)
  downloadBiliUserCard: (mid, targetDir) => call('app:resource:bili:userCard', { mid, targetDir }),
  planBatchByFavorite: (mediaId, rootDir) => call('app:resource:bili:batchFav', { mediaId, rootDir }),
  listSeries: (mid, rootDir) => call('app:resource:bili:batchSeries', { mid, rootDir }),
  commentsExport: (meta) => call('app:resource:comments:export', { meta }),
  danmakuExport: (meta, fmt) => call('app:resource:danmaku:export', { meta, fmt }),
  
  // 日志/诊断
  diagRun: () => call('app:diag:run'),
  logRecent: (n=2000) => call('app:log:recent', n),
  logExport: () => call('app:log:export'),
  logImport: () => call('app:log:import'),

  // 帮助
  openFfmpegSite: () => call('app:help:ffmpeg'),

  // 窗控 / Shell (NEW)
  minimize: () => call('app:win:min'),
  maximize: () => call('app:win:max'),
  close: () => call('app:win:close'),
  openFile: (filePath) => call('app:shell:openFile', filePath),
  openDir: (dirPath) => call('app:shell:openDir', dirPath)
});