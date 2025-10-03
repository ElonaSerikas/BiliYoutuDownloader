import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import dayjs from 'dayjs';
import sanitize from 'sanitize-filename';

export async function ensureDir(p: string) {
  await fsp.mkdir(p, { recursive: true });
}

export function safeJoin(dir: string, name: string) {
  return path.join(dir, sanitize(name));
}

export function tplName(tpl: string, ctx: Record<string,string|number|undefined>) {
  return sanitize(Object.keys(ctx).reduce((s,k)=> s.replaceAll(`{${k}}`, String(ctx[k] ?? '')), tpl));
}

export async function writeJSON(p: string, obj: any) {
  await fsp.writeFile(p, JSON.stringify(obj, null, 2), 'utf-8');
}

export async function exists(p: string) {
  try { await fsp.access(p); return true; } catch { return false; }
}

export function tsNow() { return dayjs().format('YYYYMMDD-HHmmss'); }
