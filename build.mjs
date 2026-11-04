import {build} from './scripts/catalog.mjs';
const result = await build();
console.log(`已构建 ${result.entries.length} 个插件：.build/`);
