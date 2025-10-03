const { BrowserWindow } = require('electron');

async function captureCookies(session, domains){
  const all = [];
  for (const d of domains){
    const cookies = await session.cookies.get({ domain: d }).catch(()=>[]);
    all.push(...cookies);
  }
  return all.map(c=> `${c.name}=${c.value}`).join('; ');
}

async function loginBilibiliByWeb(store){
  const win = new BrowserWindow({ width: 420, height: 620, title: '登录 Bilibili', webPreferences: { nodeIntegration:false } });
  await win.loadURL('https://passport.bilibili.com/login');
  return new Promise((resolve, reject)=>{
    const ses = win.webContents.session;
    const done = async ()=>{
      const s = await captureCookies(ses, ['.bilibili.com']);
      if (s.includes('SESSDATA')) { store.set('bili.cookie', s); win.close(); resolve(s); }
    };
    ses.webRequest.onCompleted({ urls: ['https://*.bilibili.com/*'] }, done);
    win.on('closed', ()=> reject(new Error('login window closed')));
  });
}

async function loginYouTubeByGoogle(store){
  const win = new BrowserWindow({ width: 480, height: 720, title: '登录 Google/YouTube', webPreferences: { nodeIntegration:false } });
  await win.loadURL('https://accounts.google.com/ServiceLogin');
  return new Promise((resolve, reject)=>{
    const ses = win.webContents.session;
    const done = async ()=>{
      const s = await captureCookies(ses, ['.youtube.com', '.google.com']);
      if (s.toUpperCase().includes('SID=')) { store.set('yt.cookie', s); win.close(); resolve(s); }
    };
    ses.webRequest.onCompleted({ urls: ['https://*.youtube.com/*','https://*.google.com/*'] }, done);
    win.on('closed', ()=> reject(new Error('login window closed')));
  });
}

module.exports = { loginBilibiliByWeb, loginYouTubeByGoogle };
