import React from 'react';

declare global { interface Window { api:any } }

export default function UserPage(){
  const [bili, setBili] = React.useState<string>('未知');
  const [yt, setYT] = React.useState<string>('未知');

  async function load(){
    const s = await window.api.invoke('settings:get');
    setBili(s?.bili?.cookie ? '已登录' : '未登录');
    setYT(s?.yt?.cookie ? '已登录' : '未登录');
  }
  React.useEffect(()=>{ load(); }, []);

  return (
    <div>
      <h2>用户中心</h2>
      <section>
        <h3>Bilibili</h3>
        <div>状态：{bili}</div>
        <div style={{display:'flex', gap:8, marginTop:8}}>
          <button onClick={()=>window.api.invoke('auth:bili:web').then(load)}>打开官方登录页</button>
          <button onClick={async ()=>{
            const v = prompt('粘贴 Cookie（整段）');
            if (!v) return;
            await window.api.invoke('auth:cookie:import', { kind:'bili', cookie: v });
            load();
          }}>导入 Cookie</button>
        </div>
      </section>

      <section style={{marginTop:16}}>
        <h3>YouTube / Google</h3>
        <div>状态：{yt}</div>
        <div style={{display:'flex', gap:8, marginTop:8}}>
          <button onClick={()=>window.api.invoke('auth:yt:web').then(load)}>打开 Google 登录页</button>
          <button onClick={async ()=>{
            const v = prompt('粘贴 YouTube Cookie（整段）');
            if (!v) return;
            await window.api.invoke('auth:cookie:import', { kind:'yt', cookie: v });
            load();
          }}>导入 Cookie</button>
        </div>
      </section>
    </div>
  );
}
