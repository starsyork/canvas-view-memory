import { mkdir, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const folder = 'dist/canvas-view-memory';
await mkdir(folder, { recursive: true });
for (const file of ['main.js', 'manifest.json', 'README.md', 'LICENSE']) {
  await copyFile(file, `${folder}/${file}`);
}
execFileSync('zip', ['-q', '-r', 'canvas-view-memory.zip', 'canvas-view-memory'], { cwd: 'dist' });
console.log('Installable package: dist/canvas-view-memory.zip');
