// Read-only smoke check. Never print signed URLs, headers or response bodies.
import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import vm from 'node:vm';
const run = promisify(execFile);
class Client {
    async get(url, headers) {
        const args = ['-sS', '--max-time', '25', '-D', '-', '-w', '\n%{http_code}'];
        for (const [key, value] of Object.entries(headers)) args.push('-H', key + ': ' + value);
        args.push(url);
        let stdout;
        try { ({stdout} = await run('curl', args, {maxBuffer: 6 * 1024 * 1024})); }
        catch { throw new Error('网络请求失败（没有输出请求地址或凭据）。'); }
        // Some environments prepend an HTTP CONNECT status block.
        let body = stdout, responseHeaders = {};
        while (body.startsWith('HTTP/')) {
            const end = body.indexOf('\r\n\r\n');
            if (end < 0) throw new Error('HTTP 响应头无效。');
            const block = body.slice(0, end);
            responseHeaders = Object.fromEntries(block.split('\r\n').slice(1).filter(line => line.includes(':')).map(line => {
                const index = line.indexOf(':'); return [line.slice(0, index).toLowerCase(), line.slice(index + 1).trim()];
            }));
            body = body.slice(end + 4);
        }
        const end = body.lastIndexOf('\n');
        return {statusCode: Number(body.slice(end + 1)), headers: responseHeaders, body: body.slice(0, end)};
    }
}
const context = vm.createContext({MProvider: class {}, Client, NodeLane: {capabilities: ['image.tile-shuffle.v1']}});
const catalog = JSON.parse(await readFile(new URL('.build/index.json', import.meta.url), 'utf8'));
const code = await readFile(new URL('.build/' + catalog.find(e => e.id === 86001001).sourceCodeUrl, import.meta.url), 'utf8');
vm.runInContext(code + '\nglobalThis.plugin = new DefaultExtension();', context);
const plugin = context.plugin;
for (const [label, work] of [
    ['热门第一页', () => plugin.getPopular(1)],
    ['最新第一页', () => plugin.getLatestUpdates(1)],
    ['搜索第一页', () => plugin.search('naruto', 1)],
    ['搜索第二页', () => plugin.search('naruto', 2)],
    ['空搜索', () => plugin.search('zzzznodelanesearchzzzz', 1)],
    ['详情与完整目录', () => plugin.getDetail('https://comix.to/title/nr83-the-sword-bearing-flower')],
    ['章节图片清单', () => plugin.getPageList('https://comix.to/title/nr83-the-sword-bearing-flower/11678200-chapter-65')],
]) {
    try {
        const result = await work();
        console.log(label + ': ' + JSON.stringify({count: result.list?.length ?? result.chapters?.length ?? result.length, hasNext: result.hasNextPage}));
    } catch (error) {
        console.error(label + ': ' + error.message);
        process.exitCode = 1;
    }
}
