import React from 'react';
import { Button, Card, Subtitle2, Body1, useToastController, Toaster, Toast, ToastTitle } from '@fluentui/react-components';

declare global { interface Window { api:any } }

export default function UserPage(){
  const [bili, setBili] = React.useState<string>('未知');
  const [yt, setYT] = React.useState<string>('未知');
  const toasterId = "user-page-toaster";
  const { dispatchToast } = useToastController(toasterId);

  const notify = (message: string, intent: 'success' | 'error' = 'success') => {
    dispatchToast(
      <Toast>
        <ToastTitle>{message}</ToastTitle>
      </Toast>,
      { intent }
    );
  };

  async function load(){
    const s = await window.api.invoke('app:settings:get');
    setBili(s?.bili?.cookie ? '已登录' : '未登录');
    setYT(s?.yt?.cookie ? '已登录' : '未登录');
  }
  React.useEffect(()=>{ load(); }, []);

  const handleLogin = async (platform: 'bili' | 'yt') => {
      try {
          await window.api.invoke(platform === 'bili' ? 'app:auth:bili:web' : 'app:auth:yt:web');
          notify(`${platform === 'bili' ? 'Bilibili' : 'YouTube'} 登录成功!`);
          load();
      } catch (e: any) {
          notify(`登录取消或失败: ${e.message}`, 'error');
      }
  }

  const handleImport = async (platform: 'bili' | 'yt') => {
      const v = prompt(`请粘贴您的 ${platform === 'bili' ? 'Bilibili' : 'YouTube'} Cookie 字符串`);
      if (!v) return;
      try {
        await window.api.invoke('app:auth:cookie:import', { kind: platform, cookie: v });
        notify('Cookie 导入成功!');
        load();
      } catch (e: any) {
        notify(`导入失败: ${e.message}`, 'error');
      }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <Toaster toasterId={toasterId} />
      <h2>用户中心</h2>
      <Card>
        <Subtitle2>Bilibili</Subtitle2>
        <Body1>当前状态：{bili}</Body1>
        <div style={{display:'flex', gap:8, marginTop:12}}>
          <Button appearance="primary" onClick={()=>handleLogin('bili')}>打开网页登录</Button>
          <Button onClick={()=>handleImport('bili')}>粘贴 Cookie 导入</Button>
        </div>
      </Card>

      <Card>
        <Subtitle2>YouTube / Google</Subtitle2>
        <Body1>当前状态：{yt}</Body1>
        <div style={{display:'flex', gap:8, marginTop:12}}>
          <Button appearance="primary" onClick={()=>handleLogin('yt')}>打开 Google 登录</Button>
          <Button onClick={()=>handleImport('yt')}>粘贴 Cookie 导入</Button>
        </div>
      </Card>
    </div>
  );
}