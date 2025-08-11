import { ImageUtils } from '../utils/imageUtils';
import { logger } from '../utils/logger';

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

function cachedLazy<T>(fn: () => T): () => T {
  let isCachePopulated = false;
  let returnValue: T | null = null;
  return () => {
    if (!isCachePopulated || returnValue === null) {
      returnValue = fn();
      isCachePopulated = true;
    }
    return returnValue;
  };
}

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

  /**
   * Draw fold lines on the unfolded canvas
   */
  static drawFoldLines(context: CanvasContext, folds: FoldState): void {
    logger.canvas.operation('drawFoldLines', folds);
    
    const { unfoldedCtx, unfoldedCanvas } = context;
    const width = unfoldedCanvas.width;
    const height = unfoldedCanvas.height;

    unfoldedCtx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    unfoldedCtx.lineWidth = 1;

    // Draw vertical fold lines
    for (let i = 1; i <= folds.vertical; i++) {
      const segments = Math.pow(2, i);
      for (let j = 1; j < segments; j++) {
        const x = (width / segments) * j;
        unfoldedCtx.beginPath();
        unfoldedCtx.moveTo(x, 0);
        unfoldedCtx.lineTo(x, height);
        unfoldedCtx.stroke();
      }
    }

    // Draw horizontal fold lines
    for (let i = 1; i <= folds.horizontal; i++) {
      const segments = Math.pow(2, i);
      for (let j = 1; j < segments; j++) {
        const y = (height / segments) * j;
        unfoldedCtx.beginPath();
        unfoldedCtx.moveTo(0, y);
        unfoldedCtx.lineTo(width, y);
        unfoldedCtx.stroke();
      }
    }
  }

  /**
   * Update folded canvas dimensions based on fold state
   */
  static updateFoldedCanvasDimensions(context: CanvasContext, folds: FoldState): CanvasRenderingContext2D | null {
    logger.canvas.operation('updateFoldedCanvasDimensions', folds);
    
    const { foldedCanvas, unfoldedCanvas } = context;
    
    const foldedWidth = unfoldedCanvas.width / Math.pow(2, folds.vertical);
    const foldedHeight = unfoldedCanvas.height / Math.pow(2, folds.horizontal);

    foldedCanvas.width = foldedWidth;
    foldedCanvas.height = foldedHeight;

    // Re-initialize context after canvas resize
    const newFoldedCtx = foldedCanvas.getContext("2d", {
      willReadFrequently: true,
    });

    if (newFoldedCtx) {
      newFoldedCtx.fillStyle = BACKGROUND_COLOR;
      newFoldedCtx.fillRect(0, 0, foldedWidth, foldedHeight);
    }

    return newFoldedCtx;
  }

  /**
   * Draw diagonal fold lines on the folded canvas
   */
  static drawDiagonalFoldLinesOnFolded(context: CanvasContext, folds: FoldState): void {
    // Only draw if diagonal folds are exactly one fold, and canvas is square
    if (folds.diagonal.count !== 1 || folds.vertical !== folds.horizontal) {
      return;
    }

    logger.canvas.operation('drawDiagonalFoldLinesOnFolded');
    
    const { foldedCtx, foldedCanvas } = context;
    const width = foldedCanvas.width;
    const height = foldedCanvas.height;

    foldedCtx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    foldedCtx.lineWidth = 1;
    foldedCtx.setLineDash([5, 3]); // Make diagonal lines dashed

    // Draw the diagonal fold line (top-left to bottom-right)
    foldedCtx.beginPath();
    foldedCtx.moveTo(0, 0);
    foldedCtx.lineTo(width, height);
    foldedCtx.stroke();
    foldedCtx.setLineDash([]); // Reset line style

    // Add indicators at each end
    foldedCtx.fillStyle = "rgba(255, 255, 255, 0.9)";
    foldedCtx.beginPath();
    foldedCtx.arc(0, 0, 3, 0, Math.PI * 2);
    foldedCtx.fill();

    foldedCtx.beginPath();
    foldedCtx.arc(width, height, 3, 0, Math.PI * 2);
    foldedCtx.fill();
  }

  /**
   * Update the unfolded canvas by mirroring the folded canvas
   */
  static updateUnfoldedCanvas(context: CanvasContext, folds: FoldState): void {
    logger.canvas.render('updateUnfoldedCanvas started');
    
    const { foldedCtx, unfoldedCtx, foldedCanvas, unfoldedCanvas } = context;

    // Clear the unfolded canvas and apply navy background
    unfoldedCtx.clearRect(0, 0, unfoldedCanvas.width, unfoldedCanvas.height);
    unfoldedCtx.fillStyle = BACKGROUND_COLOR;
    unfoldedCtx.fillRect(0, 0, unfoldedCanvas.width, unfoldedCanvas.height);

    // Get the original image data from the folded canvas
    const originalImage = foldedCtx.getImageData(
      0, 0, foldedCanvas.width, foldedCanvas.height
    );

    // Create the other pattern variations we'll need based on horizontal and vertical folds
    const getOriginal = cachedLazy(() => {
      if (folds.diagonal.count === 1) {
        return ImageUtils.mirrorDiagonalTopLeftToBottomRight(originalImage);
      }
      return originalImage;
    });
    
    const getHorizontalFlipped = cachedLazy(() =>
      ImageUtils.flipHorizontal(getOriginal())
    );
    
    const getVerticalFlipped = cachedLazy(() =>
      ImageUtils.flipVertical(getOriginal())
    );
    
    const getBothFlipped = cachedLazy(() =>
      ImageUtils.flipVertical(getHorizontalFlipped())
    );

    // Calculate the total grid size based on folds
    const gridWidth = Math.pow(2, folds.vertical);
    const gridHeight = Math.pow(2, folds.horizontal);

    // Determine each cell's dimensions
    const cellWidth = originalImage.width;
    const cellHeight = originalImage.height;

    // For each cell in the grid, determine which pattern to use
    for (let row = 0; row < gridHeight; row++) {
      for (let col = 0; col < gridWidth; col++) {
        let patternToUse: ImageData;

        const isRowEven = row % 2 === 0;
        const isColEven = col % 2 === 0;

        if (isRowEven && isColEven) {
          patternToUse = getOriginal();
        } else if (isRowEven && !isColEven) {
          patternToUse = getHorizontalFlipped();
        } else if (!isRowEven && isColEven) {
          patternToUse = getVerticalFlipped();
        } else {
          patternToUse = getBothFlipped();
        }

        // Calculate the position to place this pattern
        const x = col * cellWidth;
        const y = row * cellHeight;

        // Draw the pattern at this position
        unfoldedCtx.putImageData(patternToUse, x, y);
      }
    }

    // Draw fold lines
    CanvasService.drawFoldLines(context, folds);
    
    logger.canvas.render('updateUnfoldedCanvas completed');
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
    if (folds.diagonal.count !== 1 || folds.vertical !== folds.horizontal) {
      return true;
    }

    return y < x;
  }

  /**
   * Get canvas coordinates from mouse/touch event
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
   * Reset canvases - clear them and redraw fold lines
   */
  static resetCanvases(context: CanvasContext, folds: FoldState): void {
    logger.canvas.operation('resetCanvases');
    
    // Update folded canvas dimensions
    CanvasService.updateFoldedCanvasDimensions(context, folds);

    // Clear the canvases with navy background
    CanvasService.clearCanvases(context);

    // Draw the fold lines
    CanvasService.drawFoldLines(context, folds);

    // Draw diagonal fold lines on the folded canvas
    CanvasService.drawDiagonalFoldLinesOnFolded(context, folds);
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