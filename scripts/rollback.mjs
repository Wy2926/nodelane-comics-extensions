// Rebuild archived source as a newer version. Does not alter the working source.
import {mkdtemp, mkdir, cp, writeFile, rm, readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {root, json, build, publish, compareVersion, digest} from './catalog.mjs';
export async function rollback(slug, from, version, channel = 'testing', directory = root) {
  if (!/^[a-z][a-z0-9-]{1,39}$/.test(slug) || !/^\d+\.\d+\.\d+$/.test(from) || !/^\d+\.\d+\.\d+$/.test(version)) throw Error('来源或版本无效');
  const archive = path.join(directory, 'repo/sources', slug, from);
  const receipt = await json(path.join(archive, 'package.json'));
  if (digest(await readFile(path.join(directory, 'repo', receipt.sourceCodeUrl))) !== receipt.nodelane.sha256) throw Error('旧产物摘要不符');
  const current = await json(path.join(directory, 'repo', channel, 'index.json'));
  const active = current.find(e => e.nodelane.slug === slug);
  if (!active || compareVersion(version, active.version) <= 0) throw Error('恢复版本必须高于当前发布版本');
  const temp = await mkdtemp(path.join(os.tmpdir(), 'nodelane-rollback-'));
  try {
    await mkdir(path.join(temp, 'src'), {recursive:true});
    await cp(archive, path.join(temp, 'src', slug), {recursive:true});
    const m = await json(path.join(archive, 'manifest.json'));
    await writeFile(path.join(temp, 'src', slug, 'manifest.json'), JSON.stringify({...m, version}, null, 2) + '\n');
    for (const file of ['repository.json', 'LICENSE', 'THIRD_PARTY.md']) await cp(path.join(directory, file), path.join(temp, file));
    const built = await build({directory:temp});
    // Prior source must reproduce its archived code before being used as a recovery release.
    const originalHeader = `sources/${slug}/${from}/`, nextHeader = `sources/${slug}/${version}/`;
    const restored = built.artifacts[0].bytes.toString().replace(nextHeader, originalHeader);
    if (digest(restored) !== receipt.nodelane.sha256) throw Error('旧源码不能重现已归档产物');
    return await publish(built, {directory, channel, onlySlug:slug});
  } finally { await rm(temp, {recursive:true, force:true}); }
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  await rollback(...process.argv.slice(2));
  console.log('已用更高版本发布归档实现；工作区源码未改动。');
}
