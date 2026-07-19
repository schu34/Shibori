import { logger } from '../utils/logger';
import { getFoldedCanvasDimensions } from '../utils/foldedCanvasDimensions';

export interface CanvasContext {
  foldedCtx: CanvasRenderingContext2D;
  unfoldedCtx: CanvasRenderingContext2D;
  foldedCanvas: HTMLCanvasElement;
  unfoldedCanvas: HTMLCanvasElement;
}

export interface FoldState {
  vertical: number;
  horizontal: number;
  diagonal: {
    enabled: boolean;
    count: number;
    direction: string;
  };
}

const BACKGROUND_COLOR = "navy";

export class CanvasService {
  /**
   * Clear both canvases and apply background color
   */
  static clearCanvases(context: CanvasContext, backgroundColor?: string): void {
    logger.canvas.operation('clearCanvases', { backgroundColor });
    
    const { foldedCtx, unfoldedCtx, foldedCanvas, unfoldedCanvas } = context;

    unfoldedCtx.clearRect(0, 0, unfoldedCanvas.width, unfoldedCanvas.height);
    foldedCtx.clearRect(0, 0, foldedCanvas.width, foldedCanvas.height);

    const bgColor = backgroundColor || BACKGROUND_COLOR;
    
    // Apply background to unfolded canvas
    unfoldedCtx.fillStyle = bgColor;
    unfoldedCtx.fillRect(0, 0, unfoldedCanvas.width, unfoldedCanvas.height);

    // Apply background to folded canvas
    foldedCtx.fillStyle = bgColor;
    foldedCtx.fillRect(0, 0, foldedCanvas.width, foldedCanvas.height);
  }

  /** Size the folded backing store to the unmatched-fold aspect ratio. */
  static updateFoldedCanvasDimensions(context: CanvasContext, folds: FoldState): CanvasRenderingContext2D | null {
    logger.canvas.operation('updateFoldedCanvasDimensions', folds);
    
    const { foldedCanvas, unfoldedCanvas } = context;
    
    const dimensions = getFoldedCanvasDimensions(unfoldedCanvas, folds);
    foldedCanvas.width = dimensions.width;
    foldedCanvas.height = dimensions.height;

    // Re-initialize context after canvas resize
    const newFoldedCtx = foldedCanvas.getContext("2d", {
      willReadFrequently: true,
    });

    if (newFoldedCtx) {
      newFoldedCtx.fillStyle = BACKGROUND_COLOR;
      newFoldedCtx.fillRect(0, 0, foldedCanvas.width, foldedCanvas.height);
    }

    return newFoldedCtx;
  }

  static isDiagonalFoldActive(folds: FoldState): boolean {
    return folds.diagonal.enabled && folds.diagonal.count === 1 && folds.vertical === folds.horizontal;
  }

  static traceDrawableRegionPath(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    folds: FoldState
  ): void {
    ctx.beginPath();

    if (!CanvasService.isDiagonalFoldActive(folds)) {
      ctx.rect(0, 0, canvas.width, canvas.height);
      return;
    }

    const width = canvas.width;
    const height = canvas.height;
    // Canvas clips antialias their diagonal edge. Extend the render-only clip
    // far enough to retain one fully covered unfolded-cell pixel after
    // downsampling, so the source and reflection meet without a background seam.
    const overlap = 2 * Math.pow(2, folds.vertical);

    if (folds.diagonal.direction === 'topRightToBottomLeft') {
      ctx.moveTo(width - overlap, 0);
      ctx.lineTo(width, 0);
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.lineTo(0, height - overlap);
    } else {
      ctx.moveTo(0, overlap);
      ctx.lineTo(0, 0);
      ctx.lineTo(width, 0);
      ctx.lineTo(width, height);
      ctx.lineTo(width - overlap, height);
    }

    ctx.closePath();
  }

  static clipToDrawableRegion(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    folds: FoldState
  ): void {
    CanvasService.traceDrawableRegionPath(ctx, canvas, folds);
    ctx.clip();
  }

  /**
   * Check if a point is in the valid drawing area based on diagonal fold
   */
  static isInValidDrawingArea(
    x: number, 
    y: number, 
    folds: FoldState, 
    _foldedCanvas: HTMLCanvasElement
  ): boolean {
    // Only apply restriction if diagonal fold is active (count is 1 and canvas is square)
    if (!CanvasService.isDiagonalFoldActive(folds)) {
      return true;
    }

    if (folds.diagonal.direction === 'topRightToBottomLeft') {
      return x + y > _foldedCanvas.width;
    }

    return y < x;
  }

  /**
   * Convert Pointer Event client coordinates to canvas backing-store coordinates
   */
  static getCanvasCoordinates(
    clientX: number, 
    clientY: number, 
    canvas: HTMLCanvasElement
  ): { x: number; y: number } {
    const { width, height, left, top } = canvas.getBoundingClientRect();
    const scaleFactorHorizontal = width / canvas.width;
    const scaleFactorVertical = height / canvas.height;

    return {
      x: (clientX - left) / scaleFactorHorizontal,
      y: (clientY - top) / scaleFactorVertical,
    };
  }

  /**
   * Download canvas as an image
   */
  static downloadCanvas(canvas: HTMLCanvasElement, filename?: string): void {
    logger.canvas.operation('downloadCanvas', { filename });
    
    try {
      const link = document.createElement("a");
      const dataUrl = canvas.toDataURL("image/png");
      link.href = dataUrl;
      link.download = filename || `shibori-design-${new Date().toISOString().slice(0, 10)}.png`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      logger.error("Error downloading canvas as image", error as Error);
    }
  }
}
