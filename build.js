import { cp, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const output = resolve(root, 'dist');
const appFiles = [
  'index.html',
  'styles.css',
  'app.js',
  'manifest.webmanifest',
  'service-worker.js'
];

await mkdir(output, { recursive: true });
for (const file of appFiles) {
  await cp(resolve(root, file), resolve(output, file));
}
await cp(resolve(root, 'icons'), resolve(output, 'icons'), { recursive: true });

console.log('Built static app in dist/.');
