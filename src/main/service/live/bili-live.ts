import got from 'got';
import { spawn } from 'node:child_process';
import path from 'node:path';

const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
const H = { headers: { 'User-Agent': UA, Referer:'https://live.bilibili.com' } };

function rank(qn:number){ // 画质等级：越大越好
  // 10000原画, 150高清? 实际以服务端返回为准
  return qn || 0;
}

export async function getBiliLiveInfo(roomId:string){
  const u = new URLSearchParams({
    room_id: roomId,
    protocol: '0,1',    // flv,hls
    format: '0,1,2',    // flv,ts,fmp4
    codec: '0,1',       // avc,hevc
    qn: '10000',
    platform: 'web',
    ptype: '8'
  });
  const r = await got(`https://api.live.bilibili.com/xlive/web-room/v2/index/getRoomPlayInfo?${u}`, H).json<any>();
  if (r.code!==0) throw new Error(r.message);
  const streams = r.data?.playurl_info?.playurl?.stream || [];
  type Item={ url:string; qn:number; format:string; codec:string };
  const items:Item[]=[];
  for (const s of streams) for (const f of s.format) for (const c of f.codec) for (const ui of c.url_info) {
    items.push({
      url: ui.host + c.base_url + ui.extra,
      qn: c.current_qn || 0,
      format: f.format_name || '',
      codec: ['avc','hevc'][c.codec_id] || ''
    });
  }
  items.sort((a,b)=> (rank(b.qn)-rank(a.qn)) || ((b.codec==='hevc'?1:0)-(a.codec==='hevc'?1:0)) || ((a.format==='flv'?1:0)-(b.format==='flv'?1:0)));
  return { title: r.data?.room_info?.title || `live_${roomId}`, items };
}

export async function recordBiliLive(roomId:string, outDir:string){
  const { items, title } = await getBiliLiveInfo(roomId);
  if (!items.length) throw new Error('无可用直播流');
  const out = path.join(outDir, `${title.replace(/[\\/:*?"<>|]/g,'_')}-${Date.now()}.mp4`);

  // 尝试多线路
  let lastErr: any = null;
  for (const it of items) {
    try {
      const args = [
        '-user_agent', UA,
        '-reconnect', '1',
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '10',
        '-rw_timeout', '15000000',
        '-i', it.url,
        '-c', 'copy',
        '-f', 'mp4',
        '-movflags', 'frag_keyframe+empty_moov+faststart',
        out
      ];
      const ff = spawn('ffmpeg', args, { stdio: 'inherit' });
      return { pid: ff.pid, out, primary: it.url };
    } catch (e) {
      lastErr = e;
      continue;
    }
  }
  throw lastErr || new Error('所有线路均不可用');
}
