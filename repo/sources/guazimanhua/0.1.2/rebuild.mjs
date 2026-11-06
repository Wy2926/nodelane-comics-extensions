import {readFile,writeFile} from 'node:fs/promises';
const m=JSON.parse(await readFile(new URL('manifest.json',import.meta.url),'utf8'));
const parts=await Promise.all(m.files.map(f=>readFile(new URL(f,import.meta.url),'utf8')));
const code="// SPDX-License-Identifier: GPL-3.0-only\n// NodeLane guazimanhua; corresponding source: sources/guazimanhua/0.1.2/\n"+'const DefaultExtension = (() => {\n'+parts.join('\n')+'\nreturn '+m.entryClass+';\n})();\n';
await writeFile(new URL('plugin.js',import.meta.url),code);
