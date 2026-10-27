import type { TFile, View } from 'obsidian';
import { isViewport, type Viewport } from './state';

/** Internal API, verified against Obsidian 1.13.7. Keep all assumptions here. */
export interface Canvas {
  x: number;
  y: number;
  zoom: number;
  zoomToFitQueued: boolean;
  screenshotting?: boolean;
  canvasRect: { width: number; height: number };
  wrapperEl: HTMLElement;
  setViewport(x: number, y: number, zoom: number): void;
}

// Pick the public View surface; onClose is protected in the public declaration
// but must be exposed narrowly here for the removable lifecycle wrapper.
export interface CanvasView extends Pick<View, keyof View> {
  file: TFile | null;
  canvas: Canvas;
  clear(): void;
  setViewData(data: string, clear: boolean): void;
  onClose(): Promise<void>;
}

export function asCanvasView(view: View): CanvasView | null {
  if (view.getViewType() !== 'canvas') return null;
  const candidate = view as unknown as Partial<CanvasView>;
  const c = candidate.canvas;
  if (!c || typeof c.setViewport !== 'function' || !isViewport(c)
    || !c.wrapperEl || !c.canvasRect || typeof candidate.clear !== 'function'
    || typeof candidate.setViewData !== 'function'
    || typeof candidate.onClose !== 'function' || typeof candidate.setState !== 'function'
    || typeof c.zoomToFitQueued !== 'boolean') return null;
  return candidate as CanvasView;
}

export function readViewport(canvas: Canvas): Viewport | null {
  if (canvas.screenshotting || !isViewport(canvas)) return null;
  return { x: canvas.x, y: canvas.y, zoom: canvas.zoom };
}

export function restoreViewport(canvas: Canvas, viewport: Viewport): void {
  // A background tab may still have an initial fit waiting for its first resize.
  canvas.zoomToFitQueued = false;
  canvas.setViewport(viewport.x, viewport.y, viewport.zoom);
}
