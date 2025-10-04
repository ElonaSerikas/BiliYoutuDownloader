import { parentPort, workerData } from 'node:worker_threads';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import got from 'got';
import { AbortController } from 'abort-controller';
import sanitize from 'sanitize-filename';

const { task, ffmpegBin } = workerData;
const FFMPEG = ffmpegBin || 'ffmpeg';

const controller = new AbortController();
parentPort?.on('message', (msg) => {
    if (msg === 'abort') controller.abort();
});

function msg(type, data) { parentPort?.postMessage({ type, data }); }

function applyTpl(tpl, ctx) {
    const result = tpl.replace(/\{(\w+)\}/g, (_, k) => (ctx[k] ?? ''));
    return sanitize(result);
}

async function downloadStream(url, outPath, signal) {
    const { len } = await got.head(url, { signal }).then(res => ({ len: Number(res.headers['content-length'] || 0) }));
    let downloaded = 0;
    try { downloaded = (await fsp.stat(outPath)).size; } catch { /* noop */ }

    if (downloaded >= len) {
        msg('progress', { total: len, downloaded: len });
        return { total: len };
    }

    const stream = got.stream(url, {
        headers: { Range: `bytes=${downloaded}-` },
        signal,
        timeout: { request: 30000 },
        retry: { limit: 5 }
    });

    const fileStream = fs.createWriteStream(outPath, { flags: 'a' });
    stream.on('downloadProgress', p => msg('progress', { total: len, downloaded: downloaded + p.transferred }));
    stream.pipe(fileStream);

    return new Promise((resolve, reject) => {
        fileStream.on('finish', () => resolve({ total: len }));
        stream.on('error', err => reject(err.name === 'AbortError' ? err : new Error(`下载失败: ${err.message}`)));
        fileStream.on('error', err => reject(new Error(`写入文件失败: ${err.message}`)));
    });
}

async function mux(video, audio, outPath) {
    const finalOut = outPath.replace(/\.mp4$/i, (audio && !video) ? '.m4a' : '.mp4');
    if (video && audio) {
        const args = ['-y', '-i', video, '-i', audio, '-c', 'copy', '-movflags', 'faststart', finalOut];
        await new Promise((res, rej) => spawn(FFMPEG, args, { stdio: 'ignore' }).on('exit', c => c === 0 ? res() : rej(new Error(`ffmpeg 合并失败 (code: ${c})`))));
    } else if (video) {
        await fsp.rename(video, finalOut);
    } else if (audio) {
        await fsp.rename(audio, finalOut);
    } else {
        throw new Error('没有提供视频或音频输入。');
    }
    return finalOut;
}

(async function main() {
    const tmpDir = path.join(task.target, `.tmp_${task.id}`);
    await fsp.mkdir(tmpDir, { recursive: true });

    try {
        let vPath = null, aPath = null;
        let total = 0, downloaded = 0;

        if (task.streams.video) {
            const { len } = await got.head(task.streams.video).then(res => ({ len: Number(res.headers['content-length'] || 0) }));
            total += len;
        }
        if (task.streams.audio) {
            const { len } = await got.head(task.streams.audio).then(res => ({ len: Number(res.headers['content-length'] || 0) }));
            total += len;
        }
        msg('progress', { total, downloaded: 0 });

        if (task.streams.video) {
            vPath = path.join(tmpDir, 'video.mp4');
            await downloadStream(task.streams.video, vPath, controller.signal);
        }
        if (task.streams.audio) {
            aPath = path.join(tmpDir, 'audio.m4a');
            await downloadStream(task.streams.audio, aPath, controller.signal);
        }

        const nameCtx = { title: task.title, id: task.meta?.bvid || task.id };
        const filename = applyTpl(task.settings?.filenameTpl || '{title}-{id}', nameCtx);
        const out = path.join(task.target, `${filename}.mp4`);

        const finalFile = await mux(vPath, aPath, out);

        await fsp.rm(tmpDir, { recursive: true, force: true });
        msg('done', { file: finalFile });
    } catch (e) {
        if (e.name !== 'AbortError') {
            msg('error', { message: e.message });
        }
        await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
})();