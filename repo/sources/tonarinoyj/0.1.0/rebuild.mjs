// Restore the unmodified upstream binary; this does not recompile upstream.
import {copyFile} from 'node:fs/promises';
await copyFile(new URL("extension.apk",import.meta.url),new URL('plugin.apk',import.meta.url));
