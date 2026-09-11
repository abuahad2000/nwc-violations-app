import { mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
const target = path.resolve('public/maplibre');
await mkdir(target, { recursive: true });
for (const name of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'])
  await copyFile(path.resolve('node_modules/maplibre-gl/dist', name), path.join(target, name));
await copyFile(
  path.resolve('node_modules/maplibre-gl/LICENSE.txt'),
  path.join(target, 'LICENSE.txt'),
);
