import test from 'node:test';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {mkdtemp, cp, readFile, writeFile, rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {preparePages} from '../scripts/pages.mjs';
import {root, build, publish, json, validateManifest, validateRepository, digest} from '../scripts/catalog.mjs';
import {rollback} from '../scripts/rollback.mjs';
async function fixture(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'nodelane-catalog-'));
  t.after(() => rm(dir, {recursive:true, force:true}));
  for (const f of ['src', 'repository.json', 'LICENSE', 'THIRD_PARTY.md']) await cp(path.join(root,f), path.join(dir,f), {recursive:true});
  return dir;
}
test('build is deterministic, relative, and independent from App or sibling repositories', async t => {
  const directory = await fixture(t);
  const a = await build({directory}), b = await build({directory});
  assert.deepEqual(a.entries, b.entries);
  assert.equal(a.entries[0].id, 86001001);
  assert.match(a.entries[0].sourceCodeUrl, /^packages\/comix\/[\d.]+\.js$/);
  assert.equal(a.entries[0].nodelane.size, a.artifacts[0].bytes.length);
});
test('invalid ID, version, paths and host capabilities fail before publication', async () => {
  const repo = await json(path.join(root,'repository.json'));
  const m = await json(path.join(root,'src/comix/manifest.json'));
  assert.throws(() => validateRepository({...repo, sourceIds:{...repo.sourceIds, collision:m.id}}), /重复/);
  for (const change of [{id:1}, {version:'main'}, {files:['../escape.js']}, {requestHosts:['*']}, {requires:['unknown']},
    {isNsfw:'true'}, ...[{schema:2}, {schema:1,regions:['en']}, {schema:1,formats:['page','page']},
      {schema:1,creations:'original'}, {schema:1,pricing:'subscription'}, {schema:1,tags:['manga']}].map(catalogMetadata=>({catalogMetadata}))])
    assert.throws(() => validateManifest({...m,...change}, 'comix', repo));
});
test('card facts update without replacing code, immutable archives or the other channel', async t => {
  const directory = await fixture(t), before = await build({directory});
  await publish(before,{directory}); await publish(before,{directory,channel:'stable'});
  const first=before.artifacts[0], archive=path.join(directory,'repo/sources/comix',first.entry.version);
  const snapshot=await readFile(path.join(archive,'manifest.json'),'utf8');
  const catalogMetadata={schema:1,regions:['jp','kr'],formats:['page','vertical'],creations:['original','adaptation'],pricing:'partial'};
  await writeFile(path.join(directory,'src/comix/manifest.json'),JSON.stringify({...first.manifest,catalogMetadata,isNsfw:!first.manifest.isNsfw}));
  const updated=await build({directory});
  assert.equal(updated.entries[0].nodelane.sha256,first.entry.nodelane.sha256);
  await publish(updated,{directory}); await publish(updated,{directory});
  assert.deepEqual((await json(path.join(directory,'repo/testing/index.json')))[0].catalogMetadata,catalogMetadata);
  assert.deepEqual((await json(path.join(directory,'repo/stable/index.json')))[0],{...first.entry,sourceCodeUrl:'../'+first.entry.sourceCodeUrl});
  assert.equal(await readFile(path.join(archive,'manifest.json'),'utf8'),snapshot);
  await preparePages({directory});
  await writeFile(path.join(directory,'src/comix/manifest.json'),JSON.stringify({...first.manifest,requestHosts:['comix.to','foreign.test']}));
  await assert.rejects(publish(await build({directory}),{directory}),/同版本元数据/);
  assert.deepEqual((await json(path.join(directory,'repo/testing/index.json')))[0].catalogMetadata,catalogMetadata);
});
test('publish is repeatable; overwritten or downgraded packages cannot change the active index', async t => {
  const directory = await fixture(t);
  const built = await build({directory});
  await publish(built,{directory}); await publish(built,{directory});
  const archive=path.join(directory,'repo/sources/comix',built.entries[0].version);
  const rebuilt=spawnSync(process.execPath,[path.join(archive,'rebuild.mjs')],{encoding:'utf8'});
  assert.equal(rebuilt.status,0,rebuilt.stderr);
  assert.equal(digest(await readFile(path.join(archive,'plugin.js'))),built.entries[0].nodelane.sha256);
  const index = path.join(directory,'repo/index.json'), before = await readFile(index,'utf8');
  assert.match((await json(index))[0].sourceCodeUrl,/^packages\//);
  const mfile = path.join(directory,'src/comix/manifest.json'), m = await json(mfile);
  const file = path.join(directory,'src/comix/extension.js');
  await writeFile(file, await readFile(file,'utf8')+'\n// mutation');
  await assert.rejects(publish(await build({directory}),{directory}), /同版本/);
  assert.equal(await readFile(index,'utf8'), before);
  await writeFile(mfile,JSON.stringify({...m,version:'0.0.1'}));
  await assert.rejects(publish(await build({directory}),{directory}), /降版/);
  assert.equal(await readFile(index,'utf8'), before);
});
test('stable is independent; recovery republishes archived source with a newer version', async t => {
  const directory = await fixture(t);
  const built = await build({directory}); const version = built.entries[0].version;
  await publish(built,{directory}); await publish(built,{directory,channel:'stable'});
  const source = path.join(directory,'src/comix/extension.js'), before = await readFile(source,'utf8');
  const restored = await rollback('comix',version,'9.0.0','testing',directory);
  assert.equal(restored.find(e=>e.id===86001001).version,'9.0.0');
  assert.equal((await json(path.join(directory,'repo/stable/index.json'))).find(e=>e.id===86001001).version,version);
  assert.equal(await readFile(source,'utf8'),before);
  await assert.rejects(rollback('comix',version,version,'testing',directory),/高于/);
  const registry = await json(path.join(directory,'repository.json'));
  registry.sourceIds.comix+=10;
  await writeFile(path.join(directory,'repository.json'),JSON.stringify(registry));
  await assert.rejects(build({directory}),/永久 ID/);
});
test('shared provenance updates preserve old archives and accompany newly published versions', async t => {
  const directory = await fixture(t), built = await build({directory});
  await publish(built, {directory});
  const entry = built.entries[0], archive = path.join(directory, 'repo/sources/comix', entry.version, 'THIRD_PARTY.md');
  const original = await readFile(archive, 'utf8'), updated = original + '\nNew source provenance.\n';
  await writeFile(path.join(directory, 'THIRD_PARTY.md'), updated);
  await publish(built, {directory});
  assert.equal(await readFile(archive, 'utf8'), original);
  assert.equal(await readFile(path.join(directory, 'repo/THIRD_PARTY.md'), 'utf8'), updated);
  const manifest = path.join(directory, 'src/comix/manifest.json');
  await writeFile(manifest, JSON.stringify({...await json(manifest), version:'9.0.1'}));
  await publish(await build({directory}), {directory});
  assert.equal(await readFile(path.join(directory, 'repo/sources/comix/9.0.1/THIRD_PARTY.md'), 'utf8'), updated);
  assert.equal(await readFile(archive, 'utf8'), original);
});

test('Pages preserves plain channel catalogs and archives; damaged packages cannot replace valid output', async t => {
  const directory = await fixture(t), built = await build({directory});
  await publish(built, {directory});
  await publish(built, {directory, channel: 'stable'});
  const out = await preparePages({directory});
  for (const channel of ['stable', 'testing']) {
    for (const name of ['index.json', 'repo.json']) {
      assert.deepEqual(await json(path.join(out, channel, name)), await json(path.join(directory, 'repo', channel, name)));
    }
  }
  const entry = built.entries[0];
  assert.deepEqual(await readFile(path.join(out, entry.sourceCodeUrl)), await readFile(path.join(directory, 'repo', entry.sourceCodeUrl)));
  assert.deepEqual(await readFile(path.join(out, 'sources', entry.nodelane.slug, entry.version, 'LICENSE')), await readFile(path.join(directory, 'LICENSE')));
  const file = path.join(out, 'stable/index.json'), first = await readFile(file);
  await preparePages({directory});
  assert.deepEqual(await readFile(file), first);
  await writeFile(path.join(directory, 'repo', entry.sourceCodeUrl), 'corrupt');
  await assert.rejects(preparePages({directory}), /摘要/);
  assert.deepEqual(await readFile(file), first);
});
