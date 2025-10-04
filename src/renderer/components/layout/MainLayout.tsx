import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useSettings } from '../../contexts/SettingsContext';
import CustomTitleBar from '../CustomTitleBar';
import {
    SettingsRegular,
    SearchRegular,
    CloudDownloadRegular,
    PersonRegular,
    InfoRegular,
    ChevronLeftRegular,
    ChevronRightRegular,
    BookRegular
} from "@fluentui/react-icons";
import { Tooltip } from '@fluentui/react-components';

const navStyle = (isCollapsed: boolean): React.CSSProperties => ({
  width: isCollapsed ? 48 : 200,
  padding: '8px 4px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  flexShrink: 0,
  backgroundColor: 'var(--colorTransparentBackground)',
  backdropFilter: 'blur(20px) saturate(180%)',
  borderRight: '1px solid var(--colorTransparentStroke)',
});

const linkStyle = (active: boolean, isCollapsed: boolean): React.CSSProperties => ({
  height: 40,
  padding: '0 10px',
  borderRadius: 6,
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: isCollapsed ? 'center' : 'flex-start',
  gap: 16,
  background: active ? 'var(--colorSubtleBackgroundSelected)' : 'transparent',
  color: active ? 'var(--colorNeutralForeground1)' : 'var(--colorNeutralForeground2)',
  fontWeight: active ? 600 : 400,
  transition: 'all 0.15s ease-out',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
});

const NavItems = [
  { to: "/", label: "搜索解析", Icon: SearchRegular },
  { to: "/downloads", label: "下载管理", Icon: CloudDownloadRegular },
  { to: "/user", label: "用户中心", Icon: PersonRegular },
  { to: "/settings", label: "应用设置", Icon: SettingsRegular },
  { to: "/diagnostics", label: "诊断日志", Icon: InfoRegular },
  { to: "/about", label: "关于", Icon: BookRegular },
];

function LayoutComponent() {
  const { pathname } = useLocation();
  const { settings } = useSettings();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [dndUrl, setDndUrl] = useState('');

  useEffect(() => {
    const removeListener = window.api.on('app:dnd-url', (url: string) => setDndUrl(url));
    return () => {
        if (removeListener) removeListener();
    };
  }, []);

  const bgStyle: React.CSSProperties = settings?.backgroundImagePath
      ? { backgroundImage: `url("file://${settings.backgroundImagePath.replace(/\\/g, '/')}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
      : { backgroundColor: 'var(--colorNeutralBackground1)' };

  const overlayStyle: React.CSSProperties = {
      backgroundColor: `rgba(0, 0, 0, ${1 - (settings?.backgroundOpacity ?? 0.7)})`,
      position: 'absolute',
      inset: 0,
      zIndex: -1,
  };

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative', ...bgStyle }}>
      <div style={overlayStyle} />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', color: 'var(--colorNeutralForeground1)' }}>
        <CustomTitleBar />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <nav style={navStyle(isCollapsed)}>
            {NavItems.map(item =>
              <Tooltip content={item.label} relationship="label" withArrow positioning="after" key={item.to}>
                <Link to={item.to} style={linkStyle(pathname === item.to, isCollapsed)}>
                  <item.Icon fontSize={20} />
                  {!isCollapsed && <span>{item.label}</span>}
                </Link>
              </Tooltip>
            )}
            <div style={{ flex: 1 }} />
            <Tooltip content={isCollapsed ? '展开导航' : '折叠导航'} relationship="label" withArrow positioning="after">
              <div
                onClick={() => setIsCollapsed(!isCollapsed)}
                style={linkStyle(false, isCollapsed)}
              >
                {isCollapsed ? <ChevronRightRegular fontSize={20} /> : <ChevronLeftRegular fontSize={20} />}
                {!isCollapsed && <span>折叠</span>}
              </div>
            </Tooltip>
          </nav>
          <main style={{ flex: 1, overflow: 'auto', padding: 24, position: 'relative' }}>
            <Outlet context={{ dndUrl, setDndUrl }} />
          </main>
        </div>
      </div>
    </div>
  );
}

export default function MainLayout() {
    return <LayoutComponent />;
}