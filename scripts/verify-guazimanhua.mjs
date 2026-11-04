// Bounded, read-only live verification. No cookies or source responses are logged.
import {loadPlugin, Client} from './runtime.mjs';
const plugin = await loadPlugin('guazimanhua');
const pools = [];
for (const [name, call] of [
  ['popular', () => plugin.getPopular(1)], ['popular-page-2', () => plugin.getPopular(2)],
  ['latest', () => plugin.getLatestUpdates(1)], ['search', () => plugin.search('我', 1)],
  ['search-page-2', () => plugin.search('我', 2)], ['empty', () => plugin.search('NodeLaneNoMatch9q7x', 1)],
]) {
  const result = await call();
  console.log(name, {count: result.list.length, next: result.hasNextPage});
  if (name === 'popular' || name === 'latest') pools.push(...result.list.slice(0, 6));
  if (name === 'empty' && result.list.length) throw Error('无结果检查不符合预期');
}
for (let selected = 0; selected < 5; selected++) {
  const filters = plugin.getFilterList(); filters[selected].state = 1;
  const result = await plugin.search('', 1, filters);
  console.log('filter-' + filters[selected].type, {count: result.list.length, next: result.hasNextPage});
}
const works = [...new Map(pools.map(work => [work.link, work])).values()];
for (const work of process.argv.includes('--catalogs') ? works : works.slice(0, 1)) {
  const detail = await plugin.getDetail(work.link);
  console.log('catalog', {name: detail.name, chapters: detail.chapters.length,
    unknownDates: detail.chapters.filter(c => !c.dateUpload).length});
  if (work !== works[0] || !detail.chapters.length) continue;
  const pages = await plugin.getPageList(detail.chapters.at(-1).url);
  console.log('reader', {pages: pages.length});
  for (const index of [...new Set([0, pages.length - 1])]) {
    const response = await new Client().get(pages[index].url, pages[index].headers);
    if (response.statusCode !== 200 || !response.headers['content-type']?.startsWith('image/'))
      throw Error('正文图片不可读取（页 ' + (index + 1) + '，HTTP ' + response.statusCode + '）');
    console.log('image', {page: index + 1, status: response.statusCode, type: response.headers['content-type'], bytes: response.bodyBytes.length});
  }
}
