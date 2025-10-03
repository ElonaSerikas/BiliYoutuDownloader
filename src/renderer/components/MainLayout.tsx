// renderer/components/MainLayout.tsx
import React, { useState, useEffect } from 'react';
import { 
  Acrylic, 
  Nav, 
  NavItem, 
  NavList, 
  Panel, 
  Separator,
  ThemeProvider // 新增：用于应用主题色
} from '@fluentui/react';
import { 
  SearchIcon, 
  DownloadIcon, 
  UserIcon, 
  SettingsIcon 
} from '@fluentui/react-icons-mdl2';
import SearchPage from '../pages/SearchPage';
import DownloadPage from '../pages/DownloadPage';
import SettingsPage from '../pages/SettingsPage';
import UserPage from '../pages/UserPage';
import CustomTitleBar from './CustomTitleBar';

// 定义 Settings 状态结构 (与 SettingsPage.tsx 保持一致)
interface Settings {
    downloadPath: string;
    threadCount: number;
    minimizeToTray: boolean;
    playSoundOnComplete: boolean;
    appTheme: 'light' | 'dark' | 'system';
    accentColor: string;
    backgroundImagePath: string;
    backgroundOpacity: number;
    enableAcrylic: boolean;
}

const defaultSettings: Settings = {
    downloadPath: '',
    threadCount: 5,
    minimizeToTray: true,
    playSoundOnComplete: true,
    appTheme: 'system',
    accentColor: '#0078D4', 
    backgroundImagePath: '',
    backgroundOpacity: 0.7,
    enableAcrylic: true 
};


const MainLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState('search');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  
  // 1. 动态加载设置
  useEffect(() => {
    const loadSettings = async () => {
      const saved = await window.electron.getSettings();
      // 在这里我们应该监听设置变化，但简化为只加载一次
      setSettings(prev => ({ ...prev, ...saved }));
      
      // TODO: 监听设置变化 IPC，实现实时换肤
    };
    loadSettings();
  }, []);

  // 2. 动态计算主题颜色
  const theme = {
    palette: {
      themePrimary: settings.accentColor, // 应用强调色
      themeLighterAlt: `${settings.accentColor}1A`, // 略透明
    },
  };
  
  // 3. 动态计算背景样式
  const mainLayoutStyle: React.CSSProperties = {
    height: '100vh', 
    display: 'flex', 
    flexDirection: 'column',
    // 应用背景图
    backgroundImage: settings.backgroundImagePath ? `url(${settings.backgroundImagePath})` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
  };
  
  // 4. 背景遮罩层
  const backgroundOverlayStyle: React.CSSProperties = {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      // 使用 opacity 和 themeLighterAlt 颜色创建遮罩层
      backgroundColor: `rgba(255, 255, 255, ${1 - settings.backgroundOpacity})`,
      zIndex: -1, // 确保在内容下方
  };


  // 渲染主内容区
  const renderContent = () => {
    switch (activeTab) {
      case 'search': return <SearchPage />;
      case 'download': return <DownloadPage />;
      case 'user': return <UserPage />;
      case 'settings': return <SettingsPage />;
      default: return <SearchPage />;
    }
  };

  // 使用 ThemeProvider 包裹整个应用
  return (
    <ThemeProvider theme={theme}>
      <div style={mainLayoutStyle}>
        {settings.backgroundImagePath && <div style={backgroundOverlayStyle} />}
        
        {/* 自定义标题栏 */}
        <CustomTitleBar 
          title="B站视频下载器" 
          onMinimize={() => window.electron.minimize()}
          onMaximize={() => window.electron.maximize()}
          onClose={() => window.electron.close()}
        />

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* 可折叠侧边栏（亚克力效果） */}
          <Acrylic 
            blurAmount={settings.enableAcrylic ? 20 : 0} // 根据设置启用/禁用亚克力
            tintColor="#ffffff" 
            tintOpacity={settings.enableAcrylic ? 0.7 : 1}
            style={{ 
              width: sidebarCollapsed ? 60 : 200,
              transition: 'width 0.3s ease',
              // 侧边栏背景为透明，以便看到背景图
              backgroundColor: 'transparent'
            }}
          >
            {/* ... NavList 和 NavItem 保持不变 ... */}
            <NavList onItemClick={(item) => setActiveTab(item.key as string)}>
              <NavItem 
                key="search" 
                icon={<SearchIcon />}
                label={!sidebarCollapsed && "搜索"}
                active={activeTab === 'search'}
              />
              <NavItem 
                key="download" 
                icon={<DownloadIcon />}
                label={!sidebarCollapsed && "下载管理"}
                active={activeTab === 'download'}
              />
              <NavItem 
                key="user" 
                icon={<UserIcon />}
                label={!sidebarCollapsed && "用户中心"}
                active={activeTab === 'user'}
              />
              <NavItem 
                key="settings" 
                icon={<SettingsIcon />}
                label={!sidebarCollapsed && "设置"}
                active={activeTab === 'settings'}
              />
            </NavList>
            
            {/* 折叠按钮 */}
            <div 
              style={{ 
                position: 'absolute', 
                right: -8, 
                top: '50%', 
                width: 16, 
                height: 32,
                backgroundColor: '#ffffff',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              <span>{sidebarCollapsed ? '→' : '←'}</span>
            </div>
          </Acrylic>

          {/* 主内容区 */}
          <Panel style={{ flex: 1, overflow: 'auto', backgroundColor: 'transparent' }}>
            {renderContent()}
          </Panel>
        </div>
      </div>
    </ThemeProvider>
  );
};

export default MainLayout;