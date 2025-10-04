import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { useSettings } from '../../contexts/SettingsContext';
import CustomTitleBar from '../CustomTitleBar';
import {
  SearchRegular, CloudDownloadRegular, SettingsRegular, PersonRegular,
  InfoRegular, ChevronLeftRegular, ChevronRightRegular, BookRegular
} from '@fluentui/react-icons';

// --- 样式定义 ---
const navStyle = (isCollapsed: boolean): React.CSSProperties => ({
  width: isCollapsed ? 52 : 200,
  padding: '8px',
  display: 'flex', flexDirection: 'column', gap: 4,
  transition: 'width 0.2s ease-in-out',
  flexShrink: 0,
  backgroundColor: 'rgba(40, 40, 40, 0.5)',
  backdropFilter: 'blur(30px) saturate(180%)',
  borderRight: '1px solid var(--colorNeutralStroke2)',
});

const linkStyle = (active: boolean): React.CSSProperties => ({
  padding: '10px', borderRadius: 6, textDecoration: 'none',
  display: 'flex', alignItems: 'center', gap: 16,
  background: active ? 'var(--colorSubtleBackgroundSelected)' : 'transparent',
  color: active ? 'var(--colorNeutralForeground1)' : 'var(--colorNeutralForeground2)',
  fontWeight: active ? 600 : 400,
  transition: 'all 0.15s ease-out', cursor: 'pointer',
  whiteSpace: 'nowrap', overflow: 'hidden',
});

// --- 导航项 ---
const NavItems = [
  { to: "/", label: "搜索解析", Icon: SearchRegular },
  { to: "/downloads", label: "下载管理", Icon: CloudDownloadRegular },
  { to: "/user", label: "用户中心", Icon: PersonRegular },
  { to: "/settings", label: "应用设置", Icon: SettingsRegular },
  { to: "/diagnostics", label: "诊断日志", Icon: InfoRegular },
  { to: "/about", label: "关于", Icon: BookRegular },
];

// --- 布局组件 ---
export default function MainLayout() {
  const { pathname } = useLocation();
  const { settings } = useSettings();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [dndUrl, setDndUrl] = useState('');

  useEffect(() => {
    const removeListener = window.api.on('app:dnd-url', (url: string) => setDndUrl(url));
    return () => { removeListener?.(); };
  }, []);

  const bgStyle: React.CSSProperties = settings?.backgroundImagePath
    ? { backgroundImage: `url("file://${settings.backgroundImagePath.replace(/\\/g, '/')}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {};

  const overlayStyle: React.CSSProperties = {
    backgroundColor: `rgba(0, 0, 0, ${1 - (settings?.backgroundOpacity ?? 0.7)})`,
    position: 'absolute', inset: 0, zIndex: -1,
  };

  return (
    <div className="main-layout" style={bgStyle}>
      <div style={overlayStyle} />
      <div className="content-wrapper">
        <CustomTitleBar />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <nav style={navStyle(isCollapsed)}>
            {NavItems.map(item => (
              <Link key={item.to} to={item.to} style={linkStyle(pathname === item.to)}>
                <item.Icon fontSize={20} />
                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            ))}
            <div style={{ flex: 1 }} />
            <div onClick={() => setIsCollapsed(!isCollapsed)} style={linkStyle(false)} title={isCollapsed ? '展开导航' : '折叠导航'}>
              {isCollapsed ? <ChevronRightRegular fontSize={20} /> : <ChevronLeftRegular fontSize={20} />}
              {!isCollapsed && <span>折叠</span>}
            </div>
          </nav>
          <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>
            <Outlet context={{ dndUrl }} />
          </main>
        </div>
      </div>
    </div>
  );
}