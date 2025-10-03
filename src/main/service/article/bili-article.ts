import got from 'got';
import path from 'node:path';
import fs from 'node:fs/promises';

const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
const H = { headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/read' } };

const STYLE = `
<style>
  :root { color-scheme: light dark; }
  body { margin: 0 auto; padding: 28px 18px; max-width: 860px; line-height: 1.75; font-family: -apple-system, "Segoe UI", Roboto, "Microsoft Yahei", "Noto Sans SC", Arial, sans-serif; }
  h1,h2,h3{ line-height:1.35; margin:1.2em 0 .6em }
  p { margin: .8em 0; }
  img { max-width: 100%; border-radius: 8px; box-shadow: 0 1px 6px rgba(0,0,0,.08); }
  pre,code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; }
  pre { padding: 14px; background: rgba(127,127,127,.08); border-radius: 8px; overflow:auto; }
  blockquote { margin: .8em 0; padding: .1em 1em; border-left: 3px solid #8884; color: #666; }
  hr { border: none; border-top: 1px dashed #aaa6; margin: 1.4em 0; }
</style>`;

export async function downloadArticle(id: string, outDir: string) {
  const num = id.replace(/^\D+/,'');
  const meta = await got(`https://api.bilibili.com/x/article/viewinfo?id=${num}&mobi_app=pc`, H).json<any>();
  if (meta.code !== 0) throw new Error(meta.message);
  const title = (meta.data?.title || ('article_'+num)).replace(/[\\/:*?"<>|]/g,'_');

  const cont = await got(`https://api.bilibili.com/x/article/contents?id=${num}`, H).json<any>();
  if (cont.code !== 0) throw new Error(cont.message);
  let html = cont.data?.content || '';

  const dir = path.join(outDir, `${title}_cv${num}`);
  await fs.mkdir(dir, { recursive: true });

  // 下载图片并本地化
  const imgs = Array.from(html.matchAll(/<img[^>]+src="([^"]+)"/g)).map(m=>m[1]);
  let idx=1;
  for (const u of imgs) {
    const ext = (u.split('?')[0].split('.').pop() || 'jpg').slice(0,4);
    const file = `img_${String(idx++).padStart(3,'0')}.${ext}`;
    const buf = await got(u, H).buffer().catch(()=>null);
    if (!buf) continue;
    await fs.writeFile(path.join(dir, file), buf);
    html = html.replaceAll(u, `./${file}`);
  }

  const htmlPath = path.join(dir, 'index.html');
  const finalHTML = `<!doctype html><meta charset="utf-8"><title>${title}</title>${STYLE}<article>${html}</article>`;
  await fs.writeFile(htmlPath, finalHTML, 'utf-8');

  // Markdown（保持段落/换行/标题/粗斜体/链接/图片/代码块）
  const mdPath = path.join(dir, 'index.md');
  let md = html
    .replace(/\r?\n/g, '')
    .replace(/<\/p>/g, '\n\n')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<h1[^>]*>(.*?)<\/h1>/g, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/g, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/g, '### $1\n\n')
    .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
    .replace(/<em>(.*?)<\/em>/g, '*$1*')
    .replace(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/g, '[$2]($1)')
    .replace(/<img[^>]+src="([^"]+)"[^>]*>/g, '![]($1)')
    .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/g, (_m, code)=>`\n\`\`\`\n${decodeHTMLEntities(code)}\n\`\`\`\n`)
    .replace(/<\/?(div|span|article|section|figure|figcaption)[^>]*>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g,' ')
    .trim();
  await fs.writeFile(mdPath, `# ${title}\n\n${md}\n`, 'utf-8');

  return { dir, htmlPath, mdPath, title };
}

function decodeHTMLEntities(s:string){
  return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/&quot;/g,'"');
}
