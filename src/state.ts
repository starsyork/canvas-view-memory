export interface Viewport {
  x: number;
  y: number;
  // Obsidian stores log2(scale): 0 = 100%, -1 = 50%.
  zoom: number;
}

export interface SavedData {
  version: 1;
  views: Record<string, Viewport>;
}

export function isViewport(value: unknown): value is Viewport {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<Viewport>;
  return [v.x, v.y, v.zoom].every(n => typeof n === 'number' && Number.isFinite(n));
}

export function sameViewport(a: Viewport | undefined, b: Viewport): boolean {
  return !!a && a.x === b.x && a.y === b.y && a.zoom === b.zoom;
}

export function parseData(value: unknown): SavedData {
  const data: SavedData = { version: 1, views: Object.create(null) };
  if (!value || typeof value !== 'object') return data;
  const saved = value as Partial<SavedData>;
  if (saved.version !== 1 || !saved.views || typeof saved.views !== 'object') return data;
  for (const [path, view] of Object.entries(saved.views)) {
    if (path.endsWith('.canvas') && isViewport(view)) {
      data.views[path] = { x: view.x, y: view.y, zoom: view.zoom };
    }
  }
  return data;
}

export function movePaths(data: SavedData, oldPath: string, newPath: string): void {
  const moved: [string, Viewport][] = [];
  for (const path of Object.keys(data.views)) {
    if (path === oldPath || path.startsWith(oldPath + '/')) {
      moved.push([newPath + path.slice(oldPath.length), data.views[path]]);
      delete data.views[path];
    }
  }
  for (const [path, view] of moved) data.views[path] = view;
}

export function deletePaths(data: SavedData, deletedPath: string): void {
  for (const path of Object.keys(data.views)) {
    if (path === deletedPath || path.startsWith(deletedPath + '/')) delete data.views[path];
  }
}
