import React from 'react'; // Corrected: Removed trailing comma
import {
  Button,
  Input,
  Slider,
  Switch,
  Field,
  Card,
  Body1,
  Dropdown,
  Option,
  makeStyles,
  shorthands,
  useToastController,
  Toast,
  ToastTitle,
  Toaster,
  Caption1
} from '@fluentui/react-components';
import { useSettings } from '../../contexts/SettingsContext';
import { FolderOpenRegular, ImageRegular } from '@fluentui/react-icons';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('24px'),
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('16px'),
    ...shorthands.padding('20px'),
  },
  grid: {
    display: 'grid',
    ...shorthands.gap('16px'),
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('4px'),
  },
  inputWithButton: {
    display: 'flex',
    ...shorthands.gap('8px'),
    alignItems: 'center',
  }
});

export default function SettingsPage() {
  const styles = useStyles();
  const { settings, saveSettings } = useSettings();
  const toasterId = "settings-toaster";
  const { dispatchToast } = useToastController(toasterId);

  const handleSave = async (patch: Record<string, any>) => {
    try {
      await saveSettings(patch);
      dispatchToast(
        <Toast><ToastTitle>设置已保存</ToastTitle></Toast>,
        { intent: 'success' }
      );
    } catch (e: any) {
      dispatchToast(
        <Toast><ToastTitle>保存失败: {e.message}</ToastTitle></Toast>,
        { intent: 'error' }
      );
    }
  };

  const selectPath = async (field: 'downloadDir' | 'backgroundImagePath') => {
    const method = field === 'downloadDir' ? 'app:dialog:openDirectory' : 'app:dialog:openFile';
    const path = await window.api.invoke(method);
    if (path) {
      handleSave({ [field]: path });
    }
  };

  if (!settings) return null;

  return (
    <div className={styles.root}>
      <Toaster toasterId={toasterId} />
      <h2>应用设置</h2>

      <Card className={styles.card}>
        <Body1><b>外观与行为</b></Body1>
        <div className={styles.grid}>
          <Field className={styles.field} label="应用主题">
            <Dropdown
              value={settings.theme || 'system'}
              onOptionSelect={(_, d) => handleSave({ theme: d.optionValue })}
            >
              <Option value="system">跟随系统</Option>
              <Option value="light">亮色模式</Option>
              <Option value="dark">暗色模式</Option>
            </Dropdown>
          </Field>
          <Field className={styles.field} label="自定义背景图">
            <div className={styles.inputWithButton}>
              <Input
                readOnly
                value={settings.backgroundImagePath || ''}
                placeholder="未设置"
                style={{ flexGrow: 1 }}
              />
              <Button icon={<ImageRegular />} onClick={() => selectPath('backgroundImagePath')}>选择</Button>
            </div>
          </Field>
          <Field className={styles.field} label={`背景不透明度: ${Math.round((settings.backgroundOpacity ?? 0.7) * 100)}%`}>
            <Slider
              min={0.1} max={1} step={0.05}
              value={settings.backgroundOpacity ?? 0.7}
              onChange={(_, d) => handleSave({ backgroundOpacity: d.value })}
            />
          </Field>
          <div />
          <Field className={styles.field}>
            <Switch
              label="关闭时最小化到系统托盘"
              checked={settings.minimizeToTray ?? true}
              onChange={(_, d) => handleSave({ minimizeToTray: d.checked })}
            />
          </Field>
          <Field className={styles.field}>
            <Switch
              label="下载完成后发送系统通知"
              checked={settings.notify ?? true}
              onChange={(_, d) => handleSave({ notify: d.checked })}
            />
          </Field>
        </div>
      </Card>

      <Card className={styles.card}>
        <Body1><b>下载设置</b></Body1>
        <div className={styles.grid}>
          <Field className={styles.field} label="下载目录" required>
            <div className={styles.inputWithButton}>
              <Input
                readOnly
                value={settings.downloadDir || ''}
                placeholder="请选择一个目录"
                style={{ flexGrow: 1 }}
              />
              <Button icon={<FolderOpenRegular />} onClick={() => selectPath('downloadDir')}>选择</Button>
            </div>
          </Field>
          <Field className={styles.field} label={`同时下载任务数: ${settings.concurrency ?? 4}`}>
            <Slider
              min={1} max={10} step={1}
              value={settings.concurrency ?? 4}
              onChange={(_, d) => handleSave({ concurrency: d.value })}
            />
          </Field>
          <Field className={styles.field} label="文件名模板">
            <Input
              defaultValue={settings.filenameTpl || '{title}-{id}'}
              onBlur={(e) => handleSave({ filenameTpl: e.target.value })}
              placeholder="{title}-{id}"
            />
            <Caption1>可用变量: {`{title}`} {`{id}`}</Caption1>
          </Field>
          <Field className={styles.field} label="FFmpeg 路径 (可选)">
             <Input
              defaultValue={settings.ffmpegPath || ''}
              onBlur={(e) => handleSave({ ffmpegPath: e.target.value })}
              placeholder="留空则使用系统环境变量"
            />
          </Field>
        </div>
      </Card>

      <Card className={styles.card}>
        <Body1><b>弹幕样式 (ASS 格式)</b></Body1>
        <div className={styles.grid}>
          <Field className={styles.field} label="字体名称">
            <Input
              defaultValue={settings.danmaku?.fontName || 'Microsoft YaHei'}
              onBlur={(e) => handleSave({ danmaku: { ...settings.danmaku, fontName: e.target.value } })}
            />
          </Field>
           <Field className={styles.field} label="字体大小">
            <Input
              type="number"
              defaultValue={String(settings.danmaku?.fontSize || 42)}
              onChange={(_, d) => handleSave({ danmaku: { ...settings.danmaku, fontSize: Number(d.value) } })}
            />
          </Field>
           <Field className={styles.field} label="描边宽度">
            <Input
              type="number"
              defaultValue={String(settings.danmaku?.outline || 3)}
              onChange={(_, d) => handleSave({ danmaku: { ...settings.danmaku, outline: Number(d.value) } })}
            />
          </Field>
          <Field className={styles.field} label="滚动弹幕时长 (秒)">
            <Input
              type="number"
              defaultValue={String(settings.danmaku?.scrollDuration || 8)}
              onChange={(_, d) => handleSave({ danmaku: { ...settings.danmaku, scrollDuration: Number(d.value) } })}
            />
          </Field>
          <Field className={styles.field} label="顶部/底部弹幕时长 (秒)">
            <Input
              type="number"
              defaultValue={String(settings.danmaku?.staticDuration || 5)}
              onChange={(_, d) => handleSave({ danmaku: { ...settings.danmaku, staticDuration: Number(d.value) } })}
            />
          </Field>
          <Field className={styles.field} label={`弹幕不透明度: ${Math.round((settings.danmaku?.opacity ?? 0.8) * 100)}%`}>
            <Slider
              min={0} max={1} step={0.1}
              value={settings.danmaku?.opacity ?? 0.8}
              onChange={(_, d) => handleSave({ danmaku: { ...settings.danmaku, opacity: d.value } })}
            />
          </Field>
        </div>
      </Card>
    </div>
  );
}