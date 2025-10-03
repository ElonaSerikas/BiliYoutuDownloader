import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import CustomTitleBar from '../components/CustomTitleBar';
import { SettingsRegular, SearchRegular, CloudDownloadRegular, PeopleRegular, InfoRegular } from '@fluentui/react-icons'; 

// 侧边栏样式：可折叠/展开的过渡效果
const navStyle = (isCollapsed: boolean): React.CSSProperties => ({
  width: isCollapsed ? 60 : 220, 
  minWidth: 60,
  borderRight:'1px solid var(--colorNeutralStroke1)',
  padding: isCollapsed ? 0 : 12, 
  display:'flex', 
  flexDirection:'column', 
  gap: 4, 
  transition: 'width 0.3s ease-in-out',
  flexShrink: 0
});

// 导航项样式 (Fluent-like NavItem)
const linkStyle = (active:boolean, isCollapsed: boolean): React.CSSProperties => ({
  padding: '10px 12px', 
  borderRadius: 8, 
  textDecoration:'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: isCollapsed ? 'center' : 'flex-start',
  gap: 8,
  background: active ? 'var(--colorNeutralBackground3)' : 'transparent',
  color: active ? 'var(--colorNeutralForeground1)' : 'var(--colorNeutralForeground2)',
  fontWeight: active ? 'bold' : 'normal',
  transition: 'all 0.15s ease-out',
});

// 图标映射
const NavItems = [
  { to: "/", label: "搜索/解析", Icon: SearchRegular },
  { to: "/downloads", label: "下载管理", Icon: CloudDownloadRegular },
  { to: "/settings", label: "设置", Icon: SettingsRegular },
  { to: "/user", label: "用户中心", Icon: PeopleRegular },
  { to: "/diagnostics", label: "诊断与日志", Icon: InfoRegular }, 
];

export default function MainLayout(){
  const { pathname } = useLocation();
  const [isCollapsed, setIsCollapsed] = React.useState(false); 

  return (
    <div style={{height:'100vh', width:'100vw', display:'flex', flexDirection:'column'}}>
      <CustomTitleBar/>
      <div style={{display:'flex', height:'calc(100% - 40px)'}}>
        
        {/* 侧边栏 */}
        <nav style={navStyle(isCollapsed)}>
          {NavItems.map(item => (
            <Link key={item.to} to={item.to} style={linkStyle(pathname===item.to, isCollapsed)}>
              <item.Icon />
              <span style={{ display: isCollapsed ? 'none' : 'block', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                {item.label}
              </span>
            </Link>
          ))}
          
          {/* 折叠按钮 */}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)} 
            style={{ 
              marginTop: 'auto', 
              width: isCollapsed ? '100%' : '100%',
              padding: 10,
              cursor: 'pointer',
              border: '1px solid var(--colorNeutralStroke1)',
              borderRadius: 8,
              background: 'var(--colorNeutralBackground1)',
              textAlign: isCollapsed ? 'center' : 'left',
              transition: 'background 0.15s ease-out',
            }}
            title={isCollapsed ? '展开' : '折叠'}
          >
            {isCollapsed ? '→' : '←' + ' 导航'}
          </button>
        </nav>
        
        {/* 主内容区 */}
        <main style={{flex:1, overflow:'auto', padding:16}}>
          <Outlet/>
        </main>
      </div>
    </div>
  );
}