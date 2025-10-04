export type StreamInfo = {
  id: string;
  type: 'video' | 'audio';
  container: 'mp4' | 'webm' | 'flv' | 'm4a' | 'unknown';
  codec?: string;
  qualityLabel?: string;
  bitrate?: number;
  fps?: number;
  sizeEstimate?: number;
  url?: string;
  extras?: Record<string, any>;
};

export type ParseResult = {
  platform: 'bili' | 'yt';
  id: string;
  title: string;
  cover?: string;
  duration?: number;
  author?: { name: string; id?: string; face?: string };
  streams: StreamInfo[];
  extras?: Record<string, any>;
  canFetchComments?: boolean;
  canFetchDanmaku?: boolean;
  live?: boolean;
};

export function parseUrl(url: string): { platform: 'bili' | 'yt' } {
  try {
    const u = new URL(url);
    if (/bilibili\.com|b23\.tv/.test(u.host)) return { platform: 'bili' };
    if (/youtube\.com|youtu\.be/.test(u.host)) return { platform: 'yt' };
  } catch {}
  throw new Error('URL not recognized as Bili or YouTube');
}