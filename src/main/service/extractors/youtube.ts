import ytdl from 'ytdl-core';
import type { ParseResult, StreamInfo } from './types';
import type Store from 'electron-store';

export const youtubeExtractor = {
  async parse(url: string, store: Store): Promise<ParseResult> {
    const id = ytdl.getURLVideoID(url);
    const cookie = store.get('yt.cookie', '') as string;
    
    const info = await ytdl.getInfo(id, {
        requestOptions: {
            headers: {
                cookie: cookie,
            }
        }
    });
    const v = info.videoDetails;

    const streams: StreamInfo[] = [];
    for (const f of info.formats) {
      streams.push({
        id: f.itag?.toString() ?? Math.random().toString(36).slice(2),
        type: f.hasVideo && f.hasAudio ? 'video' : (f.hasVideo ? 'video' : 'audio'),
        container: (f.container as any) ?? 'unknown',
        codec: f.codecs,
        qualityLabel: f.qualityLabel ?? undefined,
        bitrate: f.bitrate ?? undefined,
        fps: f.fps ?? undefined,
        sizeEstimate: f.contentLength ? parseInt(f.contentLength) : undefined,
        url: f.url
      });
    }

    return {
      platform: 'yt',
      id,
      title: v.title,
      cover: v.thumbnails?.at(-1)?.url,
      duration: Number(v.lengthSeconds),
      author: { name: v.author.name },
      streams,
      canFetchComments: true,
      canFetchDanmaku: false,
      live: v.isLiveContent
    };
  }
};