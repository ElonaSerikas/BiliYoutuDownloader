import React, { createContext, useContext, useEffect, useState } from 'react';

interface AppSettings {
  downloadDir?: string;
  concurrency?: number;
  minimizeToTray?: boolean;
  notify?: boolean;
  backgroundImagePath?: string;
  backgroundOpacity?: number;
  theme?: 'light' | 'dark' | 'system';
  [key: string]: any;
}

const SettingsContext = createContext<{
  settings: AppSettings | null;
  saveSettings: (patch: Partial<AppSettings>) => Promise<void>;
}>({
  settings: null,
  saveSettings: async () => {},
});

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
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

export function useSettings() {
  return useContext(SettingsContext);
}