export type StreamInfo = {
  id: string;             // 唯一流ID
  type: 'video'|'audio';
  container: 'mp4'|'webm'|'flv'|'m4a'|'unknown';
  codec?: string;         // avc1/av01/hev1/opus/aac 等
  qualityLabel?: string;  // 360p/720p/1080p/4K 等
  bitrate?: number;       // bps
  fps?: number;
  sizeEstimate?: number;  // 字节
  url?: string;           // 直链（如可用）
};

export type ParseResult = {
  platform: 'bili'|'yt';
  id: string;
  title: string;
  cover?: string;
  duration?: number;
  author?: { name: string; id?: string; face?: string };
  streams: StreamInfo[];    // 可选视频/音频流
  extras?: Record<string, any>; // 合集/分P/分辨率分级等
  canFetchComments?: boolean;
  canFetchDanmaku?: boolean;
  live?: boolean;
};

export function parseUrl(url: string): { platform: 'bili'|'yt' } {
  const u = new URL(url);
  if (/bilibili\.com|b23\.tv/.test(u.host)) return { platform: 'bili' };
  if (/youtube\.com|youtu\.be/.test(u.host)) return { platform: 'yt' };
  throw new Error('URL not recognized as Bili or YouTube');
}
