import got from 'got';
import { CookieJar } from 'tough-cookie';
import type { ParseResult, StreamInfo } from './types';

type Store = { get:(k:string)=>any };

const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const ORIGIN='https://www.bilibili.com'; const REFERER=ORIGIN+'/';

function codecName(codecs?:string){ return codecs?.split('.')[0] || ''; } // av01/hev1/avc1

// 修改：新增 duration 参数用于估算文件大小
function buildStreams(dash:any, duration:number):StreamInfo[]{
  const out:StreamInfo[]=[];
  for (const v of dash?.video||[]){
    const codec = codecName(v.codecs);
    const label = `${v.width}x${v.height}${v.frameRate?('@'+v.frameRate):''}`;
    const extras:any = {};
    if (v.new_extra_info?.hdr10) extras.hdr='HDR10';           /* NEW */
    if (v.new_extra_info?.hdr10plus) extras.hdr='HDR10+';      /* NEW */
    if (v.new_extra_info?.dolby_vision) extras.dovi=true;      /* NEW */
    
    // 计算视频流大小估算：时长(s) * 码率(bps) / 8 (bits/byte)
    const sizeEstimate = duration && v.bandwidth ? Math.floor(duration * v.bandwidth / 8) : undefined;
    
    out.push({
      id:`v_${v.id}_${v.codecid}`, type:'video', container:'mp4',
      codec, qualityLabel:label, bitrate:v.bandwidth, fps:Number(v.frameRate?.split('/')?.[0])||undefined,
      sizeEstimate, // <--- 新增
      url: v.baseUrl || v.base_url || v.backupUrl?.[0] || v.backup_url?.[0],
      // @ts-ignore
      extras
    } as any);
  }
  for (const a of dash?.audio||[]){
    // 计算音频流大小估算
    const sizeEstimate = duration && a.bandwidth ? Math.floor(duration * a.bandwidth / 8) : undefined;
    
    out.push({
      id:`a_${a.id}_${a.codecid}`, type:'audio', container:'m4a',
      codec: a.codecs || 'aac', bitrate:a.bandwidth,
      sizeEstimate, // <--- 新增
      url: a.baseUrl || a.base_url || a.backupUrl?.[0] || a.backup_url?.[0]
    });
  }
  return out;
}

export const biliExtractor = {
  async parse(url:string, store:Store): Promise<ParseResult>{
    const jar = new CookieJar();
    const cookie = store.get('bili.cookie') || '';
    if (cookie) await jar.setCookie(cookie, ORIGIN);

    const real = /b23\.tv/.test(url) ? (await got(url, { followRedirect:false })).headers['location'] as string || url : url;
    const bv = (real.match(/BV\w+/)||[])[0]; if(!bv) throw new Error('未识别到BV号');

    const view = await got(`https://api.bilibili.com/x/web-interface/view?bvid=${bv}`, {
      headers:{ 'User-Agent':UA, Origin:ORIGIN, Referer:REFERER }, cookieJar: jar
    }).json<any>();
    if (view.code!==0) throw new Error(view.message);
    const d=view.data, cid=d.pages?.[0]?.cid, aid=d.aid;
    const duration = d.duration; // 获取视频总时长

    let streams:StreamInfo[]=[];
    if (cid){
      const qs = new URLSearchParams({ bvid:bv, cid:String(cid), fnval:'4048', qn:'120', fourk:'1' });
      for (const api of ['playurl','playurlproj']){
        try{
          const r = await got(`https://api.bilibili.com/x/player/${api}?${qs}`, {
            headers:{ 'User-Agent':UA, Origin:ORIGIN, Referer:REFERER }, cookieJar: jar
          }).json<any>();
          // 修改：传递 duration
          if (r.code===0 && r.data?.dash){ streams = buildStreams(r.data.dash, duration); break; }
        }catch{}
      }
    }

    // **按用户设置偏好排序**（默认 H.264）
    const pref = store.get('settings')?.codecPref || 'avc1'; // avc1/hev1/av01
    const score = (c:string)=> c.startsWith(pref)?3 : c.startsWith('hev')?2 : c.startsWith('av01')?1 : 0;
    streams = streams.sort((a,b)=> (score(b.codec||'')-score(a.codec||'')) || ((b.fps||0)-(a.fps||0)) || ((b.bitrate||0)-(a.bitrate||0)));

    return {
      platform:'bili',
      id:bv,
      title:d.title,
      cover:d.pic,
      duration:d.duration,
      author:{ name:d.owner?.name, id:String(d.owner?.mid), face:d.owner?.face },
      streams,
      canFetchComments:true,
      canFetchDanmaku:true,
      extras:{ cid, aid, pages:d.pages?.map((p:any)=>({ cid:p.cid, part:p.part })) }
    };
  }
};