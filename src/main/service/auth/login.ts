import { BrowserWindow, session } from 'electron';
import { getStore } from './store';

export async function loginBilibiliByWeb(){
  const win = new BrowserWindow({
    width: 420, height: 620, title: '登录 Bilibili',
    webPreferences: { nodeIntegration: false }
  });
  await win.loadURL('https://passport.bilibili.com/login'); // 页面含扫码/密码/短信/验证码
  return new Promise<string>((resolve, reject)=>{
    const filter = { urls: ['https://*.bilibili.com/*'] };
    const ses = win.webContents.session;

    async function capture(){
      const cookies = await ses.cookies.get({ domain: '.bilibili.com' });
      const s = cookies.map(c=> `${c.name}=${c.value}`).join('; ');
      if (s.includes('SESSDATA')) { // 说明已登录
        getStore().set('bili.cookie', s);
        win.close();
        resolve(s);
      }
    }

    ses.webRequest.onCompleted(filter, (_d)=> capture());
    win.on('closed', ()=> reject(new Error('login window closed')));
  });
}

export async function loginYouTubeByGoogle(){
  const win = new BrowserWindow({
    width: 480, height: 720, title: '登录 Google / YouTube',
    webPreferences: { nodeIntegration: false }
  });
  await win.loadURL('https://accounts.google.com/ServiceLogin');
  return new Promise<string>((resolve, reject)=>{
    const ses = win.webContents.session;
    async function capture(){
      const ck = await ses.cookies.get({ domain: '.youtube.com' });
      const s = ck.map(c=>`${c.name}=${c.value}`).join('; ');
      if (s.toLowerCase().includes('sid')) {
        getStore().set('yt.cookie', s);
        win.close();
        resolve(s);
      }
    }
    ses.webRequest.onCompleted({ urls:['https://*.youtube.com/*','https://*.google.com/*'] }, ()=> capture());
    win.on('closed', ()=> reject(new Error('login window closed')));
  });
}

// Cookie 粘贴导入（备用）
export function importCookies(kind:'bili'|'yt', cookieStr:string){
  getStore().set(kind==='bili'?'bili.cookie':'yt.cookie', cookieStr.trim());
}
