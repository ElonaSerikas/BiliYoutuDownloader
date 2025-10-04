import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Button, Input, Card, Radio, RadioGroup, Field, Body1, Caption1, Spinner, Divider,
  Checkbox, Dialog, DialogSurface, DialogTitle, DialogBody, DialogActions, Tooltip,
  Toast, Toaster, useToastController, ToastTitle, ToastBody
} from '@fluentui/react-components';
import {
  SearchRegular, DownloadRegular, AddCircleRegular, MoviesAndTvRegular,
  CommentRegular, PersonRegular, ArrowDownloadRegular, DismissRegular
} from '@fluentui/react-icons';
import { formatBytes } from '../utils/format';
import type { ParseResult, StreamInfo } from '../../main/services/extractors/types';

// ... (此处省略 formatBytes 函数, 已移至 utils)

type BatchItem = { bvid: string; title: string; checked: boolean; };

export default function SearchPage() {
  const { dndUrl } = useOutletContext<{ dndUrl: string }>();
  const [url, setUrl] = useState('');
  const [info, setInfo] = useState<ParseResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  const [selV, setSelV] = useState('');
  const [selA, setSelA] = useState('');
  
  // 批量下载状态
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  // Toast 通知
  const toasterId = "search-toaster";
  const { dispatchToast } = useToastController(toasterId);
  const notify = (message: string, intent: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    dispatchToast(
      <Toast>
        <ToastTitle>{message}</ToastTitle>
      </Toast>,
      { intent }
    );
  };

  useEffect(() => {
    if (dndUrl) {
      setUrl(dndUrl);
      parse(dndUrl);
    }
  }, [dndUrl]);

  const parse = async (link = url) => {
    if (!link.trim()) return;
    setError(null); setInfo(null); setLoading(true);
    try {
      const r = await window.api.invoke('app:media:parse', link.trim());
      setInfo(r);
      const videos = r.streams.filter((s: StreamInfo) => s.type === 'video');
      const audios = r.streams.filter((s: StreamInfo) => s.type === 'audio');
      if (videos.length > 0) setSelV(videos[0].id);
      if (audios.length > 0) setSelA(audios[0].id);
    } catch (e: any) {
      setError(e);
      notify(`解析失败: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBatchParse = async () => {
    if (!url.trim()) return;
    setBatchLoading(true); setError(null);
    try {
      let items: { bvid: string, title: string }[] = [];
      const trimmedUrl = url.trim();
      if (trimmedUrl.includes('favlist')) {
        const mediaId = new URL(trimmedUrl).searchParams.get('fid');
        if (!mediaId) throw new Error("无法从收藏夹链接中找到 fid");
        items = await window.api.invoke('app:batch:bili:fav', mediaId);
      } else if (trimmedUrl.includes('space.bilibili.com')) {
        const mid = trimmedUrl.split('/')[3].split('?')[0];
        items = await window.api.invoke('app:batch:bili:series', mid);
      } else {
        throw new Error("请输入有效的 B 站收藏夹或 UP 主合集/空间链接");
      }
      setBatchItems(items.map(it => ({ ...it, checked: true })));
      setIsBatchDialogOpen(true);
    } catch (e: any) {
      setError(e);
      notify(`批量解析失败: ${e.message}`, 'error');
    } finally {
      setBatchLoading(false);
    }
  };

  const addTask = async (taskInfo: ParseResult, vId: string, aId: string) => {
    const v = taskInfo.streams.find(s => s.id === vId);
    const a = taskInfo.streams.find(s => s.id === aId);
    if (!v && !a) throw new Error('请至少选择一个有效的视频或音频流');
    
    const settings = await window.api.invoke('app:settings:get');
    if (!settings?.downloadDir) throw new Error('请先在“应用设置”中配置下载目录');

    const payload = {
      platform: taskInfo.platform, title: taskInfo.title, target: settings.downloadDir,
      id: taskInfo.id, meta: taskInfo.extras, streams: { video: v?.url, audio: a?.url },
      settings: { filenameTpl: settings.filenameTpl },
    };
    await window.api.invoke('app:task:create', payload);
  };

  const addSingleTask = async () => {
    if (!info) return;
    try {
      await addTask(info, selV, selA);
      notify(`任务 "${info.title}" 已加入下载队列`);
    } catch (e: any) {
      setError(e);
      notify(e.message, 'error');
    }
  };

  const addBatchTasks = async () => {
    const selected = batchItems.filter(it => it.checked);
    setBatchLoading(true);
    let successCount = 0;
    for (const item of selected) {
      try {
        const r = await window.api.invoke('app:media:parse', `https://www.bilibili.com/video/${item.bvid}`);
        const bestV = r.streams.filter((s: StreamInfo) => s.type === 'video')[0]?.id;
        const bestA = r.streams.filter((s: StreamInfo) => s.type === 'audio')[0]?.id;
        if (bestV || bestA) {
          await addTask(r, bestV, bestA);
          successCount++;
        }
      } catch (e) { console.error(`批量添加失败: ${item.title}`, e); }
    }
    setBatchLoading(false);
    setIsBatchDialogOpen(false);
    notify(`批量任务添加完成！成功 ${successCount} / ${selected.length} 个`, 'success');
  };
  
  // ... 渲染逻辑 ...
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Toaster toasterId={toasterId} />
      {/* 搜索区域 */}
      {/* 错误提示 */}
      {/* 解析结果卡片 */}
      {/* 批量下载对话框 */}
    </div>
  );
}