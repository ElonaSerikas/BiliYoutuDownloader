import React, { createContext, useContext, useEffect, useState } from 'react';

// 1. 定义设置的数据结构
interface AppSettings {
  downloadDir?: string;
  concurrency?: number;
  minimizeToTray?: boolean;
  notify?: boolean;
  backgroundImagePath?: string;
  backgroundOpacity?: number;
  [key: string]: any; // 允许其他设置项
}

// 2. 创建 Settings Context
const SettingsContext = createContext<{
  settings: AppSettings | null;
  saveSettings: (patch: Partial<AppSettings>) => Promise<void>;
}>({
  settings: null,
  saveSettings: async () => {},
});

// 3. 创建 SettingsProvider 组件
export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    // 组件挂载时，从主进程异步加载设置
    window.api.invoke('app:settings:get').then(setSettings);
  }, []);

  const saveSettings = async (patch: Partial<AppSettings>) => {
    const newSettings = await window.api.invoke('app:settings:set', patch);
    setSettings(newSettings);
  };

  return (
    <SettingsContext.Provider value={{ settings, saveSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

// 4. 创建 useSettings 钩子，方便子组件使用
export function useSettings() {
  return useContext(SettingsContext);
}