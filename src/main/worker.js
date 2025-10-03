import { parentPort, workerData } from 'node:worker_threads';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import got from 'got';

// 从 workerData 获取任务和 FFmpeg 路径
const { task, ffmpegBin } = workerData;
const FFMPEG = ffmpegBin || 'ffmpeg';

// --- 工具函数：文件名处理 ---
function sanitizeName(s){ return (s||'media').replace(/[\\/:*?"<>|]/g,'_'); }
function applyTpl(tpl, ctx){ 
  const result = tpl.replace(/\{(\w+)\}/g, (_,k)=> (ctx[k] ?? ''));
  return sanitizeName(result); // 确保模板应用后的名称仍然是安全文件名
}

function msg(type, data){ parentPort?.postMessage({ type, data }); }

const RETRY_MAX = 5;
const TIMEOUT_MS = 30000;
const BACKOFF_BASE = 800; // ms

const SNAPSHOT_FILE = (tmp) => path.join(tmp, 'snapshot.json');

const jitter = (n)=> Math.floor(n * (1 + Math.random()*0.25));

async function safeJSONRead(file) {
  try { const s = await fsp.readFile(file, 'utf-8'); return JSON.parse(s); } catch { return null; }
}
async function safeJSONWrite(file, obj) {
  const tmp = file + '.tmp';
  await fsp.writeFile(tmp, JSON.stringify(obj, null, 2));
  await fsp.rename(tmp, file);
}

async function head(url){
  const r = await got(url, { method: 'HEAD', timeout: { request: TIMEOUT_MS }, retry: { limit: 1 } });
  const len = Number(r.headers['content-length'] || 0);
  const etag = (r.headers['etag'] || '').replace(/"/g,'');
  const lastModified = r.headers['last-modified'] || '';
  const acceptRanges = String(r.headers['accept-ranges'] || '').includes('bytes');
  return { len, etag, lastModified, acceptRanges };
}

// 续传下载函数 (使用 append 模式)
async function rangedGET(url, start, end, outPath){
  const headers = { Range: `bytes=${start}-${end}` };
  // 直接写入 outPath，使用 'a' (append) 模式
  await new Promise((resolve, reject)=>{
    const s = got.stream(url, { headers, timeout: { request: TIMEOUT_MS }, retry:{ limit:0 } });
    const f = fs.createWriteStream(outPath, { flags: 'a' }); 
    s.on('error', reject);
    s.pipe(f).on('finish', resolve);
  });
}

function splitParts(total, chunk){
  const parts = []; let start = 0, idx = 0;
  while (start < total){ const end = Math.min(total-1, start+chunk-1); parts.push({ idx, start, end, doneOffset: 0, path: '' }); start = end+1; idx++; }
  return parts;
}

async function downloadWithConcurrency(url, outDir, baseName, conc, chunkSize, snapshot){
  await fsp.mkdir(outDir, { recursive: true });

  const meta = await head(url);
  if (!meta.len) throw new Error('资源无内容长度 (Content-Length is 0)');

  let parts = snapshot?.parts;
  if (!parts || snapshot.size !== meta.len || snapshot.etag !== meta.etag || snapshot.lastModified !== meta.lastModified) {
    parts = (meta.acceptRanges ? splitParts(meta.len, chunkSize) : [{ idx:0, start:0, end: meta.len-1, doneOffset: 0, path: '' }]);
  }

  // 检查分片文件大小以确定断点
  for (const p of parts) {
    p.path = path.join(outDir, `${baseName}.part.${p.idx}`);
    try {
      const st = await fsp.stat(p.path);
      const gotBytes = st.size;
      const expTotalBytes = p.end - p.start + 1;
      
      if (gotBytes > 0 && gotBytes <= expTotalBytes) {
          p.doneOffset = gotBytes; // 记录已下载的字节数
      } else {
          // 文件不存在或大小异常，重置
          p.doneOffset = 0; 
          await fsp.unlink(p.path).catch(()=>{}); // 清理不完整/错误文件
      }
    } catch { 
        p.doneOffset = 0; 
    }
  }

  const total = meta.len;
  let downloaded = parts.reduce((a,p)=> a + p.doneOffset, 0);
  let totalDownloadedForSpeed = downloaded; // 初始值
  let lastTickTime = Date.now();

  async function pull(p){
    let tries = 0;
    while (p.doneOffset < (p.end - p.start + 1)) {
      const segStart = p.start + p.doneOffset;
      const segEnd   = p.end;
      const bytesBefore = p.doneOffset;

      try{
        await rangedGET(url, segStart, segEnd, p.path);
        
        // 成功写完该段
        const segmentBytes = (p.end - p.start + 1) - bytesBefore; 
        p.doneOffset = p.end - p.start + 1;
        
        // 更新全局进度和速度
        downloaded += segmentBytes;
        totalDownloadedForSpeed += segmentBytes;
        
        const now = Date.now();
        const dt = Math.max(1, (now - lastTickTime)/1000); 
        const speed = totalDownloadedForSpeed / dt; // 平均速度 (B/s)
        
        lastTickTime = now;
        msg('progress', { total, downloaded, speed }); 

        await safeJSONWrite(SNAPSHOT_FILE(outDir), {
          url, size: total, etag: meta.etag, lastModified: meta.lastModified, chunkSize, parts
        });
        break; // 成功后退出重试循环
      }catch(e){
        tries++;
        if (tries >= RETRY_MAX) throw e;
        
        // 发生错误后，重新检查文件大小来确定新的 doneOffset
        try {
            const st = await fsp.stat(p.path);
            p.doneOffset = st.size; // 更新断点
        } catch {
            p.doneOffset = 0;
        }

        const sleep = jitter(BACKOFF_BASE * Math.pow(2, tries));
        await new Promise(r=> setTimeout(r, Math.min(sleep, 15000)));
      }
    }
  }

  // 队列只包含尚未完成的分片
  const queue = parts.slice().filter(p=> p.doneOffset < (p.end - p.start + 1));
  const threads = Math.min(conc, Math.max(1, queue.length));
  const jobs = Array.from({length: threads}, ()=> (async ()=>{
    while(true){
      const p = queue.shift(); if (!p) break;
      await pull(p);
    }
  })());
  await Promise.all(jobs);

  // 合并分片
  const merged = path.join(outDir, `${baseName}.bin`);
  const w = fs.createWriteStream(merged);
  for (const p of parts.sort((a,b)=>a.idx-b.idx)){
    await new Promise((res, rej)=> fs.createReadStream(p.path).pipe(w, { end:false }).on('error', rej).on('end', res));
  }
  w.end();
  return { merged, meta: { ...meta, parts, chunkSize } };
}

async function mux(ffmpeg, video, audio, outPath){
  if (video && audio){
    const args = ['-y','-i',video,'-i',audio,'-c','copy','-movflags','faststart', outPath];
    await new Promise((res, rej)=> spawn(ffmpeg, args, { stdio:'ignore', windowsHide:true })
      .on('exit', c=> c===0?res():rej(new Error('ffmpeg merge fail'))));
  } else if (video) {
    await fsp.rename(video, outPath);
  } else if (audio) {
    await fsp.rename(audio, outPath.replace(/\.mp4$/i, '.m4a'));
  } else throw new Error('No video or audio input provided.');
}


(async function main(t){
  const tmp = path.join(t.target, `.tmp_${t.id || Date.now()}`);
  await fsp.mkdir(tmp, { recursive:true });

  const conc = Math.max(1, Math.min((t.settings?.concurrency||4), 16));
  const chunk = Math.max(2<<20, Math.min((t.settings?.chunkSizeMB||8)<<20, 64<<20));
  const ff = FFMPEG;

  const snapVideo = await safeJSONRead(SNAPSHOT_FILE(path.join(tmp, 'video'))) || null;
  const snapAudio = await safeJSONRead(SNAPSHOT_FILE(path.join(tmp, 'audio'))) || null;

  let v=null, a=null, metaV=null, metaA=null;
  if (t.streams.video){
    const d = await downloadWithConcurrency(t.streams.video, path.join(tmp,'video'), 'video', conc, chunk, snapVideo);
    v = d.merged; metaV = d.meta;
  }
  if (t.streams.audio){
    const d = await downloadWithConcurrency(t.streams.audio, path.join(tmp,'audio'), 'audio', conc, chunk, snapAudio);
    a = d.merged; metaA = d.meta;
  }

  // 文件命名逻辑：应用 filenameTpl
  const nameCtx = { title: t.title, id: t.id };
  const filename = applyTpl(t.settings?.filenameTpl || '{title}-{id}', { ...nameCtx });
  const outExt = a && !v ? '.m4a' : '.mp4'; 
  const out = path.join(t.target, `${filename}${outExt}`);

  await mux(ff, v, a, out);
  
  // 清理
  await fsp.rm(tmp, { recursive:true, force:true });
  msg('done', { file: out, meta: { video: metaV, audio: metaA } });
})(task).catch(e=> msg('error', { message: String(e.message || e.name || 'Worker Error') }));