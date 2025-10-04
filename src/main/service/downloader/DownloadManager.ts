import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';
import type Store from 'electron-store';
import { EventEmitter } from 'events';
import { log } from '../logger';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 任务数据结构定义
export type Task = {
  id: string; title: string; platform: 'bili' | 'yt'; target: string;
  streams: { video?: string; audio?: string; };
  status: 'queued' | 'running' | 'paused' | 'done' | 'error' | 'canceled';
  progress: { total: number; downloaded: number; speed: number };
  meta: any; settings: Record<string, any>; startedAt: number;
  updatedAt: number; outFile: string | null; error?: string;
};

export class DownloadManager extends EventEmitter {
  private tasks = new Map<string, Task>();
  private queue: string[] = [];
  private runningWorkers = new Map<string, { worker: Worker; lastProgress: { downloaded: number; ts: number } }>();
  private store: Store;

  constructor({ store }: { store: Store }) {
    super();
    this.store = store;
    this.loadTasksFromStore();
    setInterval(() => this.calculateSpeeds(), 1000); // 每秒计算一次速度
  }

  // 从本地存储加载任务
  private loadTasksFromStore() {
    const savedTasks = this.store.get('tasks', []) as Task[];
    savedTasks.forEach(t => {
      // 重启后，所有“运行中”的任务都应回到“暂停”状态
      if (t.status === 'running') {
        t.status = 'paused';
        t.progress.speed = 0;
      }
      this.tasks.set(t.id, t);
    });
  }

  // 保存任务到本地存储
  private saveTasksToStore() { this.store.set('tasks', Array.from(this.tasks.values())); }
  // 发送任务列表更新事件
  private emitUpdate() { this.emit('update', this.list()); }

  // 获取任务列表
  list() { return Array.from(this.tasks.values()).sort((a, b) => b.updatedAt - a.updatedAt); }

  // 创建新任务
  create(payload: any) {
    const id = nanoid();
    const task: Task = {
      id, ...payload, status: 'queued', progress: { total: 0, downloaded: 0, speed: 0 },
      startedAt: 0, updatedAt: Date.now(), outFile: null,
    };
    this.tasks.set(id, task);
    this.queue.push(id);
    this.saveTasksToStore();
    this._pump();
    this.emitUpdate();
    return task;
  }

  // 控制任务（暂停、继续、取消、删除）
  control(id: string, action: 'pause' | 'resume' | 'cancel' | 'delete') {
    const t = this.tasks.get(id);
    if (!t) return;
    t.updatedAt = Date.now();

    // 如果任务正在运行，先停止它
    if (this.runningWorkers.has(id)) {
      const { worker } = this.runningWorkers.get(id)!;
      worker.postMessage('abort'); // 发送中止信号
      this.runningWorkers.delete(id);
    }

    if (action === 'cancel' || action === 'pause') {
      t.status = action === 'cancel' ? 'canceled' : 'paused';
      t.progress.speed = 0;
    } else if (action === 'resume') {
      if (t.status === 'paused' || t.status === 'error') {
        t.status = 'queued';
        this.queue.unshift(id); // 优先恢复
      }
    } else if (action === 'delete') {
      this.tasks.delete(id);
    }
    
    this._pump();
    this.saveTasksToStore();
    this.emitUpdate();
    return t;
  }

  // 任务调度器
  private _pump() {
    const maxParallel = this.store.get('settings.concurrency', 4) as number;
    while (this.runningWorkers.size < maxParallel && this.queue.length > 0) {
      const id = this.queue.shift()!;
      if (this.tasks.get(id)?.status === 'queued') this._run(id);
    }
  }

  // 运行一个任务
  private _run(id: string) {
    const t = this.tasks.get(id)!;
    t.status = 'running'; t.startedAt = Date.now();
    this.emitUpdate();

    const worker = new Worker(path.resolve(__dirname, 'worker.js'), {
      workerData: { task: t, ffmpegBin: this.store.get('settings.ffmpegPath') }
    });
    this.runningWorkers.set(id, { worker, lastProgress: { downloaded: 0, ts: Date.now() } });

    worker.on('message', (m) => this.handleWorkerMessage(id, m));
    worker.on('error', (e) => this.handleWorkerExit(id, `Worker 发生错误: ${e.message}`));
    worker.on('exit', (c) => this.handleWorkerExit(id, c === 0 ? null : `Worker 异常退出，代码: ${c}`));
  }
  
  // 处理来自 Worker 的消息
  private handleWorkerMessage(id: string, m: { type: string, data: any }) {
    const t = this.tasks.get(id);
    if (!t) return;
    t.updatedAt = Date.now();
    
    if (m.type === 'progress') {
      t.progress.total = m.data.total;
      t.progress.downloaded = m.data.downloaded;
    } else if (m.type === 'done') {
      t.status = 'done';
      t.outFile = m.data.file;
      this.emit('task-complete', t);
    } else if (m.type === 'error') {
      t.status = 'error';
      t.error = m.data.message;
    }
    this.emitUpdate();
  }

  // 处理 Worker 退出
  private handleWorkerExit(id: string, error: string | null) {
    this.runningWorkers.delete(id);
    const t = this.tasks.get(id);
    if (t && t.status === 'running') { // 只有当任务还在运行时才标记为错误
      t.status = 'error';
      t.error = error || '未知 Worker 退出原因';
    }
    this.saveTasksToStore();
    this.emitUpdate();
    this._pump();
  }

  // 计算所有正在运行任务的速度
  private calculateSpeeds() {
    let updated = false;
    this.runningWorkers.forEach(({ lastProgress }, id) => {
      const t = this.tasks.get(id);
      if (t) {
        const now = Date.now();
        const dt = (now - lastProgress.ts) / 1000;
        const dBytes = t.progress.downloaded - lastProgress.downloaded;
        if (dt > 0) {
          t.progress.speed = dBytes / dt;
          this.runningWorkers.set(id, { ...this.runningWorkers.get(id)!, lastProgress: { downloaded: t.progress.downloaded, ts: now } });
          updated = true;
        }
      }
    });
    if (updated) this.emitUpdate();
  }
}