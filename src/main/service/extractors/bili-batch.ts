import got from 'got';
import path from 'node:path';
import fs from 'node:fs/promises';

const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
const H = { headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' } };
async function j(url:string){ const r=await got(url,H).json<any>(); if(r.code!==0) throw new Error(r.message); return r.data; }

// 批量分发工具：把统一 target 目录回传
export async function planBatchByFavorite(mediaId:string|number, rootDir:string){
  const name = `fav_${mediaId}`;
  const target = path.join(rootDir, name);
  await fs.mkdir(target, { recursive:true });

  let pn=1, ps=20, out:{bvid:string; title:string; target:string}[]=[];
  while(true){
    const r = await got(`https://api.bilibili.com/x/v3/fav/resource/list?media_id=${mediaId}&pn=${pn}&ps=${ps}`, H).json<any>();
    if (r.code!==0) throw new Error(r.message);
    const list = r.data?.medias || [];
    out.push(...list.map((m:any)=>({ bvid:m.bvid, title:m.title, target })));
    if (list.length < ps) break;
    pn++;
  }
  return out;
}

export async function planBatchBySeries(mid:string|number, rootDir:string){
  const data = await j(`https://api.bilibili.com/x/series/series?mid=${mid}`);
  const out:{bvid:string; title:string; target:string}[]=[];
  for (const s of data.series_list || []) {
    const d = await j(`https://api.bilibili.com/x/series/archives?mid=${mid}&series_id=${s.series_id}&only_normal=true&sort=desc`);
    const dir = path.join(rootDir, `series_${s.series_id}_${(s.name||'').replace(/[\\/:*?"<>|]/g,'_')}`);
    await fs.mkdir(dir, { recursive:true });
    out.push(...(d.archives||[]).map((a:any)=>({ bvid:a.bvid, title:a.title, target:dir })));
  }
  return out;
}
