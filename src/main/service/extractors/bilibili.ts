import got from 'got';
import { CookieJar } from 'tough-cookie';
import type { ParseResult, StreamInfo } from './types';

type Store = { get:(k:string, d?: any)=>any };

const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const ORIGIN='https://www.bilibili.com';
const REFERER=ORIGIN+'/';

function codecName(codecs?:string){ return codecs?.split('.')[0] || ''; }

function buildStreams(dash:any, duration:number):StreamInfo[]{
  const out:StreamInfo[]=[];
  for (const v of dash?.video||[]){
    const codec = codecName(v.codecs);
    const label = v.height >= 720 ? `${v.height}P` : `${v.height}P`;
    const fullLabel = `${v.width}x${v.height}@${v.frameRate}fps`;
    
    const sizeEstimate = duration && v.bandwidth ? Math.floor(duration * v.bandwidth / 8) : undefined;
    
    out.push({
      id:`v_${v.id}`, type:'video', container:'mp4',
      codec, qualityLabel: label, bitrate:v.bandwidth, fps:Number(v.frameRate),
      sizeEstimate, url: v.baseUrl || v.base_url,
      extras: { fullLabel }
    } as StreamInfo);
  }
  for (const a of dash?.audio||[]){
    const sizeEstimate = duration && a.bandwidth ? Math.floor(duration * a.bandwidth / 8) : undefined;
    
    out.push({
      id:`a_${a.id}`, type:'audio', container:'m4a',
      codec: a.codecs || 'aac', bitrate:a.bandwidth,
      sizeEstimate, url: a.baseUrl || a.base_url,
      qualityLabel: `${Math.round(a.bandwidth/1000)}k`
    });
  }
  return out;
}

export const biliExtractor = {
  async parse(url:string, store:Store): Promise<ParseResult>{
    const jar = new CookieJar();
    const cookie = store.get('bili.cookie', '') as string;
    if (cookie) await jar.setCookie(cookie, ORIGIN);

    const realUrl = /b23\.tv/.test(url) ? (await got(url, { followRedirect:false })).headers['location'] as string || url : url;
    const bv = (realUrl.match(/BV\w+/)||[])[0]; if(!bv) throw new Error('未识别到BV号');

    const view = await got(`https://api.bilibili.com/x/web-interface/view?bvid=${bv}`, {
      headers:{ 'User-Agent':UA, Origin:ORIGIN, Referer:REFERER }, cookieJar: jar
    }).json<any>();
    if (view.code!==0) throw new Error(view.message);
    const d=view.data, cid=d.pages?.[0]?.cid, aid=d.aid;
    const duration = d.duration;

    let streams:StreamInfo[]=[];
    if (cid){
      const qs = new URLSearchParams({ bvid:bv, cid:String(cid), fnval:'4048' });
      const r = await got(`https://api.bilibili.com/x/player/playurl?${qs}`, {
          headers:{ 'User-Agent':UA, Origin:ORIGIN, Referer:REFERER }, cookieJar: jar
      }).json<any>();
      if (r.code===0 && r.data?.dash){ 
          streams = buildStreams(r.data.dash, duration); 
      } else {
        throw new Error(r.message || "无法获取视频流信息");
      }
    }

    const pref = store.get('settings.codecPref', 'avc1');
    const score = (c:string)=> c.startsWith(pref) ? 3 : c.startsWith('hev') ? 2 : c.startsWith('av01') ? 1 : 0;
    streams.sort((a,b)=> (score(b.codec||'')-score(a.codec||'')) || ((b.fps||0)-(a.fps||0)) || ((b.bitrate||0)-(a.bitrate||0)));

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