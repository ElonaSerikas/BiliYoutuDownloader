import React from 'react';
import { Routes, Route } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import SearchPage from './pages/SearchPage';
import DownloadPage from './pages/DownloadPage';
import SettingsPage from './pages/SettingsPage';
import UserPage from './pages/UserPage';
import DiagnosticsPage from './pages/DiagnosticsPage';
import AboutPage from './pages/AboutPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<SearchPage />} />
        <Route path="downloads" element={<DownloadPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="user" element={<UserPage />} />
        <Route path="diagnostics" element={<DiagnosticsPage />} />
        <Route path="about" element={<AboutPage />} />
      </Route>
    </Routes>
  );
}

export default App;