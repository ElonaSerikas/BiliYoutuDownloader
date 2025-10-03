import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './layout/MainLayout';
import SearchPage from './pages/SearchPage';
import DownloadPage from './pages/DownloadPage';
import SettingsPage from './pages/SettingsPage';
import UserPage from './pages/UserPage';
import Diagnostics from './routes/Diagnostics';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <HashRouter>
    <Routes>
      <Route path="/" element={<MainLayout/>}>
        <Route index element={<SearchPage/>} />
        <Route path="downloads" element={<DownloadPage/>} />
        <Route path="settings" element={<SettingsPage/>} />
        <Route path="user" element={<UserPage/>} />
        <Route path="diagnostics" element={<Diagnostics/>} />
      </Route>
    </Routes>
  </HashRouter>
);
