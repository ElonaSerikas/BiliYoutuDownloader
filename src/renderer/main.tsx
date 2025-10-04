import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { FluentProvider, webLightTheme, teamsDarkTheme, Theme } from '@fluentui/react-components';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import ErrorBoundary from './components/ErrorBoundary';
import App from './App';
import './styles/index.css';

const ThemedApp = () => {
  const { settings } = useSettings();
  
  const getTheme = (): Theme => {
    if (settings?.theme === 'dark') return teamsDarkTheme;
    if (settings?.theme === 'light') return webLightTheme;
    // system theme
    const isSystemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return isSystemDark ? teamsDarkTheme : webLightTheme;
  };
  
  const [theme, setTheme] = React.useState<Theme>(getTheme);

  React.useEffect(() => {
    setTheme(getTheme());
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => setTheme(getTheme());
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [settings?.theme]);

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