// bili-danmaku.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import got from 'got';
import { buildASS } from './ass';

export type DanStyle = {
  width:number; height:number; fps:number;
  fontName:string; fontSize:number; outline:number; shadow:number; opacity:number;
  scrollDuration:number; staticDuration:number; trackHeight:number;
};

const DEFAULT:DanStyle = {
  width:3840, height:2160, fps:120,
  fontName:'Microsoft YaHei', fontSize:42, outline:3, shadow:0, opacity:0,
  scrollDuration:8.0, staticDuration:4.5, trackHeight:48
};

export async function exportBiliDanmaku(meta:any, fmt:'xml'|'ass', style?:Partial<DanStyle>){
  const cfg = { ...DEFAULT, ...(style||{}) };
  const cid = meta.meta?.cid; if (!cid) throw new Error('缺少 cid');

  const url = `https://api.bilibili.com/x/v1/dm/list.so?oid=${cid}`;
  const xml = await got(url, { headers: { Referer:'https://www.bilibili.com/' } }).text();

  const base = path.join(meta.target, meta.id);
  const xmlPath = `${base}-danmaku.xml`;
  await fs.writeFile(xmlPath, xml, 'utf-8');
  if (fmt==='xml') return xmlPath;

  const events = parseXML(xml);
  const ass = buildASS({ title: meta.title || meta.id, style: cfg, events });
  const assPath = `${base}-danmaku.ass`;
  await fs.writeFile(assPath, ass, 'utf-8');
  return assPath;
}

function parseXML(xml:string){
  const out:{ t:number; mode:number; size:number; color:number; text:string }[] = [];
  const re = /<d\s+p="([^"]+)">([\s\S]*?)<\/d>/g;
  let m:RegExpExecArray|null;
  while((m=re.exec(xml))){
    const p = m[1].split(',');
    out.push({
      t:parseFloat(p[0]), mode:+p[1], size:+p[2], color:+p[3],
      text:m[2].replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    });
  }
  return out.sort((a,b)=>a.t-b.t);
}
