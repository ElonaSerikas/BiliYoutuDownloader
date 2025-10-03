import { parentPort, workerData } from 'node:worker_threads';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import got from 'got';
import { spawn } from 'node:child_process';

type Task = typeof workerData.task;
type Part = { idx:number; start:number; end:number; done:boolean; etag?:string; path:string };

function msg(type:string, data:any){ parentPort?.postMessage({ type, data }); }

const RETRY_MAX = 5;
const TIMEOUT_MS = 30000;

async function head(url:string){
  const r = await got(url, { method: 'HEAD', timeout: { request: TIMEOUT_MS }, retry: { limit: 2 } });
  const len = Number(r.headers['content-length'] || 0);
  const etag = (r.headers['etag'] || '').replace(/"/g,'');
  const acceptRanges = String(r.headers['accept-ranges'] || '').includes('bytes');
  return { len, etag, acceptRanges };
}

async function rangedGET(url:string, start:number, end:number, outPath:string, attempt=0): Promise<void> {
  const headers:any = { Range: `bytes=${start}-${end}` };
  const tmp = outPath + '.part';
  let written = 0;
  await new Promise<void>((resolve, reject)=>{
    const s = got.stream(url, { headers, timeout: { request: TIMEOUT_MS }, retry: { limit: 0 } });
    const f = fs.createWriteStream(tmp);
    s.on('downloadProgress', p => {
      written = p.transferred || 0;
      msg('progress:chunk', { start, end, transferred: start + written });
    });
    s.on('error', err => reject(err));
    f.on('finish', ()=> resolve());
    s.pipe(f);
  });
  await fsp.rename(tmp, outPath);
}

function splitParts(total:number, chunk:number): Part[] {
  const parts:Part[] = [];
  let start = 0, idx = 0;
  while (start < total) {
    const end = Math.min(total - 1, start + chunk - 1);
    parts.push({ idx, start, end, done:false, path:'' });
    start = end + 1; idx++;
  }
  return parts;
}

async function downloadWithConcurrency(url:string, outDir:string, baseName:string, conc:number, chunkSize:number){
  await fsp.mkdir(outDir, { recursive:true });
  const { len, etag, acceptRanges } = await head(url);
  if (!len) throw new Error('资源无内容长度');
  const manifestPath = path.join(outDir, `${baseName}.manifest.json`);

  let parts:Part[] = [];
  if (acceptRanges) {
    parts = splitParts(len, chunkSize).map(p => ({ ...p, etag, path: path.join(outDir, `${baseName}.part.${p.idx}`) }));
  } else {
    // 不支持 range，退化为单文件直下
    const p = { idx:0, start:0, end:len-1, done:false, etag, path:path.join(outDir, `${baseName}.part.0`) };
    parts = [p];
  }

  // 恢复 manifest
  try {
    const old = JSON.parse(await fsp.readFile(manifestPath, 'utf-8')) as { etag?:string; parts:Part[] };
    if (!etag || old.etag === etag) {
      for (const p of old.parts) {
        const i = parts.findIndex(x=>x.idx===p.idx);
        if (i>=0 && fs.existsSync(p.path) && fs.statSync(p.path).size === (p.end-p.start+1)) parts[i] = p;
      }
    } else {
      // etag 变更，清理旧分片
      for (const p of old.parts) { if (fs.existsSync(p.path)) await fsp.unlink(p.path).catch(()=>{}); }
    }
  } catch {}

  const queue = parts.filter(p => !p.done || !fs.existsSync(p.path) || fs.statSync(p.path).size !== (p.end-p.start+1));
  let active = 0, cursor = 0, lastUpdate = 0, downloaded = parts.filter(p=>fs.existsSync(p.path)).reduce((a,p)=>a+fs.statSync(p.path).size, 0);

  async function persist(){
    await fsp.writeFile(manifestPath, JSON.stringify({ etag, parts }, null, 2), 'utf-8');
  }

  async function worker(){
    while (true) {
      const p = queue[cursor++]; if (!p) break;
      let tries = 0;
      while (tries < RETRY_MAX) {
        try {
          await rangedGET(url, p.start, p.end, p.path, tries);
          p.done = true;
          downloaded += (p.end - p.start + 1);
          const now = Date.now();
          if (now - lastUpdate > 400) {
            lastUpdate = now;
            msg('progress', { downloaded, total: len });
          }
          await persist();
          break;
        } catch (e) {
          tries++;
          const wait = Math.min(2000 * Math.pow(2, tries), 15000);
          await new Promise(r=>setTimeout(r, wait));
          if (tries >= RETRY_MAX) throw e;
        }
      }
    }
  }

  const runners:Promise<void>[] = [];
  active = Math.min(conc, queue.length);
  for (let i=0;i<active;i++) runners.push(worker());
  await Promise.all(runners);

  // 合并分片
  const merged = path.join(outDir, `${baseName}.bin`);
  const w = fs.createWriteStream(merged);
  for (const p of parts.sort((a,b)=>a.idx-b.idx)) {
    const r = fs.createReadStream(p.path);
    await new Promise<void>((res, rej)=> r.pipe(w, { end:false }).on('error', rej).on('end', res));
  }
  w.end();
  await persist();
  return { merged, total: len };
}

async function muxWithFFmpeg(video:string|null, audio:string|null, outPath:string) {
  if (video && audio) {
    const args = ['-y','-i', video, '-i', audio, '-c','copy','-movflags','faststart', outPath];
    await new Promise<void>((res, rej)=>spawn('ffmpeg', args, { stdio:'ignore' }).on('exit', c=>c===0?res():rej(new Error('ffmpeg merge fail'))));
  } else if (video) {
    await fsp.rename(video, outPath);
  } else if (audio) {
    await fsp.rename(audio, outPath.replace(/\.mp4$/i,'.m4a'));
  } else {
    throw new Error('no input');
  }
}

(async function main(task: Task){
  const { streams, target, title, id, settings } = task;
  const base = (title || id || 'media').replace(/[\\/:*?"<>|]/g,'_');
  const tmp = path.join(target, `.tmp_${id || Date.now()}`);
  await fsp.mkdir(tmp, { recursive:true });

  const conc = Math.max(1, Math.min( (settings?.concurrency || 8), 16 ));
  const chunk = Math.max(2<<20, Math.min((settings?.chunkSizeMB || 8)<<20, 64<<20)); // 2MB..64MB

  let videoBin:string|null = null, audioBin:string|null = null;

  if (streams.video) {
    const { merged } = await downloadWithConcurrency(streams.video, tmp, 'video', conc, chunk);
    videoBin = merged;
  }
  if (streams.audio) {
    const { merged } = await downloadWithConcurrency(streams.audio, tmp, 'audio', conc, chunk);
    audioBin = merged;
  }

  const outPath = path.join(target, `${base}-${id || 'x'}.mp4`);
  await muxWithFFmpeg(videoBin, audioBin, outPath);

  // 清理
  await fsp.rm(tmp, { recursive:true, force:true });
  msg('done', { file: outPath });
})(workerData.task).catch(e=> msg('error', { message: String(e) }));
