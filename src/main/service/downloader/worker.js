import { parentPort, workerData } from 'node:worker_threads';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import got from 'got';
import sanitize from 'sanitize-filename';
import type { Task } from './DownloadManager';

// --- 类型与初始化 ---
const { task, ffmpegBin } = workerData as { task: Task; ffmpegBin: string };
const FFMPEG = ffmpegBin || 'ffmpeg';
let isAborted = false;

parentPort?.on('message', (msg) => {
  if (msg === 'abort') {
    isAborted = true;
  }
});

// --- 工具函数 ---
function msg(type: 'progress' | 'done' | 'error', data: any) { parentPort?.postMessage({ type, data }); }
function applyTpl(tpl: string, ctx: Record<string, any>) {
  const result = tpl.replace(/\{(\w+)\}/g, (_, k) => (ctx[k] ?? ''));
  return sanitize(result);
}

// --- 下载核心 ---
async function downloadStream(url: string, outPath: string, onProgress: (chunk: number) => void) {
  const { len } = await got.head(url).then(res => ({ len: Number(res.headers['content-length'] || 0) }));
  let downloaded = 0;
  try { downloaded = (await fsp.stat(outPath)).size; } catch { /* 文件不存在 */ }

  if (downloaded >= len) {
    onProgress(len);
    return;
  }

  const stream = got.stream(url, { headers: { Range: `bytes=${downloaded}-` }, timeout: { request: 30000 }, retry: { limit: 5 } });
  
  const abortPromise = new Promise((_, reject) => {
    parentPort?.on('message', (m) => { if (m === 'abort') { stream.destroy(); reject(new Error("任务已取消")); } });
  });

  const downloadPromise = new Promise<void>((resolve, reject) => {
    const fileStream = fs.createWriteStream(outPath, { flags: 'a' });
    stream.on('downloadProgress', p => onProgress(downloaded + p.transferred));
    stream.pipe(fileStream);
    fileStream.on('finish', () => resolve());
    stream.on('error', err => reject(new Error(`下载失败: ${err.message}`)));
    fileStream.on('error', err => reject(new Error(`写入文件失败: ${err.message}`)));
  });

  await Promise.race([downloadPromise, abortPromise]);
}

// --- FFmpeg 合并 ---
async function mux(video: string | null, audio: string | null, outPath: string) {
  const finalOut = outPath.replace(/\.mp4$/i, (audio && !video) ? '.m4a' : '.mp4');
  if (video && audio) {
    const args = ['-y', '-i', video, '-i', audio, '-c', 'copy', '-movflags', 'faststart', finalOut];
    await new Promise<void>((res, rej) => spawn(FFFMPEG, args, { stdio: 'ignore' }).on('exit', c => c === 0 ? res() : rej(new Error(`FFmpeg 合并失败 (代码: ${c})`))));
  } else if (video) {
    await fsp.rename(video, finalOut);
  } else if (audio) {
    await fsp.rename(audio, finalOut);
  } else {
    throw new Error('没有提供有效的视频或音频流');
  }
  return finalOut;
}

// --- 主执行函数 ---
(async function main() {
  const tmpDir = path.join(task.target, `.tmp_${task.id}`);
  await fsp.mkdir(tmpDir, { recursive: true });

  try {
    let vPath: string | null = null;
    let aPath: string | null = null;
    let totalSize = 0;
    let totalDownloaded = 0;

    const streamsToDownload: { type: 'video' | 'audio', url: string }[] = [];
    if (task.streams.video) streamsToDownload.push({ type: 'video', url: task.streams.video });
    if (task.streams.audio) streamsToDownload.push({ type: 'audio', url: task.streams.audio });

    // 首先获取所有流的总大小
    await Promise.all(streamsToDownload.map(async s => {
      const { len } = await got.head(s.url).then(res => ({ len: Number(res.headers['content-length'] || 0) }));
      totalSize += len;
    }));

    msg('progress', { total: totalSize, downloaded: totalDownloaded });

    // 依次下载
    if (task.streams.video) {
      vPath = path.join(tmpDir, 'video.mp4');
      await downloadStream(task.streams.video, vPath, (d) => {
        msg('progress', { total: totalSize, downloaded: totalDownloaded + d });
      });
      totalDownloaded += (await fsp.stat(vPath)).size;
    }
    if (isAborted) return;
    if (task.streams.audio) {
      aPath = path.join(tmpDir, 'audio.m4a');
      await downloadStream(task.streams.audio, aPath, (d) => {
        msg('progress', { total: totalSize, downloaded: totalDownloaded + d });
      });
    }

    if (isAborted) return;

    // 应用文件名模板
    const nameCtx = { title: task.title, id: task.meta?.bvid || task.id };
    const filename = applyTpl(task.settings?.filenameTpl || '{title}-{id}', nameCtx);
    const out = path.join(task.target, `${filename}.mp4`);

    const finalFile = await mux(vPath, aPath, out);

    msg('done', { file: finalFile });
  } catch (e: any) {
    if (e.message !== "任务已取消") {
        msg('error', { message: e.message });
    }
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
})();