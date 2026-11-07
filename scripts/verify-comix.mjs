// Read-only smoke check. Never print signed URLs, headers or response bodies.
import {loadPlugin} from './runtime.mjs';
const plugin = await loadPlugin('comix');
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
