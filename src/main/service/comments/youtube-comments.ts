import fs from 'node:fs/promises';
import path from 'node:path';

// 提示：正式实现可调用 YouTube Data API v3 (commentThreads.list)，需要 API Key
export async function exportYTComments(meta: any) {
  const out = path.join(meta.target, `${meta.id}-yt-comments.json`);
  // 这里给出一个示例格式；你若提供 API Key，我可把正式轮询+翻页逻辑补全
  const mock = {
    videoId: meta.id,
    comments: [],
    note: 'Provide GOOGLE_API_KEY then implement real fetch.'
  };
  await fs.writeFile(out, JSON.stringify(mock, null, 2), 'utf-8');
  return out;
}
