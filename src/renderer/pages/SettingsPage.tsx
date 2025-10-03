import React from 'react';
declare global { interface Window { api:any } }

export default function SettingsPage(){
  const [s, setS] = React.useState<any>({});

  async function load(){ setS(await window.api.getSettings()); }
  async function save(){ const r = await window.api.setSettings(s); setS(r); alert('已保存'); }

  React.useEffect(()=>{ load(); }, []);

  return (
    <div>
      <h2>设置</h2>
      <section>
        <h3>下载</h3>
        <div style={{display:'grid', gap:8, gridTemplateColumns:'1fr 1fr'}}>
          <label>下载目录<input value={s.downloadDir||''} onChange={e=>setS({...s, downloadDir:e.target.value})}/></label>
          <label>并发数（1-10）
            <input type="range" min={1} max={10} value={s.concurrency||4} onChange={e=>setS({...s, concurrency:+e.target.value})}/>
            <span style={{marginLeft:8}}>{s.concurrency||4}</span>
          </label>
          <label>分片大小(MB)<input type="number" min={2} max={64} value={s.chunkSizeMB||8} onChange={e=>setS({...s, chunkSizeMB:+e.target.value})}/></label>
          <label>编码偏好
            <select value={s.codecPref || 'avc1'} onChange={e=>setS({...s, codecPref: e.target.value})}>
              <option value="avc1">H.264 (默认)</option>
              <option value="hev1">H.265 / HEVC</option>
              <option value="av01">AV1</option>
            </select>
          </label>
          <label>FFmpeg 路径（留空使用系统 PATH）
            <input value={s.ffmpegPath||''} onChange={e=>setS({...s, ffmpegPath:e.target.value})} placeholder="例如：C:\ffmpeg\bin\ffmpeg.exe"/>
            <button style={{marginLeft:8}} onClick={()=>window.api.openFfmpegSite()}>获取 FFmpeg</button>
          </label>
          <label>文件名模板
            <input value={s.filenameTpl||'{title}-{id}'} onChange={e=>setS({...s, filenameTpl:e.target.value})}/>
            <div style={{opacity:.7}}>占位符：{"{title} {id}"}</div>
          </label>
        </div>
      </section>

      <section>
        <h3>弹幕样式</h3>
        <div style={{display:'grid', gap:8, gridTemplateColumns:'repeat(3, 1fr)'}}>
          <label>宽度<input type="number" value={s.danmaku?.width||3840} onChange={e=>setS({...s, danmaku:{...s.danmaku, width:+e.target.value}})}/></label>
          <label>高度<input type="number" value={s.danmaku?.height||2160} onChange={e=>setS({...s, danmaku:{...s.danmaku, height:+e.target.value}})}/></label>
          <label>FPS<input type="number" value={s.danmaku?.fps||120} onChange={e=>setS({...s, danmaku:{...s.danmaku, fps:+e.target.value}})}/></label>
          <label>字体<input value={s.danmaku?.fontName||'Microsoft YaHei'} onChange={e=>setS({...s, danmaku:{...s.danmaku, fontName:e.target.value}})}/></label>
          <label>字号<input type="number" value={s.danmaku?.fontSize||42} onChange={e=>setS({...s, danmaku:{...s.danmaku, fontSize:+e.target.value}})}/></label>
          <label>描边<input type="number" value={s.danmaku?.outline||3} onChange={e=>setS({...s, danmaku:{...s.danmaku, outline:+e.target.value}})}/></label>
          <label>阴影<input type="number" value={s.danmaku?.shadow||0} onChange={e=>setS({...s, danmaku:{...s.danmaku, shadow:+e.target.value}})}/></label>
          <label>透明度(0-1)<input type="number" step="0.05" min={0} max={1} value={s.danmaku?.opacity||0} onChange={e=>setS({...s, danmaku:{...s.danmaku, opacity:+e.target.value}})}/></label>
          <label>滚动时长(s)<input type="number" value={s.danmaku?.scrollDuration||8} onChange={e=>setS({...s, danmaku:{...s.danmaku, scrollDuration:+e.target.value}})}/></label>
          <label>静止时长(s)<input type="number" value={s.danmaku?.staticDuration||4.5} onChange={e=>setS({...s, danmaku:{...s.danmaku, staticDuration:+e.target.value}})}/></label>
          <label>轨道高度<input type="number" value={s.danmaku?.trackHeight||48} onChange={e=>setS({...s, danmaku:{...s.danmaku, trackHeight:+e.target.value}})}/></label>
        </div>
      </section>

      <div style={{marginTop:12}}>
        <button onClick={save}>保存</button>
      </div>
    </div>
  );
}
