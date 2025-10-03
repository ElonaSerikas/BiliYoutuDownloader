import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { nanoid } from 'nanoid';
import fs from 'node:fs/promises';

export class DownloadManager {
  constructor({ log, ffmpegBin, store }){
    this.tasks = new Map();
    this.log = log || ((..._x)=>{});
    this.ffmpegBin = ffmpegBin; 
    this.store = store;
    this.maxParallel = Math.max(1, Math.min(this.store.get('settings')?.concurrency ?? 4, 10));
    this.running = new Set();
    this.queue = [];
  }

  list(){ return Array.from(this.tasks.values()); }
  meta(id){ return this.tasks.get(id); }

  async create(payload){
    const id = payload.id || nanoid();
    const t = {
      id,
      title: payload.title,
      platform: payload.platform,
      target: payload.target,
      streams: payload.streams,   
      meta: payload.meta,
      status: 'queued',
      progress: { total: 0, downloaded: 0, speed: 0 },
      settings: payload.settings || {},
      startedAt: 0, updatedAt: 0,
      outFile: null,
    };
    this.tasks.set(id, t);
    this.queue.push(id);
    this._pump();
    return t;
  }

  control(id, action){
    const t = this.tasks.get(id); if (!t) return;
    if (action==='cancel') { t.status='canceled'; t.updatedAt = Date.now(); }
    if (action==='pause')  { t.status='paused';  t.updatedAt = Date.now(); }
    if (action==='resume') { 
      if (t.status==='paused') { t.status='queued'; this.queue.push(id); this._pump(); } 
      else if (t.status==='queued') { this._pump(); }
    }
    return t;
  }

  _pump(){
    this.maxParallel = Math.max(1, Math.min(this.store.get('settings')?.concurrency ?? 4, 10));
    while (this.running.size < this.maxParallel) {
      const id = this.queue.shift(); if (!id) break;
      const t = this.tasks.get(id); if (!t || t.status!=='queued') continue;
      this._run(id);
    }
  }

  _run(id){
    const t = this.tasks.get(id); if (!t) return;
    t.status='running'; t.startedAt = Date.now(); t.updatedAt = Date.now();
    this.running.add(id);

    const worker = new Worker(path.join(path.dirname(import.meta.url).replace('file://', ''), 'worker.js'), {
      workerData: { task: t, ffmpegBin: this.ffmpegBin() },
      type: 'module'
    });

    worker.on('message', (m)=>{
      if (m.type==='progress'){
        t.progress.total = m.data.total ?? t.progress.total;
        t.progress.downloaded = m.data.downloaded ?? t.progress.downloaded;
        t.progress.speed = m.data.speed ?? t.progress.speed; 
        t.updatedAt = Date.now();
      }
      if (m.type==='done'){
        t.status='done'; t.updatedAt = Date.now();
        t.outFile = m.data.file; 
      }
      if (m.type==='error'){
        t.status='error'; t.updatedAt = Date.now();
        this.log('error','worker', m.data);
      }
    });

    worker.on('error', (e)=>{ t.status='error'; t.updatedAt=Date.now(); this.log('error','worker', String(e)); });
    worker.on('exit', (c)=>{ 
      this.running.delete(id);
      if (c!==0 && t.status!=='done' && t.status!=='canceled') t.status='error';
      this._pump();
    });
  }
}