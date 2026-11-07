import {cp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {root, json, digest, validateCatalogMetadata} from './catalog.mjs';

export async function preparePages({directory = root, out = path.join(directory, '.pages')} = {}) {
  for (const channel of ['stable', 'testing']) {
    const sources = await json(path.join(directory, 'repo', channel, 'index.json'));
    if (!Array.isArray(sources) || !sources.length) throw Error('发布目录为空');
    for (const entry of sources) {
      validateCatalogMetadata(entry.catalogMetadata);
      if (!/^\.\.\/packages\/[a-z][a-z0-9-]*\/\d+\.\d+\.\d+\.js$/.test(entry.sourceCodeUrl)) throw Error('插件路径无效');
      const file = path.resolve(directory, 'repo', channel, entry.sourceCodeUrl);
      const bytes = await readFile(file);
      if (bytes.length !== entry.nodelane.size || digest(bytes) !== entry.nodelane.sha256) throw Error('发布文件摘要不符');
      const archived = await json(path.join(directory, 'repo/sources', entry.nodelane.slug, entry.version, 'package.json'));
      if (archived.nodelane.sha256 !== entry.nodelane.sha256 || archived.id !== entry.id) throw Error('对应源码归档不匹配');
    }
  }
  // Build a fresh deployment snapshot; the live Pages site changes only after
  // the complete artifact has passed checks and deploy-pages succeeds.
  await rm(out, {recursive: true, force: true});
  await mkdir(out, {recursive: true});
  for (const name of ['packages', 'sources', 'LICENSE', 'THIRD_PARTY.md']) {
    await cp(path.join(directory, 'repo', name), path.join(out, name), {recursive: true});
  }
  try { await cp(path.join(directory, 'repo/NOTICE'), path.join(out, 'NOTICE')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (const channel of ['stable', 'testing']) {
    await cp(path.join(directory, 'repo', channel), path.join(out, channel), {recursive: true});
  }
  await writeFile(path.join(out, 'CNAME'), 'comics-extensions.nodelane.net\n');
  await writeFile(path.join(out, '.nojekyll'), '');
  await writeFile(path.join(out, 'index.html'), '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>NodeLane Comics 扩展源</title><h1>NodeLane Comics 扩展源</h1><p><a href="stable/index.json">正式目录</a> · <a href="testing/index.json">测试目录</a> · <a href="https://github.com/Wy2926/nodelane-comics-extensions">源码与维护说明</a></p><p><a href="LICENSE">GPL-3.0-only</a> · <a href="THIRD_PARTY.md">来源声明</a></p></html>\n');
  return out;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  console.log(`已生成发布目录：${await preparePages()}`);
}
