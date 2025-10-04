import { spawn } from 'node:child_process';
import { getStore } from './auth/store';

export const FFMPEG_PATH = getStore().get('settings.ffmpegPath', 'ffmpeg') as string || 'ffmpeg';

export function hasFfmpeg(): Promise<boolean> {
  return new Promise((resolve) => {
    const p = spawn(FFMPEG_PATH, ['-version']);
    p.on('error', () => resolve(false));
    p.on('exit', (code) => resolve(code === 0));
  });
}