import React from 'react';
import { Button, Input, Dropdown, Option } from '@fluentui/react-components';

declare global { interface Window { api: any } }

export default function LogViewer() {
  const [data, setData] = React.useState<any[]>([]);
  const [kw, setKw] = React.useState('');
  const [lvl, setLvl] = React.useState<'all'|'debug'|'info'|'warn'|'error'>('all');

  async function refresh(){ setData(await window.api.invoke('log:recent', 2000)); }
  React.useEffect(()=>{ refresh(); }, []);

  const filtered = data.filter((x:any)=>{
    const passLevel = (lvl==='all') || (typeof x!=='string' && x.level===lvl);
    const passKw = !kw || JSON.stringify(x).toLowerCase().includes(kw.toLowerCase());
    return passLevel && passKw;
  });

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:8 }}>
        <Dropdown selectedOptions={[lvl]} onOptionSelect={(_,d)=>setLvl(d.optionValue as any)}>
          <Option value="all">全部</Option>
          <Option value="debug">debug</Option>
          <Option value="info">info</Option>
          <Option value="warn">warn</Option>
          <Option value="error">error</Option>
        </Dropdown>
        <Input value={kw} onChange={(_,d)=>setKw(d.value)} placeholder="过滤关键字" />
        <Button onClick={refresh}>刷新</Button>
      </div>
      <div style={{ height: 280, overflow:'auto', fontFamily:'ui-monospace,monospace', whiteSpace:'pre-wrap',
        border:'1px solid var(--colorNeutralStroke1)', borderRadius:8, padding:10 }}>
        {filtered.map((r:any,i:number)=> typeof r==='string'
          ? <div key={i} style={{ opacity:.6 }}>{r}</div>
          : <div key={i}><b>[{r.ts}]</b> <i>{r.level}</i> {r.tag?`[${r.tag}]`:''} — {r.msg}
              {r.data?<div style={{opacity:.8}}>{JSON.stringify(r.data)}</div>:null}
            </div>)}
      </div>
    </div>
  );
}
