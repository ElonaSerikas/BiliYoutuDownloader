import React from 'react';

// 定义一个包含 WebkitAppRegion 的类型
interface CSSPropertiesWithAppRegion extends React.CSSProperties {
  WebkitAppRegion?: 'drag' | 'no-drag';
}

const bar: CSSPropertiesWithAppRegion = {
  height: 40,
  WebkitAppRegion: 'drag',
  display: 'flex', alignItems: 'center',
  padding: '0 8px', justifyContent: 'space-between',
  borderBottom: '1px solid var(--colorTransparentStroke)',
  flexShrink: 0,
};
const btn: CSSPropertiesWithAppRegion = {
  WebkitAppRegion: 'no-drag',
  width: 46, height: 40, display: 'grid', placeItems: 'center', cursor: 'pointer',
  borderRadius: '4px'
};

export default function CustomTitleBar() {
  return (
    <div style={bar}>
      <div style={{display:'flex', alignItems:'center', gap:8, WebkitAppRegion: 'no-drag'}}>
        <img src="./icon.png" style={{width:20, height:20}} alt="logo"/>
        <span style={{opacity:.8}}>Bili & YouTube Downloader</span>
      </div>
      <div style={{display:'flex'}}>
        <div style={btn} onClick={()=>window.api.invoke('app:win:minimize')}>—</div>
        <div style={btn} onClick={()=>window.api.invoke('app:win:maximize')}>▢</div>
        <div style={{...btn, color:'tomato'}} onClick={()=>window.api.invoke('app:win:close')}>✕</div>
      </div>
    </div>
  );
}