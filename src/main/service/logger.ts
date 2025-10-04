import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogItem = { ts: string; level: LogLevel; tag?: string; msg: string; data?: any };

const LOG_DIR = path.join(app.getPath('userData'), 'logs');
const FILE_BASE = 'app.log';
const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const KEEP = 5;

function stamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

async function rotateIfNeeded(filePath: string) {
  try {
    const st = await fsp.stat(filePath);
    if (st.size < MAX_SIZE) return;
  } catch { return; }

  for (let i = KEEP - 1; i >= 0; i--) {
    const src = i === 0 ? filePath : `${filePath}.${i}`;
    const dst = `${filePath}.${i + 1}`;
    if (fs.existsSync(src)) await fsp.rename(src, dst).catch(() => {});
  }
}

export class AppLogger {
  private stream: fs.WriteStream;
  private file: string;

  constructor() {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    this.file = path.join(LOG_DIR, FILE_BASE);
    this.stream = fs.createWriteStream(this.file, { flags: 'a' });
  }

  get dir() { return LOG_DIR; }

  async write(level: LogLevel, msg: string, tag?: string, data?: any) {
    const rec: LogItem = { ts: stamp(), level, tag, msg, data };
    const line = JSON.stringify(rec) + '\n';
    if(this.stream.writable) {
        this.stream.write(line);
    }
    await rotateIfNeeded(this.file);
  }

  async readRecent(lines = 2000) {
    try {
        const buf = await fsp.readFile(this.file, 'utf-8');
        const arr = buf.trim().split('\n');
        return arr.slice(-lines).map(l => { try { return JSON.parse(l); } catch { return l; } });
    } catch {
        return [];
    }
  }
}

export const logger = new AppLogger();

export const log = {
  debug: (m: string, t?: string, d?: any) => logger.write('debug', m, t, d),
  info:  (m: string, t?: string, d?: any) => logger.write('info',  m, t, d),
  warn:  (m: string, t?: string, d?: any) => logger.write('warn',  m, t, d),
  error: (m: string, t?: string, d?: any) => logger.write('error', m, t, d),
};