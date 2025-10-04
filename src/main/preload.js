import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// IPC 通道白名单，保障安全性
const ipcWhitelist = {
  invoke: [
    'app:win:minimize', 'app:win:maximize', 'app:win:close',
    'app:media:parse',
    'app:task:create', 'app:task:list', 'app:task:control',
    'app:settings:get', 'app:settings:set',
    'app:auth:bili:web', 'app:auth:yt:web', 'app:auth:cookie:import',
    'app:batch:bili:fav', 'app:batch:bili:series',
    'app:resource:user', 'app:resource:comments', 'app:resource:danmaku',
    'app:diag:run', 'app:log:export', 'app:log:import', 'app:log:recent',
    'app:shell:openExternal', 'app:shell:openPath', 'app:shell:showItem',
    'app:dialog:openDirectory', 'app:dialog:openFile'
  ],
  on: ['app:dnd-url', 'app:task-update'],
};

contextBridge.exposeInMainWorld('api', {
  // 调用 (渲染进程 -> 主进程)
  invoke: async (channel: string, ...args: any[]) => {
    if (ipcWhitelist.invoke.includes(channel)) {
      const { ok, data, error } = await ipcRenderer.invoke(channel, ...args);
      if (ok) return data;
      // 将主进程的错误重新抛出，以便在前端捕获
      const err = new Error(error.message);
      err.name = error.name;
      throw err;
    }
    throw new Error(`IPC 调用被拒绝：非法的通道 '${channel}'`);
  },
  // 监听 (主进程 -> 渲染进程)
  on: (channel: string, callback: (...args: any[]) => void) => {
    if (ipcWhitelist.on.includes(channel)) {
      const subscription = (_event: IpcRendererEvent, ...args: any[]) => callback(...args);
      ipcRenderer.on(channel, subscription);
      // 返回一个函数，用于在组件卸载时清理监听器
      return () => ipcRenderer.removeListener(channel, subscription);
    }
    throw new Error(`IPC 监听被拒绝：非法的通道 '${channel}'`);
  }
});

// 声明全局类型
declare global {
  interface Window {
    api: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      on: (channel: string, callback: (...args: any[]) => void) => () => void;
    };
  }
}