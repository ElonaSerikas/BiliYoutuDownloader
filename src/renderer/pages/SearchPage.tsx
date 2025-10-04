import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Button, Input, Card, Radio, RadioGroup, Field, Body1, Caption1, Spinner, Divider, Checkbox, Dialog, DialogSurface, DialogTitle, DialogBody, DialogActions, Tooltip,
  Toast, Toaster, useToastController, ToastTitle, makeStyles, shorthands, tokens
} from '@fluentui/react-components';
import {
  SearchRegular, ArrowDownloadRegular, AddCircleRegular, MoviesAndTvRegular,
  CommentRegular, PersonRegular, DismissRegular
} from '@fluentui/react-icons';
import { formatBytes, formatDuration } from '../utils/format';

// This type must be kept in sync with types.ts
type StreamInfo = {
  id: string; type: 'video' | 'audio'; container: string; codec?: string;
  qualityLabel?: string; bitrate?: number; fps?: number; sizeEstimate?: number;
  url?: string; extras?: Record<string, any>;
};
type ParseResult = {
  platform: 'bili' | 'yt'; id: string; title: string; cover?: string;
  duration?: number; author?: { name: string; id?: string; face?: string };
  streams: StreamInfo[]; extras?: Record<string, any>;
};

type BatchItem = { bvid: string; title: string; checked: boolean; };

const useStyles = makeStyles({
    root: { display: 'flex', flexDirection: 'column', gap: '16px' },
    inputSection: { display: 'flex', gap: '8px', alignItems: 'center' },
    resultCard: { ...shorthands.padding('16px'), display: 'flex', flexDirection: 'column', gap: '12px' },
    streamGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', ...shorthands.gap('16px') },
    streamList: { display: 'flex', flexDirection: 'column', ...shorthands.gap('8px') },
    batchList: { maxHeight: '400px', overflowY: 'auto', ...shorthands.padding('8px') }
});

