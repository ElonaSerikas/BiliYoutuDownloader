import { spawn } from 'node:child_process';
import path from 'node:path';
import { existsSync } from 'node:fs';

export const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';

export function hasFfmpeg(): Promise<boolean> {
  return new Promise((resolve) => {
    const p = spawn(FFMPEG_PATH, ['-version']);
    p.on('error', () => resolve(false));
    p.on('exit', (code) => resolve(code === 0));
  });
}

/** mp4/mkv 合并音视频（不重编码） */
export async function muxAV(opts: {
  video?: string; audio?: string; out: string; container?: 'mp4'|'mkv';
}) {
  const args = ['-y'];
  if (opts.video) { args.push('-i', opts.video); }
  if (opts.audio) { args.push('-i', opts.audio); }
  // copy 流，最快
  args.push('-c:v', 'copy', '-c:a', 'copy', opts.out);
  await runFfmpeg(args);
}

/** 录制直播流（FLV/HLS 通吃），可追加到同一文件（断电续写） */
export async function recordStream(inputUrl: string, outFile: string, seconds?: number) {
  const args = ['-y', '-rw_timeout', '15000000', '-timeout', '15000000', '-i', inputUrl, '-c', 'copy', '-f', 'flv', outFile];
  if (seconds && seconds > 0) args.splice(1, 0, '-t', String(seconds));
  await runFfmpeg(args);
}

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const p = spawn(FFMPEG_PATH, args, { windowsHide: true });
    let stderr = '';
    p.stderr.on('data', (d) => { stderr += String(d); });
    p.on('error', reject);
    p.on('exit', (code) => code === 0 ? resolve() : reject(new Error(stderr || `ffmpeg exit ${code}`)));
  });
}
