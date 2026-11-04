import {spawnSync} from 'node:child_process';
import {build, publish, root} from './catalog.mjs';
const channel = process.argv[2] ?? 'testing';
const built = await build();
const result = spawnSync(process.execPath, ['--test', 'test/*.test.mjs'], {cwd: root, stdio: 'inherit'});
if (result.status !== 0) process.exit(result.status ?? 1);
await publish(built, {channel});
console.log(`已更新本地 ${channel} 目录。远程托管尚未发布。`);
