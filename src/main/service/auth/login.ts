import { BrowserWindow } from 'electron';
import { getStore } from './store';

// 捕获指定域名的 cookies
async function captureCookies(ses: Electron.Session, domains: string[]): Promise<string> {
    const allCookies = [];
    for (const domain of domains) {
        const cookies = await ses.cookies.get({ domain });
        allCookies.push(...cookies);
    }
    return allCookies.map(c => `${c.name}=${c.value}`).join('; ');
}

// 通过 web 登录 Bilibili
export function loginBilibiliByWeb(): Promise<string> {
    const win = new BrowserWindow({
        width: 420, height: 620, title: '登录 Bilibili',
        webPreferences: { nodeIntegration: false, contextIsolation: true }
    });
    win.loadURL('https://passport.bilibili.com/login');

    return new Promise<string>((resolve, reject) => {
        const ses = win.webContents.session;
        const checkLoginStatus = async () => {
            const cookieStr = await captureCookies(ses, ['.bilibili.com']);
            if (cookieStr.includes('SESSDATA')) {
                getStore().set('bili.cookie', cookieStr);
                win.close();
                resolve(cookieStr);
            }
        };

        ses.webRequest.onCompleted({ urls: ['https://*.bilibili.com/*'] }, checkLoginStatus);
        win.on('closed', () => reject(new Error('登录窗口已关闭')));
    });
}

// 通过 web 登录 Google/YouTube
export function loginYouTubeByGoogle(): Promise<string> {
    const win = new BrowserWindow({
        width: 500, height: 720, title: '登录 Google / YouTube',
        webPreferences: { nodeIntegration: false, contextIsolation: true }
    });
    win.loadURL('https://accounts.google.com/ServiceLogin');

    return new Promise<string>((resolve, reject) => {
        const ses = win.webContents.session;
        const checkLoginStatus = async () => {
            const cookieStr = await captureCookies(ses, ['.youtube.com', '.google.com']);
            if (cookieStr.toUpperCase().includes('SID=')) {
                getStore().set('yt.cookie', cookieStr);
                win.close();
                resolve(cookieStr);
            }
        };

        ses.webRequest.onCompleted({ urls: ['https://*.youtube.com/*', 'https://*.google.com/*'] }, checkLoginStatus);
        win.on('closed', () => reject(new Error('登录窗口已关闭')));
    });
}

// 导入 cookies
export function importCookies(kind: 'bili' | 'yt', cookieStr: string): void {
    const key = kind === 'bili' ? 'bili.cookie' : 'yt.cookie';
    getStore().set(key, cookieStr.trim());
}