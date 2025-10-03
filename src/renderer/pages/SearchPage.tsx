import React from 'react';
import { Button, Input, Card, Radio, RadioGroup, Field, Body1, Caption, Spinner, Divider } from '@fluentui/react-components'; 
import { SearchRegular, DownloadRegular, UserRegular, CommentRegular, MoviesAndTvRegular } from '@fluentui/react-icons';

declare global { interface Window { api:any } }

// 格式化字节大小 (B -> MB/GB)
const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function SearchPage(){
  const [url, setUrl] = React.useState('');
  const [info, setInfo] = React.useState<any>(null);
  const [err, setErr] = React.useState<any>(null); 
  const [loading, setLoading] = React.useState(false);
  const [selV, setSelV] = React.useState<string>('');
  const [selA, setSelA] = React.useState<string>('');

  async function parse(){
    setErr(null); setInfo(null); setSelV(''); setSelA(''); setLoading(true);
    try { 
      const r = await window.api.parse(url.trim()); 
      setInfo(r);
      if (r.streams?.length > 0) {
        const videos = r.streams.filter((x:any)=> x.type==='video');
        const audios = r.streams.filter((x:any)=> x.type==='audio');
        if (videos.length > 0) setSelV(videos[0].id);
        if (audios.length > 0) setSelA(audios[0].id);
      }
    }
    catch (e:any) { 
      setErr(e); 
    }
    finally { setLoading(false); }
  }

  async function add(){
    if (!info) return;
    try {
      const s = await window.api.getSettings();
      const target = s?.downloadDir || '';
      const v = info.streams.find((x:any)=> x.id===selV);
      const a = info.streams.find((x:any)=> x.id===selA);
      
      if (!v && !a) { 
        alert('请至少选择一个视频或音频流'); 
        return; 
      }

      if (!target) {
        alert('请先在设置中配置下载目录！');
        return;
      }
      
      const payload = {
        platform: info.platform, title: info.title, target,
        id: info.id, meta: { id: info.id, cid: info?.extras?.cid, aid: info?.extras?.aid, authorId: info.author?.id }, 
        streams: { 
          video: v?.url, 
          audio: a?.url, 
          container: (v?.container || a?.container || 'mp4') 
        },
        settings: { 
          concurrency: s?.concurrency || 4, 
          chunkSizeMB: s?.chunkSizeMB || 8, 
          filenameTpl: s?.filenameTpl || '{title}-{id}'
        }
      };
      await window.api.createTask(payload);
      alert('已加入下载队列');
    } catch(e:any) {
      setErr(e); 
    }
  }
  
  // 附加资源下载逻辑 
  async function downloadResource(resource: 'userCard' | 'comments' | 'danmaku'){
    try {
      const s = await window.api.getSettings();
      const targetDir = s?.downloadDir || '';
      
      if (!targetDir) {
        alert('请先在设置中配置下载目录！');
        return;
      }

      const meta = { id: info.id, target: targetDir, meta: info.extras, platform: info.platform, title: info.title };
      
      if (resource === 'userCard' && info.author?.id) {
        const result = await window.api.downloadBiliUserCard(info.author.id, targetDir);
        alert(`UP 主信息和头像已下载到：${targetDir}`);
      } else if (resource === 'comments') {
        const path = await window.api.commentsExport(meta);
        alert(`评论已导出到：${path}`);
      } else if (resource === 'danmaku') {
        const path = await window.api.danmakuExport(meta, 'ass'); 
        alert(`弹幕已导出到：${path}`);
      }
    } catch (e:any) {
      setErr(e);
      alert(`资源下载失败: ${e.message}`);
    }
  }


  const videos = info?.streams?.filter((x:any)=> x.type==='video') || [];
  const audios = info?.streams?.filter((x:any)=> x.type==='audio') || [];
  const totalVideoSize = videos.find((x:any)=> x.id===selV)?.sizeEstimate || 0;
  const totalAudioSize = audios.find((x:any)=> x.id===selA)?.sizeEstimate || 0;
  const totalDownloadSize = totalVideoSize + totalAudioSize;
  const isBili = info?.platform === 'bili';
  
  return (
    <div>
      <h2>搜索 / 解析</h2>
      <div style={{display:'flex', gap:8, marginBottom:16}}>
        <Input 
          style={{flex:1}} 
          placeholder="粘贴 B站/YouTube 链接" 
          value={url} 
          onChange={(_,d)=>setUrl(d.value)} 
          disabled={loading}
        />
        <Button 
          appearance="primary" 
          onClick={parse} 
          disabled={loading}
          icon={loading ? <Spinner size="tiny"/> : <SearchRegular/>}
        >
          {loading ? '解析中' : '解析'}
        </Button>
      </div>
      
      {err && (
        <Card style={{marginBottom:16, borderColor:'tomato', borderStyle:'solid', borderWidth:'1px'}}>
          <Body1 style={{color:'tomato'}}>解析失败：{err.message || String(err)}</Body1>
          <Caption>代码: {err.code || 500} - 详情: {err.details || err.name || '无'}</Caption>
          {err.name === 'UNSUPPORTED_LINK' && 
            <Body1 style={{marginTop:8}}>建议：确认链接有效或尝试更新软件版本。</Body1>
          }
        </Card>
      )}

      {info && (
        <Card style={{marginTop:16, boxShadow: 'var(--shadow8)'}}>
          <Body1 style={{fontWeight:'bold'}}>{info.title}</Body1>
          <Caption style={{opacity:.8, margin:'6px 0'}}>平台：{info.platform}，时长：{info.duration ?? '未知'} 秒</Caption>
          {info.cover && <img src={info.cover} style={{maxWidth:320, borderRadius:8, marginTop:10}}/>}
          
          <Divider style={{margin:'12px 0'}}/>

          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginTop:12}}>
            <Field label="选择视频流" style={{borderRight: isBili ? '1px solid var(--colorNeutralStroke1)' : 'none', paddingRight: isBili ? 16 : 0}}>
              <RadioGroup value={selV} onChange={(_, d)=>setSelV(d.value)}>
                {videos.map((s:any)=>(
                  <Radio key={s.id} value={s.id} label={
                    <div>
                      <Body1>{s.qualityLabel || s.type} | {s.codec} ({s.container})</Body1>
                      <Caption style={{opacity:.8}}>
                        码率：{s.bitrate? (s.bitrate/1000).toFixed(0)+' kbps' : '未知'} 
                        {s.sizeEstimate ? ` | 预估大小: ${formatBytes(s.sizeEstimate)}` : ''}
                      </Caption>
                    </div>
                  } style={{marginTop:4}} />
                ))}
              </RadioGroup>
            </Field>

            <Field label="选择音频流">
              <RadioGroup value={selA} onChange={(_, d)=>setSelA(d.value)}>
                {audios.map((s:any)=>(
                  <Radio key={s.id} value={s.id} label={
                    <div>
                      <Body1>{s.container} | {s.codec}</Body1>
                      <Caption style={{opacity:.8}}>
                        码率：{s.bitrate? (s.bitrate/1000).toFixed(0)+' kbps' : '未知'}
                        {s.sizeEstimate ? ` | 预估大小: ${formatBytes(s.sizeEstimate)}` : ''}
                      </Caption>
                    </div>
                  } style={{marginTop:4}} />
                ))}
              </RadioGroup>
            </Field>
          </div>

          <Divider style={{margin:'12px 0'}}/>
          
          <Body1 style={{fontWeight:'bold', marginBottom:12}}>
            总预估下载大小：{formatBytes(totalDownloadSize)}
          </Body1>

          <div style={{marginTop:10}}>
            <Button 
              appearance="primary" 
              onClick={add}
              icon={<DownloadRegular/>}
              disabled={!selV && !selA}
            >
              加入下载队列
            </Button>
          </div>
        </Card>
      )}

      {/* 附加资源和批量下载 (仅限 Bili) */}
      {isBili && info && (
        <Card style={{marginTop:20, boxShadow: 'var(--shadow8)'}}>
          <Body1 style={{fontWeight:'bold'}}>附加资源/批量下载</Body1>
          <div style={{marginTop:12, display:'flex', gap:8, flexWrap:'wrap'}}>
            
            {info.author?.id && (
              <Button icon={<UserRegular/>} onClick={()=>downloadResource('userCard')}>
                下载 UP 主信息/头像
              </Button>
            )}
            
            {info.canFetchComments && info.extras?.aid && (
              <Button icon={<CommentRegular/>} onClick={()=>downloadResource('comments')}>
                导出评论区 (.json)
              </Button>
            )}
            
            {info.canFetchDanmaku && info.extras?.cid && (
              <Button icon={<MoviesAndTvRegular/>} onClick={()=>downloadResource('danmaku')}>
                导出弹幕 (.ass)
              </Button>
            )}
            
            {/* 批量下载占位符 */}
            <Button onClick={()=>alert('TODO: 批量下载收藏夹的 UI 尚未实现，请在控制台查看 API 调用示例')}>
              批量下载收藏夹
            </Button>
            <Button onClick={()=>alert('TODO: 批量下载合集的 UI 尚未实现，请在控制台查看 API 调用示例')}>
              批量下载合集
            </Button>
            
          </div>
        </Card>
      )}
    </div>
  );
}