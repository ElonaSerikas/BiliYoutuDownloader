import fs from 'node:fs/promises';
import path from 'node:path';
import got from 'got';

export async function exportBiliComments(meta: any) {
  const bv = meta.id;
  const aid = meta.meta?.aid;
  const ps = 20;
  let page = 1;
  const all: any[] = [];

  while (page <= 5) { // MVP先抓5页，避免频率过高
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
    if (replies.length < ps) break;
    page++;
  }

  const out = path.join(meta.target, `${bv}-bili-comments.json`);
  await fs.writeFile(out, JSON.stringify(all, null, 2), 'utf-8');
  return out;
}
