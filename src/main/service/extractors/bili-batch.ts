import got from 'got';
import path from 'node:path';
import fs from 'node:fs/promises';
import { getStore } from '../auth/store';
import { CookieJar, Cookie } from 'tough-cookie';

const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36';

async function getCookieJar() {
    const store = getStore();
    const jar = new CookieJar();
    const cookie = store.get('bili.cookie', '') as string;
    if(cookie) {
        // tough-cookie's setCookie requires a URL, even if the cookie string has a domain
        await jar.setCookie(cookie, 'https://www.bilibili.com');
    }
    return jar;
}

async function j(url:string, cookieJar: CookieJar){ 
    const r=await got(url,{ 
        headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' },
        cookieJar
    }).json<any>(); 
    if(r.code!==0) throw new Error(r.message || `Bilibili API Error Code: ${r.code}`); 
    return r.data; 
}

export async function planBatchByFavorite(mediaId:string|number, rootDir:string){
  const name = `fav_${mediaId}`;
  const target = path.join(rootDir, name);
  await fs.mkdir(target, { recursive:true });

  const jar = await getCookieJar();
  let pn=1, ps=20, out:{bvid:string; title:string; target:string}[]=[];
  while(true){
    const r = await got(`https://api.bilibili.com/x/v3/fav/resource/list?media_id=${mediaId}&pn=${pn}&ps=${ps}`, { 
        headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' },
        cookieJar: jar
     }).json<any>();
    if (r.code!==0) throw new Error(r.message);
    const list = r.data?.medias || [];
    out.push(...list.map((m:any)=>({ bvid:m.bvid, title:m.title, target })));
    if (!r.data.has_more) break;
    pn++;
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  return out;
}

export async function planBatchBySeries(mid:string|number, rootDir:string){
  const jar = await getCookieJar();
  const data = await j(`https://api.bilibili.com/x/series/series?mid=${mid}`, jar);
  const out:{bvid:string; title:string; target:string}[]=[];
  for (const s of data.series_list || []) {
    const d = await j(`https://api.bilibili.com/x/series/archives?mid=${mid}&series_id=${s.series_id}&only_normal=true&sort=desc&pn=1&ps=100`, jar);
    const dir = path.join(rootDir, `series_${s.series_id}_${(s.name||'').replace(/[\\/:*?"<>|]/g,'_')}`);
    await fs.mkdir(dir, { recursive:true });
    out.push(...(d.archives||[]).map((a:any)=>({ bvid:a.bvid, title:a.title, target:dir })));
  }
  return out;
}