import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// 定义任务类型 (包含前面步骤添加的字段)
interface Task {
  taskId: string;
  url: string;
  title: string;
  quality: string;
  size: string;
  thumbnail: string;
  downloadOptions: {
    danmaku: boolean;
    assDanmaku: boolean;
    cover: boolean;
    comments: boolean;
    uploaderInfo: boolean;
  }
  encoding: string;
  isPrivileged: boolean;
  videoInfo: any; // 存储完整的视频信息用于主进程启动任务
  
  progress?: number; // 仅下载中任务有
  speed?: string; // 仅下载中任务有
  path?: string; // 仅已完成任务有
}

// 初始状态
const initialState = {
  pending: [] as Task[], // 待下载
  downloading: [] as Task[], // 下载中
  completed: [] as Task[] // 已完成
};

// 异步操作：开始下载（调用主进程API）
export const startTask = createAsyncThunk(
  'tasks/start',
  async (taskId: string, { getState }) => {
    const { tasks } = getState() as { tasks: typeof initialState };
    const task = tasks.pending.find(t => t.taskId === taskId);
    if (!task) throw new Error('任务不存在');
    
    // 调用Electron主进程的下载API
    await window.electron.startDownload(task); 
    return taskId;
  }
);

// 任务切片
const taskSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {
    // 添加任务到待下载列表
    addTask: (state, action) => {
      const task: Task = {
        ...action.payload,
        taskId: Date.now().toString() // 生成唯一ID
      };
      state.pending.push(task);
    },
    // 暂停任务
    pauseTask: (state, action) => {
      const taskId = action.payload;
      
      // 1. 调用主进程API，通知下载核心暂停
      window.electron.pauseDownload(taskId);

      const task = state.downloading.find(t => t.taskId === taskId);
      if (task) {
        // 2. 从下载中移回待下载
        state.downloading = state.downloading.filter(t => t.taskId !== taskId);
        // 3. 重置进度相关信息，并将其移入待下载列表
        state.pending.push({ 
          ...task, 
          progress: undefined, 
          speed: undefined 
        });
      }
    },
    // 取消任务
    cancelTask: (state, action) => {
      const taskId = action.payload;

      // 1. 调用主进程API，通知下载核心取消/终止
      window.electron.cancelDownload(taskId);
      
      // 2. 从下载中移除
      state.downloading = state.downloading.filter(t => t.taskId !== taskId);
      // 3. 从待下载中移除 (以防任务尚未开始就被取消)
      state.pending = state.pending.filter(t => t.taskId !== taskId);
    },
    // 删除任务 (仅删除记录)
    deleteTask: (state, action) => {
      const taskId = action.payload;
      state.pending = state.pending.filter(t => t.taskId !== taskId);
      state.completed = state.completed.filter(t => t.taskId !== taskId);
    },
    // 更新下载进度
    updateProgress: (state, action) => {
      const { taskId, progress, speed } = action.payload;
      const task = state.downloading.find(t => t.taskId === taskId);
      if (task) {
        task.progress = progress;
        task.speed = speed;
      } else {
        // 首次进度更新：从待下载移到下载中
        const pendingTask = state.pending.find(t => t.taskId === taskId);
        if (pendingTask) {
          state.pending = state.pending.filter(t => t.taskId !== taskId);
          state.downloading.push({ ...pendingTask, progress, speed });
        }
      }
    },
    // 下载完成
    completeTask: (state, action) => {
      const { taskId, path } = action.payload;
      const task = state.downloading.find(t => t.taskId === taskId);
      if (task) {
        state.downloading = state.downloading.filter(t => t.taskId !== taskId);
        state.completed.push({ ...task, progress: 100, path });
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(startTask.fulfilled, (state, action) => {
        // 任务启动成功，等待进度更新来将其移到 downloading 列表
      });
  }
});

export const { addTask, pauseTask, cancelTask, deleteTask, updateProgress, completeTask } = taskSlice.actions;
export default taskSlice.reducer;