export default function SearchPage() {
  const styles = useStyles();
  const { dndUrl, setDndUrl } = useOutletContext<{ dndUrl: string, setDndUrl: (url: string) => void }>();
  const [url, setUrl] = useState('');
  const [info, setInfo] = useState<ParseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selV, setSelV] = useState('');
  const [selA, setSelA] = useState('');
  
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  const toasterId = "search-toaster";
  const { dispatchToast } = useToastController(toasterId);
  const notify = (message: string, intent: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    dispatchToast(<Toast><ToastTitle>{message}</ToastTitle></Toast>, { intent });
  };

  useEffect(() => {
    if (dndUrl) {
      setUrl(dndUrl);
      parse(dndUrl);
      setDndUrl(''); // Consume the URL
    }
  }, [dndUrl]);

  const parse = async (link = url) => {
    if (!link.trim()) return;
    setInfo(null); setLoading(true);
    try {
      const r = await window.api.invoke('app:media:parse', link.trim()) as ParseResult;
      setInfo(r);
      const videos = r.streams.filter((s: StreamInfo) => s.type === 'video');
      const audios = r.streams.filter((s: StreamInfo) => s.type === 'audio');
      if (videos.length > 0) setSelV(videos[0].id);
      if (audios.length > 0) setSelA(audios[0].id);
    } catch (e: any) {
      notify(`解析失败: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBatchParse = async () => {
    if (!url.trim()) return;
    setBatchLoading(true);
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
      notify(`批量解析失败: ${e.message}`, 'error');
    } finally {
      setBatchLoading(false);
    }
  };

  const addTask = async (taskInfo: ParseResult, vId: string, aId: string) => {
    const v = taskInfo.streams.find(s => s.id === vId);
    const a = taskInfo.streams.find(s => s.id === aId);
    
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
      notify(e.message, 'error');
    }
  };

  const addBatchTasks = async () => {
    const selected = batchItems.filter(it => it.checked);
    if(selected.length === 0) {
        notify('请至少选择一个视频', 'warning');
        return;
    }
    setBatchLoading(true);
    let successCount = 0;
    for (const item of selected) {
      try {
        const r = await window.api.invoke('app:media:parse', `https://www.bilibili.com/video/${item.bvid}`) as ParseResult;
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
  
  const videoStreams = info?.streams.filter(s => s.type === 'video') || [];
  const audioStreams = info?.streams.filter(s => s.type === 'audio') || [];

  return (
    <div className={styles.root}>
      <Toaster toasterId={toasterId} />
      <div className={styles.inputSection}>
        <Input placeholder="粘贴 B站/YouTube 视频链接、收藏夹或UP主空间链接" style={{ flexGrow: 1 }} value={url} onChange={(_, d) => setUrl(d.value)} />
        <Button appearance="primary" icon={<SearchRegular />} onClick={() => parse()} disabled={loading}>解析</Button>
        <Button icon={<AddCircleRegular />} onClick={handleBatchParse} disabled={batchLoading}>批量解析</Button>
      </div>

      {loading && <Spinner label="正在解析..." />}

      {info && (
        <Card className={styles.resultCard}>
            <div style={{ display: 'flex', gap: '16px' }}>
                <img src={info.cover} alt={info.title} style={{ width: '160px', height: '100px', objectFit: 'cover', borderRadius: tokens.borderRadiusMedium }} />
                <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                    <Body1 block><b>{info.title}</b></Body1>
                    <Caption1 block style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
                        <PersonRegular /> {info.author?.name}
                    </Caption1>
                    <Caption1 block style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MoviesAndTvRegular /> {formatDuration(info.duration || 0)}
                    </Caption1>
                </div>
            </div>

            <Divider />

            <div className={styles.streamGrid}>
                <Field label="选择视频流">
                    <RadioGroup value={selV} onChange={(_, d) => setSelV(d.value)} className={styles.streamList}>
                        {videoStreams.map(s => 
                            <Radio key={s.id} value={s.id} label={`${s.qualityLabel} (${s.codec}, ${formatBytes(s.sizeEstimate || 0)})`} />
                        )}
                        {videoStreams.length === 0 && <Radio value="none" label="无视频流" disabled />}
                    </RadioGroup>
                </Field>
                <Field label="选择音频流">
                    <RadioGroup value={selA} onChange={(_, d) => setSelA(d.value)} className={styles.streamList}>
                        {audioStreams.map(s => 
                            <Radio key={s.id} value={s.id} label={`${s.qualityLabel} (${s.codec}, ${formatBytes(s.sizeEstimate || 0)})`} />
                        )}
                        {audioStreams.length === 0 && <Radio value="none" label="无音频流" disabled />}
                    </RadioGroup>
                </Field>
            </div>

            <Divider />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <Button icon={<CommentRegular />}>下载评论</Button>
                <Button icon={<MoviesAndTvRegular />}>下载弹幕</Button>
                <Button appearance="primary" icon={<ArrowDownloadRegular />} onClick={addSingleTask}>添加到下载</Button>
            </div>
        </Card>
      )}

      <Dialog open={isBatchDialogOpen} onOpenChange={(_, data) => !data.open && setIsBatchDialogOpen(false)}>
        <DialogSurface>
            <DialogTitle>批量添加任务</DialogTitle>
            <DialogBody>
                <div className={styles.batchList}>
                    {batchItems.map((item, index) => (
                        <Checkbox key={item.bvid} label={item.title} checked={item.checked} 
                            onChange={(_, data) => {
                                const newItems = [...batchItems];
                                newItems[index].checked = !!data.checked;
                                setBatchItems(newItems);
                            }}
                        />
                    ))}
                </div>
            </DialogBody>
            <DialogActions>
                <Button appearance="secondary" onClick={() => setIsBatchDialogOpen(false)}>取消</Button>
                <Button appearance="primary" icon={batchLoading ? <Spinner size="tiny" /> : <AddCircleRegular />} disabled={batchLoading} onClick={addBatchTasks}>
                    添加到队列
                </Button>
            </DialogActions>
        </DialogSurface>
      </Dialog>
    </div>
  );
}