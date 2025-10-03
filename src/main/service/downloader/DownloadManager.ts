import fs from 'node:fs';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { nanoid } from 'nanoid';

type Task = {
  id: string;
  platform: 'bili'|'yt';
  title: string;
  target: string;     // 保存目录
  streams: { video?: string; audio?: string; container?: string };
  status: 'queued'|'running'|'paused'|'done'|'error'|'canceled';
  progress: { total: number; downloaded: number; speed: number };
  meta: any;
};

export class DownloadManager {
  private tasks = new Map<string, Task>();

  list() { return Array.from(this.tasks.values()); }
  meta(id: string) { return this.tasks.get(id); }

  async create(payload: any) {
    const id = nanoid();
    const task: Task = {
      id,
      platform: payload.platform,
      title: payload.title,
      target: payload.target,
      streams: payload.streams,
      status: 'queued',
      progress: { total: 0, downloaded: 0, speed: 0 },
      meta: payload.meta
    };
    this.tasks.set(id, task);
    this.run(id);
    return task;
  }

  control(id: string, action: 'pause'|'resume'|'cancel') {
    const t = this.tasks.get(id);
    if (!t) return;
    // 简化：通过标记交由 worker 响应（真实实现里可用 shared memory / message）
    t.status = action === 'pause' ? 'paused' : (action === 'cancel' ? 'canceled' : 'running');
    return t;
  }

  private run(id: string) {
    const t = this.tasks.get(id);
    if (!t) return;
    t.status = 'running';

    const worker = new Worker(new URL('./workers/segmentWorker.ts', import.meta.url), {
      workerData: { id, task: t }
    });

    worker.on('message', (msg) => {
      if (msg.type === 'progress') {
        t.progress = msg.data;
      } else if (msg.type === 'done') {
        t.status = 'done';
      } else if (msg.type === 'error') {
        t.status = 'error';
      }
    });
    worker.on('error', () => { t!.status = 'error'; });
    worker.on('exit', (code) => {
      if (code !== 0 && t && t.status !== 'canceled') t.status = 'error';
    });
  }
}
