import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import AdmZip from 'adm-zip';
import got from 'got';
import { app } from 'electron';
import { getStore } from './auth/store';
import { logger } from './logger';
import { FFMPEG_PATH } from './ffmpeg';

const pexec = promisify(execFile);

export type CheckItem = {
  id: string;
  name: string;
  ok: boolean;
  details?: string;
  suggestion?: string;
};

export async function runDiagnostics(): Promise<{ summary: string; checks: CheckItem[]; env: any }> {
  const checks: CheckItem[] = [];
  const s = getStore();
  const settings = s.get('settings') as any || {};
  const downloadDir = settings.downloadDir || app.getPath('downloads');

  try {
    const { stdout } = await pexec(FFMPEG_PATH, ['-version'], { windowsHide: true });
    const ver = stdout.split('\n')[0].trim();
    checks.push({ id: 'ffmpeg', name: 'FFmpeg 可用', ok: true, details: ver });
  } catch (e: any) {
    checks.push({ id: 'ffmpeg', name: 'FFmpeg 可用', ok: false, details: String(e), suggestion: '请安装 FFmpeg 并加入 PATH 或在设置中指定路径' });
  }

  try {
    const probe = path.join(downloadDir, `.write_test_${Date.now()}`);
    await fs.writeFile(probe, 'ok');
    await fs.unlink(probe);
    checks.push({ id: 'writable', name: '下载目录可写', ok: true, details: downloadDir });
  } catch (e: any) {
    checks.push({ id: 'writable', name: '下载目录可写', ok: false, details: String(e), suggestion: `请检查目录权限：${downloadDir}` });
  }

  const biliCookie = s.get('bili.cookie', '') as string;
  const ytCookie = s.get('yt.cookie', '') as string;
  checks.push({ id: 'cookie_bili', name: 'B站 Cookie', ok: /SESSDATA=/.test(biliCookie), details: /SESSDATA=/.test(biliCookie) ? '存在' : '缺失', suggestion: '通过“用户中心”完成登录/导入 Cookie' });
  checks.push({ id: 'cookie_yt', name: 'YouTube Cookie', ok: /SID=/.test(ytCookie.toUpperCase()) || /SAPISID=/.test(ytCookie.toUpperCase()), details: (ytCookie ? '存在' : '缺失'), suggestion: '通过“用户中心”登录Google' });

  async function ping(u: string) {
    try { await got.head(u, { timeout: { request: 8000 } }); return true; } catch { return false; }
  }
  checks.push({ id: 'net_bili', name: '网络连通（bilibili.com）', ok: await ping('https://www.bilibili.com') });
  checks.push({ id: 'net_yt', name: '网络连通（youtube.com）', ok: await ping('https://www.youtube.com') });

  const env = {
    platform: os.platform(), arch: os.arch(), release: os.release(),
    ramGB: (os.totalmem() / (1024 ** 3)).toFixed(1),
    userData: app.getPath('userData'),
    downloadDir,
    appVersion: app.getVersion()
  };

  const okCount = checks.filter(c => c.ok).length;
  const summary = `检查 ${checks.length} 项，正常 ${okCount}，异常 ${checks.length - okCount}`;
  await logger.write('info', 'Diagnostics run', 'diag', { summary, checks, env });
  return { summary, checks, env };
}

export async function exportDiagnosticsZip(targetPath?: string) {
  const logsDir = logger.dir;
  const diagDir = path.join(app.getPath('userData'), 'diagnostics');
  await fs.mkdir(diagDir, { recursive: true });

  const report = await runDiagnostics();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const zipName = `diagnostics_${stamp}.zip`;

  const zip = new AdmZip();
  try {
    const files = await fs.readdir(logsDir);
    for (const f of files) {
      if(f.startsWith('app.log')) zip.addLocalFile(path.join(logsDir, f), 'logs');
    }
  } catch {}

  try {
    const prefsPath = path.join(app.getPath('userData'), 'prefs.json');
    zip.addLocalFile(prefsPath, 'state');
  } catch {}
  zip.addFile('report/diagnostics.json', Buffer.from(JSON.stringify(report, null, 2)));
  zip.addFile('report/meta.txt', Buffer.from(`app=${app.getName()} v${app.getVersion()}\nplatform=${os.platform()}`));

  const out = targetPath || path.join(diagDir, zipName);
  zip.writeZip(out);
  await logger.write('info', 'Diagnostics exported', 'diag', { out });
  return out;
}

export async function importDiagnosticsZip(filePath: string) {
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries();
  const reportEntry = entries.find((e: any) => e.entryName === 'report/diagnostics.json');
  const json = reportEntry ? JSON.parse(zip.readAsText(reportEntry)) : null;
  const logs = entries.filter((e: any) => e.entryName.startsWith('logs/')).map((e: any) => ({
    name: e.entryName.slice(5),
    content: zip.readAsText(e)
  }));
  await logger.write('info', 'Diagnostics imported', 'diag', { filePath, logs: logs.length, hasReport: !!json });
  return { report: json, logs };
}