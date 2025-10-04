import React from 'react';
import { Button, Table, TableHeader, TableRow, TableBody, TableCell, TableHeaderCell, Spinner, Body1, Card } from '@fluentui/react-components';

declare global { interface Window { api: any } }

type Check = { id:string; name:string; ok:boolean; details?:string; suggestion?:string };

export default function DiagnosticsPage() {
  const [checks, setChecks] = React.useState<Check[]>([]);
  const [summary, setSummary] = React.useState('');
  const [env, setEnv] = React.useState<any>({});
  const [loading, setLoading] = React.useState(false);

  const runDiag = async () => {
    setLoading(true);
    const r = await window.api.invoke('app:diag:run');
    setChecks(r.checks); setSummary(r.summary); setEnv(r.env);
    setLoading(false);
  }
  
  const exportZip = async () => {
    const p = await window.api.invoke('app:log:export');
    if (p) alert(`已导出诊断包到: ${p}`);
  }

  React.useEffect(() => { runDiag(); }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h2>诊断与日志</h2>

      <Card>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <Button appearance="primary" onClick={runDiag} disabled={loading}>
            {loading ? <Spinner size="tiny" /> : '重新运行健康检查'}
          </Button>
          <Button onClick={exportZip}>导出诊断包 (ZIP)</Button>
        </div>

        <Body1><b>检查结果：</b> {summary}</Body1>
        <Table aria-label="checks" style={{ marginTop: 8 }}>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>项目</TableHeaderCell>
              <TableHeaderCell>状态</TableHeaderCell>
              <TableHeaderCell>详情</TableHeaderCell>
              <TableHeaderCell>建议</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {checks.map(c => (
              <TableRow key={c.id}>
                <TableCell>{c.name}</TableCell>
                <TableCell style={{ color: c.ok ? 'var(--colorPaletteGreenForeground1)' : 'var(--colorPaletteRedForeground1)' }}>
                  {c.ok ? '正常' : '异常'}
                </TableCell>
                <TableCell><pre style={{margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all'}}>{c.details || '-'}</pre></TableCell>
                <TableCell>{c.suggestion || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div style={{ marginTop: '16px', opacity: .8, fontSize: '12px' }}>
          <div><b>系统信息:</b> {env.platform} {env.arch} {env.release}</div>
          <div><b>内存:</b> {env.ramGB} GB | <b>App 版本:</b> {env.appVersion}</div>
          <div><b>用户数据目录:</b> {env.userData}</div>
          <div><b>下载目录:</b> {env.downloadDir}</div>
        </div>
      </Card>
    </div>
  );
}