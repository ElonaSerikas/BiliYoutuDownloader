import fs from 'node:fs/promises';
import path from 'node:path';

// 提示：正式实现可调用 YouTube Data API v3 (commentThreads.list)，需要 API Key
export async function exportYTComments(meta: any) {
  const out = path.join(meta.target, `${meta.id}-yt-comments.json`);
  const mock = {
    videoId: meta.id,
    comments: [],
    note: '此功能需要您提供 Google API Key 并在代码中实现 YouTube Data API v3 的调用。'
  };
  await fs.writeFile(out, JSON.stringify(mock, null, 2), 'utf-8');
  return out;
}