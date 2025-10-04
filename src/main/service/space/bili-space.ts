import got from 'got';
import fs from 'node:fs/promises';
import path from 'node:path';

const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
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

export async function downloadUserCard(mid:string|number, outDir:string){
  const card = await getUserCard(mid);
  if (!card) throw new Error('无法获取 UP 主信息');
  
  const baseName = `${card.name}_${card.mid}`.replace(/[\\/:*?"<>|]/g,'_');
  await fs.mkdir(outDir, { recursive: true });

  const faceUrl = card.face;
  const faceExt = path.extname(faceUrl.split('?')[0]) || '.jpg';
  const facePath = path.join(outDir, `${baseName}-face${faceExt}`);
  
  const faceBuffer = await got(faceUrl.split('?')[0], { responseType: 'buffer' }).buffer().catch(()=>null);
  if (faceBuffer) await fs.writeFile(facePath, faceBuffer);

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