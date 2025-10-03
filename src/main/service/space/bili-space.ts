import got from 'got';
import fs from 'node:fs/promises';
import path from 'node:path';

const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
const H = { headers: { 'User-Agent': UA, Referer: 'https://space.bilibili.com' } };

async function j(url:string){ const r = await got(url, H).json<any>(); if (r.code!==0) throw new Error(r.message); return r.data; }

export async function getUserCard(mid:string|number){
  const [info, stat] = await Promise.all([
    j(`https://api.bilibili.com/x/space/acc/info?mid=${mid}`),
    j(`https://api.bilibili.com/x/relation/stat?vmid=${mid}`)
  ]);
  return {
    mid: String(mid),
    name: info?.name, face: info?.face, sign: info?.sign,
    level: info?.level, vip: info?.vip?.vipStatus===1,
    fans: stat?.follower, following: stat?.following
  };
}

// 新增：下载 UP 主头像和信息
export async function downloadUserCard(mid:string|number, outDir:string){
  const card = await getUserCard(mid);
  if (!card) throw new Error('无法获取 UP 主信息');
  
  const baseName = `${card.name}_${card.mid}`.replace(/[\\/:*?"<>|]/g,'_');
  await fs.mkdir(outDir, { recursive: true });

  // 1. 下载头像
  const faceUrl = card.face;
  // B站头像通常没有后缀，这里统一处理成 .jpg
  const faceExt = path.extname(faceUrl.split('?')[0]) || '.jpg';
  const facePath = path.join(outDir, `${baseName}-face${faceExt}`);
  
  const faceBuffer = await got(faceUrl.split('?')[0], { responseType: 'buffer' }).catch(()=>null);
  if (faceBuffer) await fs.writeFile(facePath, faceBuffer);

  // 2. 写入 JSON 简介
  const jsonPath = path.join(outDir, `${baseName}-info.json`);
  const info = {
    mid: card.mid,
    name: card.name,
    sign: card.sign,
    level: card.level,
    fans: card.fans,
    following: card.following,
    faceFile: faceBuffer ? path.basename(facePath) : '未下载或下载失败'
  };
  await fs.writeFile(jsonPath, JSON.stringify(info, null, 2), 'utf-8');

  return { mid: card.mid, name: card.name, infoPath: jsonPath, facePath: faceBuffer ? facePath : null };
}

export async function listVideos(mid:string|number, pn=1, ps=30, order:'pubdate'|'click'|'stow'='pubdate'){
  const data = await j(`https://api.bilibili.com/x/space/arc/search?mid=${mid}&pn=${pn}&ps=${ps}&order=${order}`);
  const list = data?.list?.vlist || [];
  return list.map((x:any)=>({ bvid:x.bvid, title:x.title, length:x.length, created:x.created, play:x.play, comment:x.comment }));
}

export async function listSeries(mid:string|number){
  const data = await j(`https://api.bilibili.com/x/series/series?mid=${mid}`);
  const arr = data?.series_list || [];
  const out = [];
  for (const s of arr) {
    const d = await j(`https://api.bilibili.com/x/series/archives?mid=${mid}&series_id=${s.series_id}&only_normal=true&sort=desc`);
    const bvids = (d?.archives||[]).map((a:any)=>({ bvid:a.bvid, title:a.title }));
    out.push({ series_id: s.series_id, title: s.name, count: s.archives_count, list: bvids });
  }
  return out;
}

export async function listArticles(mid:string|number, pn=1, ps=30){
  const d = await j(`https://api.bilibili.com/x/space/article?mid=${mid}&pn=${pn}&ps=${ps}&sort=publish_time`);
  return (d?.articles||[]).map((x:any)=>({ id:x.id, title:x.title, view:x.stats?.view, like:x.stats?.like, publish_time:x.publish_time }));
}

export async function listAlbums(mid:string|number, pn=1, ps=30){
  const d = await j(`https://api.bilibili.com/x/dynamic/feed/draw/doc_list?uid=${mid}&page_num=${pn}&page_size=${ps}`);
  return (d?.items||[]).map((x:any)=>({
    doc_id:x.doc_id,
    title:x.title || '',
    pics:(x.pictures||[]).map((p:any)=>p.img_src)
  }));
}

export async function getPinned(mid:string|number){
  // 置顶视频（若有）
  try {
    const d = await j(`https://api.bilibili.com/x/space/top/arc?vmid=${mid}`);
    if (d?.aid) return { bvid: d.bvid, title: d.title };
  } catch {}

}