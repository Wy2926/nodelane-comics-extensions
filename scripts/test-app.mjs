import {spawnSync} from 'node:child_process';
import {resolve, join} from 'node:path';
import {access} from 'node:fs/promises';
import {build, root} from './catalog.mjs';
const app = process.argv[2] === '--app' ? process.argv[3] : process.argv[2];
if (!app) throw Error('用法：npm run test:app -- /绝对路径/nodelane-comics-app');
await access(join(resolve(app), 'tool/source_plugin_contract_test.dart'));
await build();
const result = spawnSync(process.env.FLUTTER ?? 'flutter', ['test','--no-pub','tool/source_plugin_contract_test.dart'], {
  cwd:resolve(app), stdio:'inherit', env:{...process.env, NODELANE_PLUGIN_BUILD:join(root,'.build'), NODELANE_PLUGIN_FIXTURES:join(root,'test/fixtures')},
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
