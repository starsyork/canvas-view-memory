import { Notice, Plugin } from 'obsidian';
import { around } from 'monkey-around';
import { asCanvasView, readViewport, restoreViewport, type CanvasView } from './canvas';
import { deletePaths, movePaths, parseData, sameViewport, type SavedData, type Viewport } from './state';

interface TrackedView {
  view: CanvasView;
  path: string | null;
  last: Viewport | undefined;
  ready: boolean;
  loading: number;
  unpatch: () => void;
}

export default class CanvasViewMemory extends Plugin {
  private data: SavedData = parseData(null);
  private tracked = new Map<CanvasView, TrackedView>();
  private dirty = false;
  private saveTimer: number | undefined;
  private saveQueue: Promise<void> = Promise.resolve();
  private stopped = false;
  private warned = false;
  private activeView: CanvasView | null = null;

  async onload(): Promise<void> {
    // A read error should abort loading, rather than replace saved data with defaults.
    this.data = parseData(await this.loadData());
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.scan()));
    this.registerEvent(this.app.workspace.on('file-open', () => this.scan()));
    this.registerEvent(this.app.workspace.on('layout-change', () => this.scan()));
    this.registerDomEvent(window, 'blur', () => {
      this.scan();
      void this.flush();
    });
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      movePaths(this.data, oldPath, file.path);
      for (const entry of this.tracked.values()) {
        if (entry.path === oldPath || entry.path?.startsWith(oldPath + '/')) {
          entry.path = file.path + entry.path.slice(oldPath.length);
        }
      }
      this.changed();
    }));
    this.registerEvent(this.app.vault.on('delete', file => {
      deletePaths(this.data, file.path);
      for (const entry of this.tracked.values()) {
        if (entry.path === file.path || entry.path?.startsWith(file.path + '/')) {
          entry.path = null;
          entry.ready = false;
        }
      }
      this.changed();
    }));

    this.app.workspace.onLayoutReady(() => {
      if (this.stopped) return;
      this.scan();
      // One lightweight timer, independent of canvas rendering and other plugins.
      // Also discovers deferred views once Obsidian actually materializes them.
      this.registerInterval(window.setInterval(() => this.scan(), 200));
    });

    this.addCommand({
      id: 'remember-current-view',
      name: 'Remember current canvas view',
      checkCallback: checking => {
        // Use the active leaf because CanvasView is not an exported API class.
        const active = this.app.workspace.activeLeaf?.view;
        const canvasView = active && asCanvasView(active);
        if (!canvasView?.file) return false;
        if (!checking) {
          this.scan();
          const entry = this.tracked.get(canvasView);
          if (entry) this.capture(entry, true);
          void this.flush();
          new Notice('Canvas view remembered.');
        }
        return true;
      },
    });
  }

  private scan(): void {
    if (this.stopped) return;
    const active = this.app.workspace.activeLeaf?.view;
    const nextActive = active ? asCanvasView(active) : null;
    if (this.activeView && this.activeView !== nextActive) {
      const outgoing = this.tracked.get(this.activeView);
      if (outgoing) this.capture(outgoing, true);
    }
    this.activeView = nextActive;
    const present = new Set<CanvasView>();
    for (const leaf of this.app.workspace.getLeavesOfType('canvas')) {
      const view = asCanvasView(leaf.view);
      if (!view) {
        if (!leaf.isDeferred && !this.warned) {
          this.warned = true;
          new Notice('Canvas View Memory: this Canvas API is unsupported. Saved views are preserved.');
        }
        continue;
      }
      present.add(view);
      let entry = this.tracked.get(view);
      if (!entry) {
        entry = this.track(view);
        this.tracked.set(view, entry);
        this.initialize(entry);
      } else if (entry.path !== (view.file?.path ?? null)) {
        // The canvas may already contain the next file: never capture it under the old path.
        this.initialize(entry);
      }
      if (!entry.ready) this.initialize(entry);
      this.capture(entry);
    }
    for (const [view, entry] of this.tracked) {
      if (!present.has(view)) {
        // clear() captured the final view before Obsidian reset the canvas.
        entry.unpatch();
        this.tracked.delete(view);
      }
    }
  }

  private track(view: CanvasView): TrackedView {
    const entry: TrackedView = { view, path: null, last: undefined, ready: false, loading: 0, unpatch: () => {} };
    const plugin = this;
    entry.unpatch = around(view, {
      onClose: original => function (this: CanvasView) {
        plugin.capture(entry, true);
        entry.ready = false;
        return original.call(this);
      },
      setState: original => async function (this: CanvasView, ...args) {
        plugin.capture(entry, true);
        entry.loading++;
        try {
          await original.apply(this, args);
        } finally {
          entry.loading--;
        }
        // Obsidian applies tab-history viewState after setViewData completes.
        // Restore after that, so an older history entry cannot win.
        if (!plugin.stopped && entry.loading === 0) plugin.initialize(entry);
      },
      clear: original => function (this: CanvasView) {
        plugin.capture(entry, true);
        entry.ready = false;
        return original.call(this);
      },
      setViewData: original => function (this: CanvasView, text: string, clear: boolean) {
        // original calls clear() before importing a new file; our clear hook saves
        // the outgoing viewport using its tracked path, not the new view.file.
        const result = original.call(this, text, clear);
        if (clear && entry.loading === 0) plugin.initialize(entry);
        return result;
      },
    });
    return entry;
  }

  private initialize(entry: TrackedView): void {
    if (entry.loading > 0) return;
    const { view } = entry;
    entry.path = view.file?.path ?? null;
    entry.ready = false;
    entry.last = undefined;
    if (!entry.path || !this.app.vault.getAbstractFileByPath(entry.path)) return;
    const saved = this.data.views[entry.path];
    if (saved) {
      restoreViewport(view.canvas, saved);
      entry.last = { ...saved };
      entry.ready = true;
    } else if (!view.canvas.zoomToFitQueued && this.isVisible(view)) {
      // Let Obsidian choose the initial view on a canvas we've never visited.
      entry.ready = true;
      this.capture(entry, true);
    }
  }

  private isVisible(view: CanvasView): boolean {
    return view.canvas.wrapperEl.getClientRects().length > 0
      && view.canvas.canvasRect.width > 0 && view.canvas.canvasRect.height > 0;
  }

  private capture(entry: TrackedView, force = false): void {
    if (entry.loading > 0 || !entry.ready || !entry.path || (!force && !this.isVisible(entry.view))) return;
    const viewport = readViewport(entry.view.canvas);
    if (!viewport) return;
    // Unchanged split panes must not overwrite the most recently moved pane.
    if (sameViewport(entry.last, viewport)) return;
    entry.last = viewport;
    if (!sameViewport(this.data.views[entry.path], viewport)) {
      this.data.views[entry.path] = viewport;
      this.changed();
    }
  }

  private changed(): void {
    this.dirty = true;
    // Throttle instead of trailing debounce: continuous panning is persisted too.
    if (this.saveTimer === undefined && !this.stopped) {
      this.saveTimer = window.setTimeout(() => {
        this.saveTimer = undefined;
        void this.flush();
      }, 500);
    }
  }

  private flush(): Promise<void> {
    if (!this.dirty) return this.saveQueue;
    this.dirty = false;
    const snapshot: SavedData = JSON.parse(JSON.stringify(this.data));
    this.saveQueue = this.saveQueue.then(() => this.saveData(snapshot)).catch(error => {
      this.dirty = true;
      console.error('Canvas View Memory: failed to save viewport data', error);
      if (!this.warned) {
        this.warned = true;
        new Notice('Canvas View Memory could not save your view. Check available storage.');
      }
    });
    return this.saveQueue;
  }

  onunload(): void {
    this.stopped = true;
    if (this.saveTimer !== undefined) window.clearTimeout(this.saveTimer);
    for (const entry of this.tracked.values()) {
      this.capture(entry);
      entry.unpatch();
    }
    this.tracked.clear();
    // Plugin unload is synchronous; normal periodic saves minimize shutdown loss.
    void this.flush();
  }
}
