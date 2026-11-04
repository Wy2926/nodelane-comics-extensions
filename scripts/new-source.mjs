import {mkdir, writeFile, access} from 'node:fs/promises';
import path from 'node:path';
import {root, json, validateRepository, validateManifest} from './catalog.mjs';
const [slug, idText, baseUrl, name = slug] = process.argv.slice(2);
if (!slug || !idText || !baseUrl) throw Error('用法：npm run new-source -- slug 永久ID https://example.org 名称');
const repo = await json(path.join(root, 'repository.json'));
if (slug in repo.sourceIds || Object.values(repo.sourceIds).includes(Number(idText))) throw Error('来源名称或永久 ID 已分配');
const updated = {...repo, sourceIds: {...repo.sourceIds, [slug]: Number(idText)}};
validateRepository(updated);
const m = {slug, id: Number(idText), name, baseUrl, apiUrl: '', lang: 'en', version: '0.1.0', itemType: 0,
  sourceCodeLanguage: 1, appMinVerReq: '0.9.9', isNsfw: false, hasCloudflare: false, isFullData: false,
  typeSource: 'single', iconUrl: '', notes: '开发中，尚未启用', license: 'GPL-3.0-only',
  files: ['extension.js'], entryClass: 'SourceExtension', requestHosts: [new URL(baseUrl).hostname],
  requires: [], capabilities: ['popular', 'latest', 'search', 'details', 'pages'], enabled: false};
validateManifest(m, slug, updated);
const dir = path.join(root, 'src', slug);
await mkdir(dir); // Existing source is never overwritten.
await writeFile(path.join(dir, 'manifest.json'), JSON.stringify(m, null, 2) + '\n');
await writeFile(path.join(dir, 'extension.js'), `// SPDX-License-Identifier: GPL-3.0-only
class SourceExtension extends MProvider {
  constructor() { super(); this.client = new Client({timeout: 25}); }
  get supportsLatest() { return true; }
  getHeaders() { return {Referer: ${JSON.stringify(baseUrl + '/')}}; }
  getFilterList() { return []; }
  getSourcePreferences() { return []; }
  async getPopular(page) { throw Error('热门尚未实现'); }
  async getLatestUpdates(page) { throw Error('最新尚未实现'); }
  async search(query, page, filters) { throw Error('搜索尚未实现'); }
  async getDetail(url) { throw Error('目录尚未实现'); }
  async getPageList(url) { throw Error('图片清单尚未实现'); }
}
`);
await writeFile(path.join(dir, 'README.md'), `# ${name}\n\n开发中。实现、测试并核对能力声明后，才将 enabled 改为 true。\n\n记录本站 URL、协议依据、来源许可、请求开销及不同验证环境的范围。\n`);
await writeFile(path.join(root, 'repository.json'), JSON.stringify(updated, null, 2) + '\n');
console.log(`已创建 ${slug}，默认不进入发布目录。`);
