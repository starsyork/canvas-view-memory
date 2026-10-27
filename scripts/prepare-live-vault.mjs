import { mkdir, copyFile, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';

const vault = resolve('test-vault');
const plugin = resolve(vault, '.obsidian/plugins/canvas-view-memory');
await mkdir(plugin, { recursive: true });
for (const file of ['main.js', 'manifest.json']) await copyFile(file, resolve(plugin, file));

async function createOnce(path, content) {
  try { await access(path); } catch { await writeFile(path, content); }
}

for (const [name, offset] of [['Canvas A', 0], ['Canvas B', 700]]) {
  const canvas = {
    nodes: [
      { id: '1111111111111111', type: 'text', text: `${name}: left card`, x: -900 + offset, y: -400, width: 300, height: 180 },
      { id: '2222222222222222', type: 'text', text: `${name}: middle card`, x: 0 + offset, y: 0, width: 300, height: 180 },
      { id: '3333333333333333', type: 'text', text: `${name}: right card`, x: 1100 + offset, y: 700, width: 300, height: 180 },
    ],
    edges: [],
  };
  await createOnce(resolve(vault, `${name}.canvas`), JSON.stringify(canvas, null, 2));
}
await createOnce(resolve(vault, 'Test note.md'), '# Canvas View Memory test vault\n\nThis vault contains only plugin test fixtures.\n');
await createOnce(resolve(vault, '.obsidian/core-plugins.json'), JSON.stringify(['file-explorer', 'switcher', 'canvas', 'command-palette']));
await createOnce(resolve(vault, '.obsidian/community-plugins.json'), JSON.stringify(['canvas-view-memory']));
console.log(`Prepared real-app test vault: ${vault}`);
