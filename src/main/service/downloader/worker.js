const { parentPort, workerData } = require('node:worker_threads');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const got = require('got');
const sanitize = require('sanitize-filename');

const { task, ffmpegBin } = workerData;
const FFMPEG = ffmpegBin || 'ffmpeg';

let isAborted = false;
parentPort?.on('message', (msg) => {
  if (msg === 'abort') {
    isAborted = true;
  }
});

function msg(type, data) { parentPort?.postMessage({ type, data }); }

function applyTpl(tpl, ctx) {
  const result = tpl.replace(/\{(\w+)\}/g, (_, k) => (ctx[k] ?? ''));
  return sanitize(result);
}

async function downloadStream(url, outPath, onProgress) {
  let totalSize = 0;
  try {
      const headRes = await got.head(url, { timeout: { request: 15000 }});
      totalSize = Number(headRes.headers['content-length'] || 0);
  } catch(e) {
      console.warn(`Failed to get size for ${url}`, e.message);
  }

  let downloaded = 0;
  try { downloaded = (await fsp.stat(outPath)).size; } catch { /* noop */ }

  if (totalSize > 0 && downloaded >= totalSize) {
    onProgress(totalSize);
    return;
  }

  const stream = got.stream(url, { headers: { Range: `bytes=${downloaded}-` }, timeout: { request: 30000 }, retry: { limit: 5 } });
  
  const abortPromise = new Promise((_, reject) => {
    parentPort?.on('message', (m) => { if (m === 'abort') { stream.destroy(); reject(new Error("任务已取消")); } });
  });

  const downloadPromise = new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(outPath, { flags: 'a' });
    stream.on('downloadProgress', p => onProgress(downloaded + p.transferred));
    stream.pipe(fileStream);
    fileStream.on('finish', () => resolve());
    stream.on('error', err => reject(new Error(`下载失败: ${err.message}`)));
    fileStream.on('error', err => reject(new Error(`写入文件失败: ${err.message}`)));
  });

  await Promise.race([downloadPromise, abortPromise]);
}

async function mux(video, audio, outPath) {
  const finalOut = outPath.replace(/\.mp4$/i, (audio && !video) ? '.m4a' : '.mp4');
  const args = ['-y'];
  if (video) args.push('-i', video);
  if (audio) args.push('-i', audio);
  args.push('-c', 'copy', '-movflags', 'faststart', finalOut);
  
  if (!video && !audio) throw new Error('没有提供有效的视频或音频流');
  if (!video || !audio) {
      const source = video || audio;
      await fsp.rename(source, finalOut);
  } else {
    await new Promise((resolve, reject) => {
      const proc = spawn(FFMPEG, args, { stdio: 'pipe' });
      proc.on('exit', code => code === 0 ? resolve() : reject(new Error(`FFmpeg 合并失败 (代码: ${code})`)));
      proc.on('error', reject);
    });
  }
  return finalOut;
}

(async function main() {
  const tmpDir = path.join(task.target, `.tmp_${task.id}`);
  await fsp.mkdir(tmpDir, { recursive: true });

  try {
    let vPath = null;
    let aPath = null;
    let totalSize = 0;
    let downloadedSize = 0;

    const streamsToDownload = [];
    if (task.streams.video) streamsToDownload.push({ type: 'video', url: task.streams.video });
    if (task.streams.audio) streamsToDownload.push({ type: 'audio', url: task.streams.audio });

    // 预计算总大小
    for(const s of streamsToDownload) {
        try {
            const headRes = await got.head(s.url);
            totalSize += Number(headRes.headers['content-length'] || 0);
        } catch {}
    }

    msg('progress', { total: totalSize, downloaded: 0 });
    
    if (task.streams.video) {
      vPath = path.join(tmpDir, 'video.mp4');
      await downloadStream(task.streams.video, vPath, (d) => {
        msg('progress', { total: totalSize, downloaded: downloadedSize + d });
      });
      if(isAborted) throw new Error("任务已取消");
      downloadedSize += (await fsp.stat(vPath)).size;
    }
    
    if (task.streams.audio) {
      aPath = path.join(tmpDir, 'audio.m4a');
      await downloadStream(task.streams.audio, aPath, (d) => {
        msg('progress', { total: totalSize, downloaded: downloadedSize + d });
      });
      if(isAborted) throw new Error("任务已取消");
    }

    const nameCtx = { title: task.title, id: task.meta?.bvid || task.id };
    const filename = applyTpl(task.settings?.filenameTpl || '{title}-{id}', nameCtx);
    const out = path.join(task.target, `${filename}.mp4`);

    const finalFile = await mux(vPath, aPath, out);
    msg('done', { file: finalFile });

  } catch (e) {
    if (!isAborted) {
        msg('error', { message: e.message });
    }
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
})();