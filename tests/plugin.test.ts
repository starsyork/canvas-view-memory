import { test } from 'node:test';
import assert from 'node:assert/strict';
import CanvasViewMemory from '../src/main';
import { parseData, movePaths, deletePaths } from '../src/state';

const callbacks = new Map<number, () => void>();
let timer = 0;
(globalThis as any).window = {
  setTimeout(fn: () => void) { callbacks.set(++timer, fn); return timer; },
  clearTimeout(id: number) { callbacks.delete(id); },
  setInterval() { return ++timer; },
};
const position = (x: number, y = 72, zoom = -1.25) => ({ x, y, zoom });
function makeView(path: string) {
  const canvas = {
    ...position(0, 0, 0), zoomToFitQueued: false, screenshotting: false,
    visible: true, canvasRect: { width: 1000, height: 800 },
    wrapperEl: { getClientRects: () => canvas.visible ? [{}] : [] },
    setViewport(x: number, y: number, zoom: number) { Object.assign(this, { x, y, zoom }); },
  };
  const view = {
    file: { path }, canvas,
    getViewType: () => 'canvas',
    clear() { canvas.setViewport(0, 0, 0); },
    setViewData(_text: string, clear: boolean) {
      if (clear) { this.clear(); canvas.zoomToFitQueued = !canvas.visible; canvas.setViewport(900, 900, -3); }
    },
    async setState(state: any) {
      this.file = { path: state.file };
      this.setViewData('{}', true);
      await Promise.resolve();
      if (state.viewState) Object.assign(canvas, state.viewState);
    },
    async onClose() { this.clear(); },
  };
  return view;
}
async function setup(saved: Record<string, unknown> = {}, views = [makeView('A.canvas')]) {
  const events: Record<string, (...args: any[]) => void> = {};
  const leaves = views.map(view => ({ view, isDeferred: false }));
  const plugin: any = new CanvasViewMemory();
  plugin.initialData = { version: 1, views: saved };
  plugin.app = {
    workspace: {
      activeLeaf: leaves[0],
      on: (name: string, fn: (...args: any[]) => void) => { events[name] = fn; },
      onLayoutReady: (fn: () => void) => fn(),
      getLeavesOfType: () => leaves,
    },
    vault: {
      on: (name: string, fn: (...args: any[]) => void) => { events[name] = fn; },
      getAbstractFileByPath: (path: string) => ({ path }),
    },
  };
  await plugin.onload();
  return { plugin, events, leaves, view: views[0] };
}
function viewport(view: ReturnType<typeof makeView>) {
  const { x, y, zoom } = view.canvas;
  return { x, y, zoom };
}

test('restores exact fractional coordinates and negative log zoom on reopening', async () => {
  const expected = position(123.456, -999.333, -2.125);
  const { plugin, view } = await setup({ 'A.canvas': expected });
  assert.deepEqual(viewport(view), expected);
  plugin.onunload();
});

test('saves the outgoing file before reused view is cleared; beats stale tab history', async () => {
  const { plugin, view } = await setup({ 'B.canvas': position(456) });
  Object.assign(view.canvas, position(123));
  await view.setState({ file: 'B.canvas', viewState: position(-999) });
  assert.deepEqual(plugin.data.views['A.canvas'], position(123));
  assert.deepEqual(viewport(view), position(456));
  await view.setState({ file: 'A.canvas' });
  assert.deepEqual(viewport(view), position(123));
  plugin.onunload();
});

test('captures a last movement when switching to a note between polling ticks', async () => {
  const { plugin, events, view } = await setup();
  Object.assign(view.canvas, position(789));
  view.canvas.visible = false;
  plugin.app.workspace.activeLeaf = { view: { getViewType: () => 'markdown' } };
  events['active-leaf-change']();
  assert.deepEqual(plugin.data.views['A.canvas'], position(789));
  plugin.onunload();
});

