/** Executed by Obsidian's CLI inside the real app. No Obsidian mocks. */
export async function runLiveScenarios(expectedVaultPath) {
  if (app.vault.adapter.getBasePath() !== expectedVaultPath) {
    throw new Error('Refusing to run outside the dedicated test vault.');
  }
  const pluginId = 'canvas-view-memory';
  if (!app.plugins.plugins[pluginId]) throw new Error('Enable Canvas View Memory in the test vault first.');
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const results = [];
  const read = () => {
    const view = app.workspace.activeLeaf?.view;
    if (view?.getViewType() !== 'canvas') throw new Error('Expected active Canvas view');
    const { x, y, zoom } = view.canvas;
    return { x, y, zoom };
  };
  const equal = (actual, expected) => ['x', 'y', 'zoom'].every(key => Math.abs(actual[key] - expected[key]) < 0.000001);
  const check = (name, actual, expected) => {
    const passed = equal(actual, expected);
    results.push({ name, passed, actual, expected });
    if (!passed) throw new Error(`${name}: ${JSON.stringify({ actual, expected })}`);
  };
  const open = async path => {
    const file = app.vault.getAbstractFileByPath(path);
    if (!file) throw new Error(`Missing fixture: ${path}`);
    await app.workspace.getLeaf(false).openFile(file);
    await delay(350);
  };
  const move = async position => {
    const canvas = app.workspace.activeLeaf.view.canvas;
    canvas.setViewport(position.x, position.y, position.zoom);
    await delay(800);
  };
  const a = { x: 123.456, y: -234.567, zoom: -0.75 };
  const b = { x: 1045.125, y: 620.375, zoom: -1.25 };
  try {
    await open('Canvas A.canvas');
    await move(a);
    await open('Test note.md');
    await open('Canvas A.canvas');
    check('Canvas → note → Canvas', read(), a);

    await open('Canvas B.canvas');
    await move(b);
    await open('Canvas A.canvas');
    check('Canvas B → Canvas A in same tab', read(), a);
    await open('Canvas B.canvas');
    check('Canvas A → Canvas B in same tab', read(), b);

    app.workspace.activeLeaf.detach();
    await delay(350);
    await open('Canvas A.canvas');
    check('Close tab and reopen Canvas A', read(), a);

    await app.plugins.disablePlugin(pluginId);
    await app.plugins.enablePlugin(pluginId);
    await delay(400);
    await open('Test note.md');
    await open('Canvas A.canvas');
    check('Plugin unload/reload retains saved view', read(), a);

    const disk = JSON.parse(await app.vault.adapter.read(`${app.vault.configDir}/plugins/${pluginId}/data.json`));
    check('Canvas A saved to disk', disk.views['Canvas A.canvas'], a);
    check('Canvas B saved to disk', disk.views['Canvas B.canvas'], b);
    return JSON.stringify({ passed: true, vault: expectedVaultPath, results });
  } catch (error) {
    return JSON.stringify({ passed: false, vault: expectedVaultPath, results, error: String(error) });
  }
}
