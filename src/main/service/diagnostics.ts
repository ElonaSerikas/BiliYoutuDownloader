// src/main/services/diagnostics.ts
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import AdmZip from 'adm-zip';
import got from 'got';
import { app, dialog } from 'electron';
import { getStore } from '../services/auth/store';
import { logger } from './logger';

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
  const settings = s.get('settings') || {};
  const downloadDir = settings.downloadDir || app.getPath('downloads');

  // 1) ffmpeg
  try {
    const { stdout } = await pexec('ffmpeg', ['-version'], { windowsHide: true });
    const ver = stdout.split('\n')[0].trim();
    checks.push({ id: 'ffmpeg', name: 'FFmpeg 可用', ok: true, details: ver });
  } catch (e: any) {
    checks.push({ id: 'ffmpeg', name: 'FFmpeg 可用', ok: false, details: String(e), suggestion: '请安装 FFmpeg 并加入 PATH（winget install Gyan.FFmpeg）' });
  }

  // 2) 下载目录可写
  try {
    const probe = path.join(downloadDir, `.write_test_${Date.now()}`);
    await fs.writeFile(probe, 'ok');
    await fs.unlink(probe);
    checks.push({ id: 'writable', name: '下载目录可写', ok: true, details: downloadDir });
  } catch (e: any) {
    checks.push({ id: 'writable', name: '下载目录可写', ok: false, details: String(e), suggestion: `请检查目录：${downloadDir}` });
  }

  // 3) Cookie 存在与基础校验
  const biliCookie = s.get('bili.cookie') || '';
  const ytCookie = s.get('yt.cookie') || '';
  checks.push({ id: 'cookie_bili', name: 'B站 Cookie', ok: /SESSDATA=/.test(biliCookie), details: /SESSDATA=/.test(biliCookie) ? '存在' : '缺失', suggestion: '通过“用户中心”完成登录/导入 Cookie' });
  checks.push({ id: 'cookie_yt', name: 'YouTube Cookie', ok: /SID=/.test(ytCookie.toUpperCase()) || /SAPISID=/.test(ytCookie.toUpperCase()), details: (ytCookie ? '存在' : '缺失'), suggestion: '打开 Google 登录窗口进行登录' });

  // 4) 网络连通（HEAD）
  async function ping(u: string) {
    try { await got.head(u, { timeout: { request: 6000 } }); return true; } catch { return false; }
  }
  checks.push({ id: 'net_bili', name: '网络连通（bilibili.com）', ok: await ping('https://www.bilibili.com') });
  checks.push({ id: 'net_yt', name: '网络连通（youtube.com）', ok: await ping('https://www.youtube.com') });

  // 5) 反爬/限速提示（只是风险提示）
  checks.push({ id: 'rate', name: '请求频率健康度', ok: true, details: '建议并发≤8，遇到 -412/-429 请降低并发/延时' });

  const env = {
    platform: os.platform(), arch: os.arch(), release: os.release(),
    ramGB: (os.totalmem() / (1024 ** 3)).toFixed(1),
    userData: app.getPath('userData'),
    downloadDir,
    appVersion: app.getVersion()
  };

  const okCount = checks.filter(c => c.ok).length;
  const summary = `检查 ${checks.length} 项，正常 ${okCount}，注意 ${checks.length - okCount}`;
  await logger.write('info', 'Diagnostics run', 'diag', { summary, checks, env });
  return { summary, checks, env };
}

// 导出诊断包（zip）
export async function exportDiagnosticsZip(targetPath?: string) {
  const store = getStore();
  const settings = store.get('settings') || {};
  const logsDir = path.join(app.getPath('userData'), 'logs');
  const diagDir = path.join(app.getPath('userData'), 'diagnostics');
  await fs.mkdir(diagDir, { recursive: true });

  const report = await runDiagnostics();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const zipName = `diagnostics_${stamp}.zip`;

  const zip = new AdmZip();
  // 日志
  try {
    const files = await fs.readdir(logsDir);
    for (const f of files) {
      zip.addLocalFile(path.join(logsDir, f), 'logs');
    }
  } catch {}

  // 配置与最近任务状态（若有）
  try {
    const prefsPath = path.join(app.getPath('userData'), 'prefs.json');
    zip.addLocalFile(prefsPath, 'state');
  } catch {}
  // 诊断报告 JSON
  zip.addFile('report/diagnostics.json', Buffer.from(JSON.stringify(report, null, 2)));
  // 版本标记
  zip.addFile('report/meta.txt', Buffer.from(`app=${app.getName()} v${app.getVersion()}\n`));

  const out = targetPath || path.join(diagDir, zipName);
  zip.writeZip(out);
  await logger.write('info', 'Diagnostics exported', 'diag', { out });
  return out;
}

// 导入诊断包：返回可浏览的报告与日志条目（不覆盖当前配置）
export async function importDiagnosticsZip(filePath: string) {
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries();
  const report = entries.find(e => e.entryName === 'report/diagnostics.json');
  const json = report ? JSON.parse(zip.readAsText(report)) : null;
  const logs = entries.filter(e => e.entryName.startsWith('logs/')).map(e => ({
    name: e.entryName.slice(5),
    content: zip.readAsText(e)
  }));
  await logger.write('info', 'Diagnostics imported', 'diag', { filePath, logs: logs.length, hasReport: !!json });
  return { report: json, logs };
}
