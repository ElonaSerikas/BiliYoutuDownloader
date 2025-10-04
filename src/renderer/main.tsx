import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { FluentProvider, webLightTheme, teamsDarkTheme, Theme } from '@fluentui/react-components';

import App from './App';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import ErrorBoundary from './components/ErrorBoundary';
import './styles/index.css'; // 全局样式

// 主题切换组件
const ThemedApp = () => {
  const { settings } = useSettings();
  const theme: Theme = settings?.theme === 'dark' ? teamsDarkTheme : webLightTheme;
  return (
    <FluentProvider theme={theme}>
      <App />
    </FluentProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <SettingsProvider>
        <HashRouter>
          <ThemedApp />
        </HashRouter>
      </SettingsProvider>
    </ErrorBoundary>
  </React.StrictMode>
);