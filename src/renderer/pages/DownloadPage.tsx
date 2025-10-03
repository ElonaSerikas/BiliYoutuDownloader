import React from 'react';
import { Button, Card, ProgressBar, Body1, Caption, Spinner, Menu, MenuTrigger, MenuList, MenuItem, MenuPopover } from '@fluentui/react-components'; 
import { FolderOpenRegular, PauseRegular, PlayRegular, DismissRegular, ArrowClockwiseRegular } from '@fluentui/react-icons';
// 假设 openFile/openDir 是通过 preload.js 暴露的
declare global { interface Window { api:any } }

type Task = {
  id:string; title:string; platform:'bili'|'yt';
  status:'queued'|'running'|'paused'|'done'|'error'|'canceled';
  progress:{ total:number; downloaded:number; speed:number }; 
  target:string;
  outFile?: string;
};

// 格式化字节大小 (B -> MB/GB)
const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function DownloadPage(){
  const [tasks, setTasks] = React.useState<Task[]>([]);

  async function refresh(){
    const list = await window.api.listTasks();
    setTasks(list);
  }
  async function control(id:string, action:'pause'|'resume'|'cancel'|'delete'){
    if (action === 'delete') {
      if (confirm('确定要删除这条记录吗？')) {
        // TODO: 实际应用中，这里应该调用 IPC 清理任务记录和文件
        setTasks(prev => prev.filter(t => t.id !== id));
      }
      return;
    }
    await window.api.controlTask(id, action); 
    refresh();
  }
  
  const openFile = (filePath: string) => window.api.openFile(filePath); 
  const openDir = (dirPath: string) => window.api.openDir(dirPath); 

  React.useEffect(()=>{ 
    refresh(); 
    // 实时刷新下载进度
    const t=setInterval(refresh, 1200); 
    return ()=>clearInterval(t); 
  }, []);

  return (
    <div>
      <h2>下载管理</h2>
      {tasks.length===0? <Body1>暂无任务</Body1> :
      <div style={{display:'grid', gap:12}}>
        {tasks.map(t=>{
          const pct = t.progress.total > 0 ? (t.progress.downloaded/t.progress.total) : 0;
          const pctValue = pct * 100;
          
          const statusColor = t.status==='error'?'tomato': (t.status==='done'?'green':(t.status==='running'?'var(--colorBrandForeground1)':'inherit'));

          return (
            <Card key={t.id} style={{padding:16, boxShadow: 'var(--shadow8)', transition: 'all 0.2s'}}> 
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                <Body1><b>{t.title}</b> <Caption style={{opacity:.7}}>({t.platform})</Caption></Body1>
                <Body1 style={{color: statusColor, fontWeight:'bold', display:'flex', alignItems:'center'}}>
                  {t.status === 'running' && <Spinner size="tiny" style={{marginRight:4}}/> }
                  {t.status}
                </Body1>
              </div>
              
              <div style={{marginTop:8}}>
                <ProgressBar 
                  value={t.status === 'done' ? 100 : pctValue} 
                  max={100} 
                  thickness="medium"
                  style={{width:'100%'}}
                  color={t.status === 'error' ? 'error' : 'brand'}
                />
              </div>

              <Caption style={{opacity:.8, marginTop:6, display:'flex', justifyContent:'space-between'}}>
                <span>
                  进度：{pctValue.toFixed(1)}% | 
                  {t.status === 'running' && ` 速度：${(t.progress.speed / 1048576).toFixed(2)} MB/s`}
                </span>
                <span>
                  {formatBytes(t.progress.downloaded)} / {formatBytes(t.progress.total)}
                </span>
              </Caption>
              
              <div style={{display:'flex', gap:8, marginTop:12}}>
                
                {t.status === 'running' && <Button icon={<PauseRegular/>} onClick={()=>control(t.id,'pause')}>暂停</Button>}
                {t.status === 'paused' && <Button icon={<PlayRegular/>} appearance="primary" onClick={()=>control(t.id,'resume')}>继续</Button>}
                
                {(t.status === 'done' || t.status === 'error' || t.status === 'canceled') && 
                  <Button onClick={()=>control(t.id,'delete')}>删除记录</Button>
                }
                
                {t.status === 'done' && t.outFile && 
                  <Button icon={<FolderOpenRegular/>} onClick={()=>openDir(t.target)}>打开目录</Button>
                }
                {t.status === 'error' && 
                  <Button icon={<ArrowClockwiseRegular/>} onClick={()=>control(t.id,'resume')}>重试</Button>
                }
                
                {/* 更多操作菜单 */}
                <Menu>
                  <MenuTrigger disableButtonEnhancement>
                    <Button>更多</Button>
                  </MenuTrigger>
                  <MenuPopover>
                    <MenuList>
                      <MenuItem onClick={() => openDir(t.target)}>打开存储目录</MenuItem>
                      {t.status === 'done' && t.outFile && <MenuItem onClick={() => openFile(t.outFile)}>打开文件</MenuItem>}
                    </MenuList>
                  </MenuPopover>
                </Menu>
                
              </div>
            </Card>
          );
        })}
      </div>}
    </div>
  );
}