// ass.ts
type Event = { t:number; mode:number; size:number; color:number; text:string };
export type Style = {
  width:number; height:number; fps:number;
  fontName:string; fontSize:number; outline:number; shadow:number; opacity:number;
  scrollDuration:number; staticDuration:number; trackHeight:number;
};

function colorASS(dec:number){
  const r=(dec>>16)&255, g=(dec>>8)&255, b=dec&255;
  const h=(n:number)=>n.toString(16).toUpperCase().padStart(2,'0');
  return `&H00${h(b)}${h(g)}${h(r)}`;
}
const zpad = (n:number)=> String(n).padStart(2,'0');
function t2(s:number){
  const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=(s%60);
  return `${h}:${zpad(m)}:${sec.toFixed(2).padStart(5,'0')}`;
}

export function buildASS(opts:{ title:string; style:Style; events:Event[] }){
  const { title, style, events } = opts;
  const {
    width, height, fps, fontName, fontSize, outline, shadow, opacity,
    scrollDuration, staticDuration, trackHeight
  } = style;

  const scrollTracks:number[] = [], topTracks:number[] = [], bottomTracks:number[] = [];
  const alpha = `&H${Math.round((1 - opacity)*255).toString(16).toUpperCase().padStart(2,'0')}&`;

  const evLines:string[] = [];
  const alloc = (pool:number[], start:number, hold:number)=> {
    for(let i=0;i<pool.length;i++) if (pool[i]<=start) { pool[i]=start+hold; return i; }
    pool.push(start+hold); return pool.length-1;
  };

  for (const e of events) {
    const col = colorASS(e.color);
    if ([1,2,3].includes(e.mode)) {
      const trk = alloc(scrollTracks, e.t, scrollDuration);
      const y = Math.min(height - trackHeight, trk*trackHeight);
      const wText = Math.max(60, Math.floor(e.text.length * fontSize * 0.6));
      const startX = width + 20, endX = - (wText + 40);
      const end = e.t + scrollDuration;
      const txt = e.text.replace(/[{}]/g,'');
      evLines.push(`Dialogue: 0,${t2(e.t)},${t2(end)},Scroll,,0,0,0,,{\\move(${startX},${y},${endX},${y})\\bord${outline}\\shad${shadow}\\1c${col}\\alpha${alpha}}${txt}`);
    } else if (e.mode===4) {
      const trk = alloc(bottomTracks, e.t, staticDuration);
      const y = height - (trk+1)*trackHeight - 10;
      const end = e.t + staticDuration;
      evLines.push(`Dialogue: 0,${t2(e.t)},${t2(end)},Static,,0,0,0,,{\\an2\\pos(${Math.floor(width/2)},${y})\\bord${outline}\\shad${shadow}\\1c${col}\\alpha${alpha}}${e.text}`);
    } else if (e.mode===5) {
      const trk = alloc(topTracks, e.t, staticDuration);
      const y = (trk)*trackHeight + 10;
      const end = e.t + staticDuration;
      evLines.push(`Dialogue: 0,${t2(e.t)},${t2(end)},Static,,0,0,0,,{\\an8\\pos(${Math.floor(width/2)},${y})\\bord${outline}\\shad${shadow}\\1c${col}\\alpha${alpha}}${e.text}`);
    }
  }

  return [
    '[Script Info]',
    `Title: ${title}`,
    'ScriptType: v4.00+',
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    `Timer: ${fps}`,
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Scroll,${fontName},${fontSize},&H00FFFFFF,&H00FFFFFF,&H00202020,&H64000000,0,0,0,0,100,100,0,0,1,${outline},${shadow},7,10,10,10,1`,
    `Style: Static,${fontName},${fontSize},&H00FFFFFF,&H00FFFFFF,&H00202020,&H64000000,0,0,0,0,100,100,0,0,1,${outline},${shadow},2,10,10,10,1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ...evLines
  ].join('\n');
}