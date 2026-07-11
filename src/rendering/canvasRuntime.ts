import { CanvasContext, CanvasService } from '../services/CanvasService';
import { State } from '../store/shiboriCanvasState';
import { HistoryAction } from '../types';
import { Point } from '../types/DrawingMode';
import {
  buildDrawableHistory,
  getRotatedHistoryItemPreview,
  getTranslatedHistoryItemPreview,
} from '../utils/historyOperations';
import { renderDrawableHistoryItems } from '../utils/historyRenderer';
import { getFoldedCanvasDimensions } from '../utils/foldedCanvasDimensions';
import { renderUnfoldedCanvas } from './CanvasMirror';

export interface CanvasElements {
  foldedCanvas: HTMLCanvasElement;
  unfoldedCanvas: HTMLCanvasElement;
}

export interface CanvasRuntimeRefs {
  foldedCtxRef: React.MutableRefObject<CanvasRenderingContext2D | null>;
  unfoldedCtxRef: React.MutableRefObject<CanvasRenderingContext2D | null>;
}

export interface CanvasPreview {
  selectedHistoryItemId: string | null;
  selectionDragDelta: Point | null;
  selectionRotationPreview: { angle: number; center: Point } | null;
}

export interface CanvasTransactionState {
  history: State['history'];
  folds: State['folds'];
  config: State['config'];
  lineThickness: State['lineThickness'];
  shapeFillMode: State['shapeFillMode'];
  preview?: CanvasPreview;
}

export interface CanvasTransactionServices {
  clear: typeof CanvasService.clearCanvases;
  renderHistory: typeof renderDrawableHistoryItems;
  drawFoldedGuidance: typeof CanvasService.drawDiagonalFoldLinesOnFolded;
  mirror: (context: CanvasContext, folds: State['folds']) => void;
}

const defaultTransactionServices: CanvasTransactionServices = {
  clear: CanvasService.clearCanvases,
  renderHistory: renderDrawableHistoryItems,
  drawFoldedGuidance: CanvasService.drawDiagonalFoldLinesOnFolded,
  mirror: mirrorUnfoldedCanvas,
};

/**
 * Own the canvas backing stores and their 2D contexts. Resizing a canvas clears
 * its context, so this is deliberately called only by the runtime transaction.
 */
export function ensureCanvasContext(
  elements: CanvasElements,
  refs: CanvasRuntimeRefs,
  dimensions: State['canvasDimensions'],
  folds: State['folds']
): CanvasContext | null {
  const { foldedCanvas, unfoldedCanvas } = elements;
  const foldedDimensions = getFoldedCanvasDimensions(dimensions, folds);

  if (unfoldedCanvas.width !== dimensions.width) unfoldedCanvas.width = dimensions.width;
  if (unfoldedCanvas.height !== dimensions.height) unfoldedCanvas.height = dimensions.height;
  if (foldedCanvas.width !== foldedDimensions.width) foldedCanvas.width = foldedDimensions.width;
  if (foldedCanvas.height !== foldedDimensions.height) foldedCanvas.height = foldedDimensions.height;

  const foldedCtx = foldedCanvas.getContext('2d', { willReadFrequently: true });
  const unfoldedCtx = unfoldedCanvas.getContext('2d', { willReadFrequently: true });
  refs.foldedCtxRef.current = foldedCtx;
  refs.unfoldedCtxRef.current = unfoldedCtx;

  if (!foldedCtx || !unfoldedCtx) return null;
  return { foldedCanvas, unfoldedCanvas, foldedCtx, unfoldedCtx };
}

/**
 * The single committed/preview render transaction. Every caller gets the same
 * ordering and at most one unfolded update.
 */
export function renderCanvasTransaction(
  context: CanvasContext,
  state: CanvasTransactionState,
  services: CanvasTransactionServices = defaultTransactionServices
): void {
  services.clear(context);

  let drawables = buildDrawableHistory(state.history);
  const preview = state.preview;
  if (preview?.selectedHistoryItemId) {
    drawables = drawables.map((item) => {
      if (item.id !== preview.selectedHistoryItemId) return item;
      if (preview.selectionRotationPreview) {
        return getRotatedHistoryItemPreview(
          item,
          preview.selectionRotationPreview.angle,
          preview.selectionRotationPreview.center
        );
      }
      if (preview.selectionDragDelta) {
        return getTranslatedHistoryItemPreview(item, preview.selectionDragDelta);
      }
      return item;
    });
  }

  services.renderHistory(context.foldedCtx, context.foldedCanvas, drawables, {
    config: state.config,
    folds: state.folds,
    lineThickness: state.lineThickness,
    shapeFillMode: state.shapeFillMode,
  });
  services.drawFoldedGuidance(context, state.folds);

  if (state.history[state.history.length - 1]?.action === HistoryAction.Clear) return;
  services.mirror(context, state.folds);
}

export function mirrorUnfoldedCanvas(context: CanvasContext, folds: State['folds']): void {
  renderUnfoldedCanvas(context, folds);
}
