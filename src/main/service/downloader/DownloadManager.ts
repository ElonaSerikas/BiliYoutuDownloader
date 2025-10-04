import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';
import type Store from 'electron-store';
import { EventEmitter } from 'events';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type Task = {
  id: string;
  title: string;
  platform: 'bili' | 'yt';
  target: string;
  streams: { video?: string; audio?: string; };
  status: 'queued' | 'running' | 'paused' | 'done' | 'error' | 'canceled';
  progress: { total: number; downloaded: number; speed: number };
  meta: any;
  settings: Record<string, any>;
  startedAt: number;
  updatedAt: number;
  outFile: string | null;
  error?: string;
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
    setInterval(() => this.calculateSpeeds(), 1000);
  }

  private loadTasksFromStore() {
    const savedTasks = this.store.get('tasks', []) as Task[];
    savedTasks.forEach(t => {
      if (t.status === 'running') {
        t.status = 'paused';
        t.progress.speed = 0;
      }
      this.tasks.set(t.id, t);
    });
  }

  private saveTasksToStore() { this.store.set('tasks', Array.from(this.tasks.values())); }
  private emitUpdate() { this.emit('update', this.list()); }

  list() { return Array.from(this.tasks.values()).sort((a, b) => b.updatedAt - a.updatedAt); }

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

  control(id: string, action: 'pause' | 'resume' | 'cancel' | 'delete') {
    const t = this.tasks.get(id);
    if (!t) return;
    t.updatedAt = Date.now();

    if (this.runningWorkers.has(id)) {
      const { worker } = this.runningWorkers.get(id)!;
      worker.postMessage('abort');
      this.runningWorkers.delete(id);
    }

    if (action === 'cancel' || action === 'pause') {
      t.status = action === 'cancel' ? 'canceled' : 'paused';
      t.progress.speed = 0;
    } else if (action === 'resume') {
      if (t.status === 'paused' || t.status === 'error') {
        t.status = 'queued';
        this.queue.unshift(id);
      }
    } else if (action === 'delete') {
      this.tasks.delete(id);
    }
    
    this._pump();
    this.saveTasksToStore();
    this.emitUpdate();
    return t;
  }

  private _pump() {
    const maxParallel = this.store.get('settings.concurrency', 4) as number;
    while (this.runningWorkers.size < maxParallel && this.queue.length > 0) {
      const id = this.queue.shift()!;
      if (this.tasks.get(id)?.status === 'queued') this._run(id);
    }
  }

  private _run(id: string) {
    const t = this.tasks.get(id)!;
    t.status = 'running'; t.startedAt = Date.now();
    this.emitUpdate();

    const worker = new Worker(path.resolve(__dirname, 'worker.js'), {
      workerData: { task: t, ffmpegBin: this.store.get('settings.ffmpegPath') }
    });
    this.runningWorkers.set(id, { worker, lastProgress: { downloaded: t.progress.downloaded, ts: Date.now() } });

    worker.on('message', (m) => this.handleWorkerMessage(id, m));
    worker.on('error', (e) => this.handleWorkerExit(id, `Worker 发生错误: ${e.message}`));
    worker.on('exit', (c) => this.handleWorkerExit(id, c === 0 ? null : `Worker 异常退出，代码: ${c}`));
  }
  
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

  private handleWorkerExit(id: string, error: string | null) {
    this.runningWorkers.delete(id);
    const t = this.tasks.get(id);
    if (t && t.status === 'running') {
      t.status = 'error';
      t.error = error || '未知 Worker 退出原因';
    }
    this.saveTasksToStore();
    this.emitUpdate();
    this._pump();
  }

  private calculateSpeeds() {
    let updated = false;
    this.runningWorkers.forEach(({ lastProgress }, id) => {
      const t = this.tasks.get(id);
      if (t) {
        const now = Date.now();
        const dt = (now - lastProgress.ts) / 1000;
        const dBytes = t.progress.downloaded - lastProgress.downloaded;
        if (dt > 0.5) {
          t.progress.speed = dBytes / dt;
          this.runningWorkers.set(id, { ...this.runningWorkers.get(id)!, lastProgress: { downloaded: t.progress.downloaded, ts: now } });
          updated = true;
        }
      }
    });
    if (updated) this.emitUpdate();
  }
}