test('saves final position before close and persists across a plugin restart', async () => {
  const { plugin, leaves, view } = await setup();
  Object.assign(view.canvas, position(321));
  await view.onClose();
  leaves.length = 0;
  plugin.scan();
  plugin.onunload();
  await plugin.saveQueue;
  const restarted = await setup(plugin.writes.at(-1).views);
  assert.deepEqual(viewport(restarted.view), position(321));
  restarted.plugin.onunload();
});

test('restores a hidden canvas and cancels its queued fit on first display', async () => {
  const view = makeView('A.canvas');
  view.canvas.visible = false;
  view.canvas.zoomToFitQueued = true;
  const { plugin } = await setup({ 'A.canvas': position(88) }, [view]);
  assert.equal(view.canvas.zoomToFitQueued, false);
  view.canvas.visible = true;
  plugin.scan();
  assert.deepEqual(viewport(view), position(88));
  plugin.onunload();
});

test('unchanged split panes and closing a stale pane do not overwrite a moved pane', async () => {
  const one = makeView('A.canvas'), two = makeView('A.canvas');
  const { plugin } = await setup({ 'A.canvas': position(1) }, [one, two]);
  Object.assign(one.canvas, position(2));
  plugin.scan();
  plugin.scan();
  await two.onClose();
  assert.deepEqual(plugin.data.views['A.canvas'], position(2));
  plugin.onunload();
});

test('folder rename migrates saved and open views; delete removes descendants only', async () => {
  const view = makeView('Folder/A.canvas');
  const { plugin, events } = await setup({
    'Folder/A.canvas': position(12), 'Folder/B.canvas': position(34), 'Folder2/A.canvas': position(56),
  }, [view]);
  view.file.path = 'Renamed/A.canvas';
  events.rename({ path: 'Renamed' }, 'Folder');
  plugin.scan();
  assert.deepEqual(plugin.data.views['Renamed/A.canvas'], position(12));
  assert.deepEqual(plugin.data.views['Renamed/B.canvas'], position(34));
  assert.equal(plugin.data.views['Folder/A.canvas'], undefined);
  events.delete({ path: 'Renamed' });
  await view.onClose();
  assert.deepEqual(Object.keys(plugin.data.views), ['Folder2/A.canvas']);
  plugin.onunload();
});

test('export screenshot viewport is never saved', async () => {
  const { plugin, view } = await setup({ 'A.canvas': position(9) });
  view.canvas.screenshotting = true;
  Object.assign(view.canvas, position(999));
  plugin.scan();
  plugin.onunload();
  assert.deepEqual(plugin.data.views['A.canvas'], position(9));
});

test('invalid persisted data is ignored; zero zoom is valid', () => {
  const data = parseData({ version: 1, views: {
    'Good.canvas': position(0, 0, 0), 'Bad.canvas': position(NaN),
    'Other.canvas': { x: '1', y: 2, zoom: 0 }, 'Not.md': position(2),
  } });
  assert.deepEqual(Object.keys(data.views), ['Good.canvas']);
  movePaths(data, 'Good.canvas', 'New.canvas');
  deletePaths(data, 'New.canvas');
  assert.deepEqual(Object.keys(data.views), []);
});

test('save writes serialize; a later snapshot is always written last', async () => {
  const { plugin, view } = await setup();
  let release: () => void = () => {};
  const written: any[] = [];
  plugin.saveData = async (snapshot: any) => {
    if (written.length === 0) await new Promise<void>(resolve => { release = resolve; });
    written.push(snapshot);
  };
  Object.assign(view.canvas, position(1)); plugin.scan();
  const first = plugin.flush();
  await Promise.resolve();
  Object.assign(view.canvas, position(2)); plugin.scan();
  const second = plugin.flush();
  release();
  await Promise.all([first, second]);
  assert.deepEqual(written.map(s => s.views['A.canvas'].x), [1, 2]);
  plugin.onunload();
});
