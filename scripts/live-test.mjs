import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';
import { runLiveScenarios } from './live-scenarios.mjs';

const cli = process.env.OBSIDIAN_CLI ?? '/Applications/Obsidian.app/Contents/MacOS/obsidian-cli';
const vault = resolve('test-vault');
const code = `(${runLiveScenarios.toString()})(${JSON.stringify(vault)})`;
function command(...args) {
  return execFileSync(cli, ['vault=test-vault', ...args], { encoding: 'utf8', timeout: 45000 });
}
function parse(output) {
  const line = output.split('\n').find(line => line.startsWith('=> '));
  if (!line) throw new Error(`Unexpected CLI output: ${output}`);
  return JSON.parse(line.slice(3));
}
const output = command('eval', `code=${code}`);
await mkdir('live-test-results', { recursive: true });
await writeFile('live-test-results/latest.txt', output);
console.log(output);
const report = parse(output);
if (report.passed) {
  command('reload');
  // A reload temporarily disconnects the CLI; allow startup, then retry boundedly.
  await delay(2000);
  const verify = `(async () => {
    if (app.vault.adapter.getBasePath() !== ${JSON.stringify(vault)}) throw Error('Wrong vault');
    // Obsidian debounces workspace-layout saves. A rapid reload can legitimately
    // reopen an earlier note, so explicitly reopen the canvas before checking it.
    await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath('Canvas A.canvas'));
    await new Promise(resolve => setTimeout(resolve, 350));
    const view = app.workspace.activeLeaf.view;
    const {x, y, zoom} = view.canvas;
    const actual = {x, y, zoom};
    const expected = {x:123.456, y:-234.567, zoom:-0.75};
    return JSON.stringify({name:'Reopen canvas after real app window reload', actual, expected,
      passed:!!app.plugins.plugins['canvas-view-memory'] && Object.keys(expected).every(k => actual[k] === expected[k])});
  })()`;
  let reload;
  for (let attempt = 0; attempt < 5; attempt++) {
    try { reload = parse(command('eval', `code=${verify}`)); break; }
    catch (error) { if (attempt === 4) throw error; await delay(1000); }
  }
  report.results.push(reload);
  report.passed = report.passed && reload.passed;
  report.errors = command('dev:errors').trim();
}
report.testedAt = new Date().toISOString();
await writeFile('live-test-results/latest.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
