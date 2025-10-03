import ytdl from 'ytdl-core';
import type { ParseResult, StreamInfo } from './types';

export const youtubeExtractor = {
  async parse(url: string): Promise<ParseResult> {
    const id = ytdl.getURLVideoID(url);
    const info = await ytdl.getInfo(id);
    const v = info.videoDetails;

    const streams: StreamInfo[] = [];
    const fmts = info.formats || [];
    for (const f of fmts) {
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
