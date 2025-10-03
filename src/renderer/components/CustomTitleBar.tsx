import React from 'react';

const bar: React.CSSProperties = {
  height: 40,
  WebkitAppRegion: 'drag' as any,
  display: 'flex', alignItems: 'center',
  padding: '0 8px', justifyContent: 'space-between',
  borderBottom: '1px solid var(--colorNeutralStroke1)'
};
const btn: React.CSSProperties = {
  WebkitAppRegion: 'no-drag' as any,
  width: 46, height: 40, display: 'grid', placeItems: 'center', cursor: 'pointer'
};

export default function CustomTitleBar() {
  return (
    <div style={bar}>
      <div style={{display:'flex', alignItems:'center', gap:8}}>
        <img src="./icon.png" style={{width:20, height:20}}/>
        <span style={{opacity:.8}}>Bili & YouTube Downloader</span>
      </div>
      <div style={{display:'flex'}}>
        <div style={btn} onClick={()=>window.api.invoke('win:minimize')}>—</div>
        <div style={btn} onClick={()=>window.api.invoke('win:maximize')}>▢</div>
        <div style={{...btn, color:'tomato'}} onClick={()=>window.api.invoke('win:close')}>✕</div>
      </div>
    </div>
  );
}
