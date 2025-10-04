import React, { useEffect, useState, useMemo } from 'react';
import {
  Button,
  Card,
  ProgressBar,
  Body1,
  Caption1,
  Spinner,
  Tag,
  Tab,
  TabList,
  Persona,
  Menu,
  MenuTrigger,
  MenuList,
  MenuItem,
  MenuPopover,
  makeStyles,
  shorthands,
  tokens,
} from '@fluentui/react-components';
import {
  FolderOpenRegular,
  DocumentRegular,
  PlayRegular,
  PauseRegular,
  DismissRegular,
  ArrowClockwiseRegular,
  MoreHorizontalRegular,
  CheckmarkCircleRegular,
  ErrorCircleRegular,
  WarningRegular,
  TimerRegular
} from '@fluentui/react-icons';
import { formatBytes } from '../utils/format';
import type { Task } from '../../main/services/downloader/DownloadManager';

// --- 类型定义 ---
type TabValue = 'all' | 'downloading' | 'done' | 'error';

// --- Fluent UI 样式钩子 ---
const useStyles = makeStyles({
  grid: {
    display: 'grid',
    ...shorthands.gap('16px'),
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('10px'),
    transitionProperty: 'transform, box-shadow',
    transitionDuration: '0.2s',
    transitionTimingFunction: 'ease-in-out',
    ':hover': {
      transform: 'translateY(-4px)',
      boxShadow: tokens.shadow16,
    }
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  persona: {
    minWidth: 0, // 修复 Persona 文本过长导致布局挤压的问题
  },
  actions: {
    display: 'flex',
    ...shorthands.gap('8px'),
    flexWrap: 'wrap',
  },
});

// --- 任务卡片组件 ---
const TaskCard = ({ task }: { task: Task }) => {
  const styles = useStyles();
  const pct = task.progress.total > 0 ? task.progress.downloaded / task.progress.total : 0;

  // 根据任务状态显示不同的标签和图标
  const StatusTag = () => {
    switch (task.status) {
      case 'running': return <Tag appearance="brand" icon={<Spinner size="tiny" />}>下载中</Tag>;
      case 'done': return <Tag appearance="brand" icon={<CheckmarkCircleRegular />}>已完成</Tag>;
      case 'error': return <Tag appearance="filled" color="danger" icon={<ErrorCircleRegular />}>错误</Tag>;
      case 'paused': return <Tag appearance="filled" color="warning" icon={<WarningRegular />}>已暂停</Tag>;
      case 'queued': return <Tag appearance="filled" color="info" icon={<TimerRegular />}>排队中</Tag>;
      case 'canceled': return <Tag appearance="filled" icon={<DismissRegular />}>已取消</Tag>;
      default: return <Tag>{task.status}</Tag>;
    }
  };

  const control = (action: 'pause' | 'resume' | 'cancel' | 'delete') => {
    window.api.invoke('app:task:control', { id: task.id, action });
  };

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <Persona
          className={styles.persona}
          avatar={{ color: task.platform === 'bili' ? 'cornflower' : 'red', 'aria-hidden': true, name: task.platform.toUpperCase() }}
          name={<Body1 block><b>{task.title}</b></Body1>}
          secondaryText={<Caption1>{task.id}</Caption1>}
        />
        <StatusTag />
      </div>

      <ProgressBar
        value={pct}
        shape="rounded"
        thickness="medium"
        color={task.status === 'error' ? 'error' : 'brand'}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Caption1>{formatBytes(task.progress.downloaded)} / {formatBytes(task.progress.total)}</Caption1>
        {task.status === 'running' && <Caption1>{formatBytes(task.progress.speed, true)}</Caption1>}
      </div>

      {task.error && <Caption1 style={{ color: tokens.colorPaletteRedForeground1 }}>错误: {task.error}</Caption1>}

      <div className={styles.actions}>
        {task.status === 'running' && <Button size="small" icon={<PauseRegular />} onClick={() => control('pause')}>暂停</Button>}
        {(task.status === 'paused' || task.status === 'error') && <Button size="small" icon={<PlayRegular />} appearance="primary" onClick={() => control('resume')}>继续/重试</Button>}
        {task.status === 'done' && task.outFile && <Button size="small" icon={<DocumentRegular />} onClick={() => window.api.invoke('app:shell:showItem', task.outFile)}>打开文件</Button>}
        <Button size="small" icon={<FolderOpenRegular />} onClick={() => window.api.invoke('app:shell:openPath', task.target)}>打开目录</Button>

        <Menu>
          <MenuTrigger disableButtonEnhancement>
            <Button size="small" icon={<MoreHorizontalRegular />} aria-label="更多操作" />
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              {(task.status === 'running' || task.status === 'queued') && <MenuItem icon={<DismissRegular />} onClick={() => control('cancel')}>取消任务</MenuItem>}
              {(task.status !== 'running' && task.status !== 'queued') && <MenuItem icon={<ArrowClockwiseRegular />} onClick={() => control('resume')}>重新下载</MenuItem>}
              <MenuItem icon={<DismissRegular />} onClick={() => control('delete')}>删除记录</MenuItem>
            </MenuList>
          </MenuPopover>
        </Menu>
      </div>
    </Card>
  );
};

// --- 主页面组件 ---
export default function DownloadPage() {
  const styles = useStyles();
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [activeTab, setActiveTab] = useState<TabValue>('all');

  useEffect(() => {
    // 首次加载任务列表
    window.api.invoke('app:task:list').then(setAllTasks);
    // 监听主进程的任务更新事件
    const removeListener = window.api.on('app:task-update', (updatedTasks: Task[]) => {
      setAllTasks(updatedTasks);
    });
    // 组件卸载时清理监听器
    return () => { removeListener?.(); };
  }, []);

  // 根据标签页过滤任务
  const filteredTasks = useMemo(() => {
    switch (activeTab) {
      case 'downloading': return allTasks.filter(t => ['running', 'queued', 'paused'].includes(t.status));
      case 'done': return allTasks.filter(t => t.status === 'done');
      case 'error': return allTasks.filter(t => ['error', 'canceled'].includes(t.status));
      default: return allTasks;
    }
  }, [allTasks, activeTab]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <TabList selectedValue={activeTab} onTabSelect={(_, d) => setActiveTab(d.value as TabValue)}>
        <Tab value="all">所有任务 ({allTasks.length})</Tab>
        <Tab value="downloading">进行中 ({allTasks.filter(t => ['running', 'queued', 'paused'].includes(t.status)).length})</Tab>
        <Tab value="done">已完成 ({allTasks.filter(t => t.status === 'done').length})</Tab>
        <Tab value="error">失败/取消 ({allTasks.filter(t => ['error', 'canceled'].includes(t.status)).length})</Tab>
      </TabList>

      <div className={styles.grid}>
        {filteredTasks.length > 0
          ? filteredTasks.map(t => <TaskCard key={t.id} task={t} />)
          : <Body1>此分类下暂无任务。</Body1>
        }
      </div>
    </div>
  );
}