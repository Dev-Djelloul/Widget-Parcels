import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const output = resolve(root, 'dist');
const appFiles = [
  'index.html',
  'demo.html',
  'styles.css',
  'demo.css',
  'app.js',
  'manifest.webmanifest',
  'service-worker.js'
];

await mkdir(output, { recursive: true });
for (const file of appFiles) {
  await cp(resolve(root, file), resolve(output, file));
}
await cp(resolve(root, 'icons'), resolve(output, 'icons'), { recursive: true });
const maplibreSource = resolve(root, 'node_modules/maplibre-gl/dist');
const maplibreOutput = resolve(output, 'vendor/maplibre-gl');
await rm(maplibreOutput, { recursive: true, force: true });
await mkdir(maplibreOutput, { recursive: true });
for (const file of [
  'maplibre-gl.mjs',
  'maplibre-gl-worker.mjs',
  'maplibre-gl-shared.mjs',
  'maplibre-gl.css'
]) {
  await cp(resolve(maplibreSource, file), resolve(maplibreOutput, file));
}
await cp(resolve(root, 'node_modules/maplibre-gl/LICENSE.txt'), resolve(maplibreOutput, 'LICENSE.txt'));

console.log('Built static app in dist/.');
