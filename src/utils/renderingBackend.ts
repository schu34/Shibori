import { DrawingModeFactory, RenderingMode } from '../drawingModes/DrawingModeFactory';

export type ActiveRenderingBackend = Exclude<RenderingMode, 'auto'>;

export const TEST_RENDERING_MODE_STORAGE_KEY = 'shibori:test-rendering-mode';

export function applyTestRenderingModeOverride(): void {
  try {
    const mode = window.localStorage.getItem(TEST_RENDERING_MODE_STORAGE_KEY);
    if (mode !== 'canvas2d' && mode !== 'webgl') return;

    DrawingModeFactory.configure({ renderingMode: mode });
    reportRequestedRenderingMode(mode);
  } catch {
    // localStorage can be unavailable in privacy-restricted browser contexts.
  }
}

export function reportRequestedRenderingMode(mode: RenderingMode): void {
  document.documentElement.dataset.shiboriRendererRequested = mode;
}

export function reportActiveRenderingBackend(mode: ActiveRenderingBackend): void {
  document.documentElement.dataset.shiboriRenderer = mode;
}
