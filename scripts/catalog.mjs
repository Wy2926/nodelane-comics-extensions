import {readFile, writeFile, mkdir, readdir, copyFile, rename, link, unlink, rm} from 'node:fs/promises';
import {createHash, randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export const json = async file => JSON.parse(await readFile(file, 'utf8'));
const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const slugPattern = /^[a-z][a-z0-9-]{1,39}$/;
const capabilities = new Set(['popular', 'latest', 'search', 'details', 'pages']);
const hostCapabilities = new Set(['image.tile-shuffle.v1']);
const catalogValues = {
  regions: ['jp', 'kr', 'cn', 'hk_tw', 'western', 'other'],
  formats: ['page', 'vertical', 'strip'],
  creations: ['original', 'fan', 'adaptation'],
};
export function validateCatalogMetadata(value) {
  if (value === undefined) return;
  check(value && typeof value === 'object' && !Array.isArray(value) && value.schema === 1, '来源卡片资料版本无效');
  check(Object.keys(value).every(key => ['schema', 'pricing', ...Object.keys(catalogValues)].includes(key)), '来源卡片资料包含未知字段');
  for (const [key, allowed] of Object.entries(catalogValues)) {
    const list = value[key];
    check(list === undefined || Array.isArray(list) && new Set(list).size === list.length && list.every(v => allowed.includes(v)), '来源卡片分类无效：' + key);
  }
  check(value.pricing === undefined || ['unknown', 'free', 'partial', 'paid'].includes(value.pricing), '来源收费模式无效');
}
export function compareVersion(a, b) {
  for (let i = 0; i < 3; i++) {
    const difference = Number(a.split('.')[i]) - Number(b.split('.')[i]);
    if (difference) return Math.sign(difference);
  }
  return 0;
}
function check(condition, message) { if (!condition) throw Error(message); }
export function validateRepository(repo) {
  check(repo.id === 'net.nodelane.extensions', '仓库身份不能变更');
  const ids = Object.values(repo.sourceIds ?? {});
  check(ids.length > 0 && ids.every(id => Number.isSafeInteger(id) && id > 0), '来源 ID 必须为正整数');
  check(new Set(ids).size === ids.length, '重复的永久来源 ID');
  check(Object.keys(repo.sourceIds).every(slug => slugPattern.test(slug)), '来源名称不合法');
}
export function validateManifest(m, slug, repo) {
  check(slugPattern.test(slug) && m.slug === slug, '来源 slug 与目录不一致');
  check(repo.sourceIds[slug] === m.id, '永久来源 ID 不匹配');
  check(semver.test(m.version) && semver.test(m.appMinVerReq), '版本必须是 x.y.z');
  check(typeof m.name === 'string' && m.name.trim().length > 0, '缺少名称');
  check(m.itemType === 0 && [1, 2].includes(m.sourceCodeLanguage), '仅支持 JavaScript 或 Mihon 漫画插件');
  check(/^[a-z]{2,3}(-[a-zA-Z0-9]+)*$/.test(m.lang), '语言代码不合法');
  if (m.sourceCodeLanguage === 2) {
    check(m.license === 'Apache-2.0', '原版 Keiyoushi 扩展须保留 Apache-2.0 许可');
    check(Array.isArray(m.files) && m.files.length === 1 && /^[a-z][a-z0-9-]*\.apk$/.test(m.files[0]) &&
      m.entryClass === undefined, '原生扩展必须直接使用本站目录内的 APK');
    check(m.upstream && semver.test(m.upstream.version) && /^[a-f0-9]{40}$/.test(m.upstream.commit) &&
      /^[a-f0-9]{64}$/.test(m.upstream.sha256) && Number.isSafeInteger(m.upstream.size) && m.upstream.size > 0 &&
      new URL(m.upstream.url).protocol === 'https:', '原生扩展缺少固定上游版本与摘要');
    const params = JSON.parse(m.additionalParams);
    check(typeof params.mihonSourceId === 'string' && /^[1-9]\d{0,18}$/.test(params.mihonSourceId), '缺少原始 Mihon 来源 ID');
  } else {
    check(m.license === 'GPL-3.0-only', 'JavaScript 插件分发许可为 GPL-3.0-only');
    check(Array.isArray(m.files) && m.files.length > 0 && new Set(m.files).size === m.files.length &&
      m.files.every(f => /^[a-z][a-z0-9-]*\.js$/.test(f)), '构建文件必须是本站目录内的独立文件');
    check(/^[A-Za-z_$][\w$]*$/.test(m.entryClass), '入口类不合法');
  }
  const url = new URL(m.baseUrl);
  check(url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/', '来源必须使用 HTTPS origin');
  check(Array.isArray(m.requestHosts) && m.requestHosts.includes(url.hostname) &&
    m.requestHosts.every(h => /^[a-z0-9]+([.-][a-z0-9]+)*\.[a-z]{2,}$/.test(h)), '必须明确声明精确请求主机');
  check(Array.isArray(m.capabilities) && m.capabilities.length > 0 && m.capabilities.every(c => capabilities.has(c)), '能力声明无效');
  check(Array.isArray(m.requires) && m.requires.every(c => hostCapabilities.has(c)), '未知主机能力');
  check(m.isNsfw === undefined || typeof m.isNsfw === 'boolean', '成人标记必须为布尔值');
  validateCatalogMetadata(m.catalogMetadata);
}
export async function build({directory = root, out = path.join(directory, '.build')} = {}) {
  const repo = await json(path.join(directory, 'repository.json'));
  validateRepository(repo);
  try {
    const allocated = await json(path.join(directory, 'repo', 'registry.json'));
    for (const [slug, id] of Object.entries(allocated)) check(repo.sourceIds[slug] === id, '已发布来源的永久 ID 不得删除或变更');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const entries = [], artifacts = [];
  for (const slug of (await readdir(path.join(directory, 'src'))).sort()) {
    const dir = path.join(directory, 'src', slug);
    const m = await json(path.join(dir, 'manifest.json'));
    validateManifest(m, slug, repo);
    if (m.enabled === false) continue;
    const native = m.sourceCodeLanguage === 2;
    const files = await Promise.all(m.files.map(file => readFile(path.join(dir, file))));
    const bytes = native ? files[0] : Buffer.from(
      `// SPDX-License-Identifier: ${m.license}\n// NodeLane ${slug}; corresponding source: sources/${slug}/${m.version}/\n` +
      'const DefaultExtension = (() => {\n' + files.join('\n') + `\nreturn ${m.entryClass};\n})();\n`);
    check(bytes.length <= 1024 * 1024, '插件超出 1 MiB');
    if (native) check(bytes.length === m.upstream.size && digest(bytes) === m.upstream.sha256, 'APK 与固定上游摘要不符');
    else new vm.Script(bytes.toString());
    const {files: _, entryClass, slug: ignoredSlug, license, requestHosts, requires, capabilities: caps, enabled, upstream, ...source} = m;
    const relative = `packages/${slug}/${m.version}.${native ? 'apk' : 'js'}`;
    const entry = {...source, sourceCodeUrl: relative, nodelane: {
      schema: 1, repositoryId: repo.id, slug, sha256: digest(bytes), size: bytes.length,
      requestHosts, requires, capabilities: caps, license,
    }};
    entries.push(entry);
    const licenseBytes = await readFile(path.join(native ? dir : directory, 'LICENSE'));
    artifacts.push({entry, bytes, licenseBytes, sourceDirectory: dir, sourceFiles: Object.fromEntries(m.files.map((file,i)=>[file,files[i]])), manifest: m});
    await mkdir(path.dirname(path.join(out, relative)), {recursive: true});
    await writeFile(path.join(out, relative), bytes);
  }
  check(entries.length > 0, '没有启用的来源');
  await writeFile(path.join(out, 'index.json'), JSON.stringify(entries, null, 2) + '\n');
  return {entries, artifacts, repo, out};
}
async function immutable(file, bytes) {
  await mkdir(path.dirname(file), {recursive: true});
  const temp = file + '.' + randomUUID() + '.tmp';
  await writeFile(temp, bytes, {flag:'wx'});
  try {
    try { await link(temp, file); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      check(digest(await readFile(file)) === digest(bytes), '已发布的同版本内容不同，必须升版');
    }
  } finally { await unlink(temp); }
}
// Card facts may change independently of executable releases. Keep the first
// archive snapshot, but reject every other same-version manifest/package change.
async function archiveMetadata(file, value) {
  try {
    const original = await json(file);
    const executable = ({catalogMetadata, isNsfw, ...rest}) => rest;
    check(JSON.stringify(executable(original)) === JSON.stringify(executable(value)), '已发布的同版本元数据不同，必须升版');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await immutable(file, Buffer.from(JSON.stringify(value, null, 2) + '\n'));
  }
}
async function atomicJson(file, value) {
  await mkdir(path.dirname(file), {recursive: true});
  const temp = file + '.' + randomUUID() + '.tmp';
  await writeFile(temp, JSON.stringify(value, null, 2) + '\n');
  await rename(temp, file);
}
export async function publish(built, options = {}) {
  const directory = options.directory ?? root;
  await mkdir(path.join(directory, 'repo'), {recursive:true});
  const lock = path.join(directory, 'repo', '.publish-lock');
  try { await mkdir(lock); } catch (e) { if (e.code === 'EEXIST') throw Error('已有发布任务；确认进程结束后再恢复'); throw e; }
  try { return await publishLocked(built, options); }
  finally { await rm(lock, {recursive:true}); }
}
async function publishLocked(built, {directory = root, channel = 'testing', onlySlug} = {}) {
  check(['testing', 'stable'].includes(channel), '渠道仅支持 testing 或 stable');
  const dest = path.join(directory, 'repo');
  const index = path.join(dest, channel, 'index.json');
  let previous = [];
  try { previous = await json(index); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (const {entry, bytes} of built.artifacts) {
    const old = previous.find(e => e.id === entry.id);
    check(!old || compareVersion(entry.version, old.version) >= 0, '禁止索引降版；请用新版本发布旧实现');
    check(!old || old.version !== entry.version || old.nodelane.sha256 === entry.nodelane.sha256, '同版本内容发生变化');
    check(digest(bytes) === entry.nodelane.sha256, '构建摘要不匹配');
    const file = path.join(dest, entry.sourceCodeUrl);
    try { check(digest(await readFile(file)) === digest(bytes), '已发布的同版本内容不同，必须升版'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  for (const {entry, bytes, licenseBytes, sourceFiles, manifest} of built.artifacts) {
    await immutable(path.join(dest, entry.sourceCodeUrl), bytes);
    const sources = path.join(dest, 'sources', manifest.slug, manifest.version);
    await archiveMetadata(path.join(sources, 'package.json'), entry);
    await archiveMetadata(path.join(sources, 'manifest.json'), manifest);
    for (const file of manifest.files) await immutable(path.join(sources, file), sourceFiles[file]);
    const rebuild = manifest.sourceCodeLanguage === 2
      ? `// Restore the unmodified upstream binary; this does not recompile upstream.\nimport {copyFile} from 'node:fs/promises';\nawait copyFile(new URL(${JSON.stringify(manifest.files[0])},import.meta.url),new URL('plugin.apk',import.meta.url));\n`
      : `import {readFile,writeFile} from 'node:fs/promises';\nconst m=JSON.parse(await readFile(new URL('manifest.json',import.meta.url),'utf8'));\nconst parts=await Promise.all(m.files.map(f=>readFile(new URL(f,import.meta.url),'utf8')));\nconst code=${JSON.stringify(bytes.toString().split('const DefaultExtension = (() => {\n')[0])}+'const DefaultExtension = (() => {\\n'+parts.join('\\n')+'\\nreturn '+m.entryClass+';\\n})();\\n';\nawait writeFile(new URL('plugin.js',import.meta.url),code);\n`;
    await immutable(path.join(sources, 'rebuild.mjs'), rebuild);
    await immutable(path.join(sources, 'LICENSE'), licenseBytes);
    // Shared notices can gain new sources without changing an old plugin.
    // Keep each version's original snapshot; new versions get the current notice.
    const notice = path.join(sources, 'THIRD_PARTY.md');
    try { check((await readFile(notice)).length > 0, '已发布的来源声明为空'); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await immutable(notice, await readFile(path.join(directory, 'THIRD_PARTY.md')));
    }
  }
  const entries = onlySlug ? [...new Map([
    ...previous.map(e => [e.id, {...e, sourceCodeUrl: e.sourceCodeUrl.replace(/^\.\.\//, '')}]),
    ...built.entries.map(e => [e.id, e]),
  ]).values()] : built.entries;
  const meta = {id: built.repo.id, name: built.repo.name, channel, schema: 1};
  for (const file of ['LICENSE', 'THIRD_PARTY.md']) await copyFile(path.join(directory, file), path.join(dest, file));
  await atomicJson(path.join(dest, 'registry.json'), built.repo.sourceIds);
  await atomicJson(path.join(dest, channel, 'repo.json'), meta);
  await atomicJson(index, entries.map(e => ({...e, sourceCodeUrl: '../' + e.sourceCodeUrl})));
  if (channel === 'testing') {
    await atomicJson(path.join(dest, 'repo.json'), meta);
    await atomicJson(path.join(dest, 'index.json'), entries);
  }
  return entries;
}
