import fs from 'node:fs/promises';
import path from 'node:path';
import got from 'got';

export async function exportBiliComments(meta: any) {
  const bv = meta.id;
  const aid = meta.meta?.aid;
  if (!aid) throw new Error("视频 aid 未找到，无法获取评论");

  const ps = 20;
  let page = 1;
  const all: any[] = [];

  while (page <= 10) { // 最多抓取10页
    const url = `https://api.bilibili.com/x/v2/reply?type=1&oid=${aid}&pn=${page}&ps=${ps}&sort=2`;
    const data = await got(url, { headers: { Referer: 'https://www.bilibili.com/' } }).json<any>();
    if (data.code !== 0) break;
    const replies = data.data?.replies || [];
    for (const r of replies) {
      all.push({
        mid: r.member?.mid, uname: r.member?.uname, ctime: r.ctime,
        message: r.content?.message, like: r.like, rpid: r.rpid
      });
    }
    if (replies.length < ps || !data.data.cursor?.has_more) break;
    page++;
    await new Promise(resolve => setTimeout(resolve, 300)); // 避免频率过高
  }

  const out = path.join(meta.target, `${bv}-bili-comments.json`);
  await fs.writeFile(out, JSON.stringify(all, null, 2), 'utf-8');
  return out;
}