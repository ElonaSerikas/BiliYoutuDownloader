import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import CustomTitleBar from '../components/CustomTitleBar';
import { SettingsProvider, useSettings } from '../Settings';

// 【关键修复】: 修正了 Fluent UI 图标的导入方式
import {
    SettingsRegular,
    SearchRegular,
    CloudDownloadRegular,
    PeopleRegular,
    InfoRegular,
    ChevronLeftRegular,
    ChevronRightRegular
} from "@fluentui/react-icons";

const navStyle = (isCollapsed: boolean): React.CSSProperties => ({
  width: isCollapsed ? 52 : 220,
  minWidth: 52,
  padding: '8px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  transition: 'width 0.2s ease-in-out',
  flexShrink: 0,
  backgroundColor: 'rgba(40, 40, 40, 0.5)', // 使用半透明背景以适应亚克力/毛玻璃效果
  backdropFilter: 'blur(30px) saturate(180%)',
  borderRight: '1px solid rgba(255, 255, 255, 0.1)',
});

const linkStyle = (active: boolean): React.CSSProperties => ({
  padding: '10px',
  borderRadius: 6,
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: isCollapsed ? 'center' : 'flex-start',
  gap: 12,
  background: active ? 'var(--colorBrandBackgroundSelected)' : 'transparent',
  color: active ? 'var(--colorBrandForeground1)' : 'var(--colorNeutralForegroundOnBrand)',
  fontWeight: active ? 600 : 400,
  transition: 'all 0.15s ease-out',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
});

const NavItems = [
  { to: "/", label: "搜索/解析", Icon: SearchRegular },
  { to: "/downloads", label: "下载管理", Icon: CloudDownloadRegular },
  { to: "/settings", label: "设置", Icon: SettingsRegular },
  { to: "/user", label: "用户中心", Icon: PeopleRegular },
  { to: "/diagnostics", label: "诊断", Icon: InfoRegular },
];

function LayoutComponent() {
  const { pathname } = useLocation();
  const { settings } = useSettings();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [dndUrl, setDndUrl] = useState('');

  useEffect(() => {
    // 监听主进程通过 preload 脚本发来的拖拽 URL 事件
    const removeListener = window.api.on('app:dnd-url', (_event: any, url: string) => setDndUrl(url));
    return () => {
        // 组件卸载时清理监听器
        if (removeListener) removeListener();
    };
  }, []);

  const bgStyle: React.CSSProperties = settings?.backgroundImagePath
      ? { backgroundImage: `url("file://${settings.backgroundImagePath.replace(/\\/g, '/')}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
      : { backgroundColor: '#202020' };

  const overlayStyle: React.CSSProperties = {
      backgroundColor: `rgba(0, 0, 0, ${1 - (settings?.backgroundOpacity ?? 0.7)})`,
      position: 'absolute',
      inset: 0,
      zIndex: -1,
  };

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative', ...bgStyle }}>
      <div style={overlayStyle} />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', color: 'white' }}>
        <CustomTitleBar />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <nav style={navStyle(isCollapsed)}>
            {NavItems.map(item =>
              <Link key={item.to} to={item.to} style={linkStyle(pathname === item.to, isCollapsed)}>
                <item.Icon fontSize={20} />
                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            )}
            <div style={{ flex: 1 }} /> {/* 弹簧, 将折叠按钮推到底部 */}
            <div
              onClick={() => setIsCollapsed(!isCollapsed)}
              style={linkStyle(false, isCollapsed)}
              title={isCollapsed ? '展开导航' : '折叠导航'}
            >
              {isCollapsed ? <ChevronRightRegular fontSize={20} /> : <ChevronLeftRegular fontSize={20} />}
              {!isCollapsed && <span>折叠</span>}
            </div>
          </nav>
          <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>
            {/* 将拖拽的URL通过 context 传递给子路由 (如 SearchPage) */}
            <Outlet context={{ dndUrl }} />
          </main>
        </div>
      </div>
    </div>
  );
}

// 使用 SettingsProvider 来为整个布局及其子组件提供设置数据
export default function MainLayout() {
    return (
        <SettingsProvider>
            <LayoutComponent />
        </SettingsProvider>
    );
}