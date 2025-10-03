import React from 'react';
import { Button, Input, Dropdown, Option, Table, TableHeader, TableRow, TableBody, TableCell, TableHeaderCell, Textarea } from '@fluentui/react-components';

declare global { interface Window { api: any } }

type LogRow = { ts:string; level:string; tag?:string; msg:string; data?:any } | string;
type Check = { id:string; name:string; ok:boolean; details?:string; suggestion?:string };

export default function Diagnostics() {
  const [logs, setLogs] = React.useState<LogRow[]>([]);
  const [level, setLevel] = React.useState<'all'|'debug'|'info'|'warn'|'error'>('all');
  const [kw, setKw] = React.useState('');
  const [checks, setChecks] = React.useState<Check[]>([]);
  const [summary, setSummary] = React.useState('');
  const [env, setEnv] = React.useState<any>({});

  async function loadLogs() {
    const rows = await window.api.invoke('log:recent', 3000);
    setLogs(rows);
  }
  async function runDiag() {
    const r = await window.api.invoke('diag:run');
    setChecks(r.checks); setSummary(r.summary); setEnv(r.env);
  }
  async function exportZip() {
    const p = await window.api.invoke('log:export');
    if (p) alert(`已导出：${p}`);
  }
  async function importZip() {
    const r = await window.api.invoke('log:import');
    if (!r) return;
    alert('已载入诊断包（只读查看），不会覆盖当前配置');
    // 展示历史报告
    if (r.report?.checks) {
      setChecks(r.report.checks);
      setSummary(r.report.summary + '（历史包）');
      setEnv(r.report.env);
    }
    // 展示历史日志（拼到当前尾部）
    const more: LogRow[] = (r.logs || []).flatMap((f:any)=> f.content.trim().split('\n').map((l:string)=> {
      try { return JSON.parse(l) } catch { return l }
    }));
    setLogs(prev => [...prev, ...more]);
  }

  React.useEffect(() => { loadLogs(); runDiag(); }, []);

  const filtered = logs.filter((r:any) => {
    const okLevel = level==='all' ? true : (typeof r==='string' ? false : r.level===level);
    const okKw = !kw ? true : JSON.stringify(r).toLowerCase().includes(kw.toLowerCase());
    return okLevel && okKw;
  });

  return (
    <div>
      <h2>诊断与日志</h2>

      <section style={{ marginBottom: 18 }}>
        <Button appearance="primary" onClick={runDiag} style={{ marginRight: 8 }}>运行健康检查</Button>
        <Button onClick={exportZip} style={{ marginRight: 8 }}>导出诊断包（ZIP）</Button>
        <Button onClick={importZip}>导入诊断包</Button>
      </section>

      <section style={{ marginBottom: 12 }}>
        <b>检查结果：</b> {summary}
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
                <TableCell style={{ color: c.ok ? 'green' : 'tomato' }}>{c.ok ? '通过' : '注意'}</TableCell>
                <TableCell>{c.details || '-'}</TableCell>
                <TableCell>{c.suggestion || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div style={{ marginTop: 8, opacity: .8 }}>
          <div>系统：{env.platform} {env.arch} {env.release}</div>
          <div>内存：{env.ramGB} GB，App：{env.appVersion}</div>
          <div>用户数据：{env.userData}</div>
          <div>下载目录：{env.downloadDir}</div>
        </div>
      </section>

      <section>
        <h3>实时日志</h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <Dropdown aria-label="level" selectedOptions={[level]} onOptionSelect={(_, d)=> setLevel(d.optionValue as any)}>
            <Option value="all">全部</Option>
            <Option value="debug">debug</Option>
            <Option value="info">info</Option>
            <Option value="warn">warn</Option>
            <Option value="error">error</Option>
          </Dropdown>
          <Input placeholder="搜索关键字" value={kw} onChange={(_, d)=>setKw(d.value)} />
          <Button onClick={loadLogs}>刷新</Button>
        </div>
        <div style={{
          whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, monospace',
          border: '1px solid var(--colorNeutralStroke1)', borderRadius: 8, padding: 10, height: 360, overflow: 'auto'
        }}>
          {filtered.map((r: any, i: number) => typeof r === 'string'
            ? <div key={i} style={{ opacity: .6 }}>{r}</div>
            : <div key={i} style={{ opacity: r.level==='debug' ? .75 : 1 }}>
                <b>[{r.ts}]</b> <i>{r.level}</i> {r.tag ? `[${r.tag}]` : ''} — {r.msg}
                {r.data ? <div style={{ opacity: .8 }}>{JSON.stringify(r.data)}</div> : null}
              </div>
          )}
        </div>
      </section>
    </div>
  );
}
