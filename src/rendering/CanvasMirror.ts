import { CanvasService } from '../services/CanvasService';
import type { CanvasContext, FoldState } from '../services/CanvasService';

const BACKGROUND_COLOR = 'navy';

/**
 * Render the unfolded pattern with Canvas 2D transforms.
 *
 * The folded canvas is downsampled once. Diagonal symmetry is composed with a
 * clipped drawImage transform, then the completed cell is tiled with
 * alternating horizontal and vertical transforms. This is the sole production
 * unfolded renderer.
 */
export function renderUnfoldedCanvas(
  context: CanvasContext,
  folds: FoldState
): void {
  const { foldedCanvas, unfoldedCanvas, unfoldedCtx } = context;
  const gridWidth = Math.pow(2, folds.vertical);
  const gridHeight = Math.pow(2, folds.horizontal);
  const cellWidth = Math.max(1, Math.floor(unfoldedCanvas.width / gridWidth));
  const cellHeight = Math.max(1, Math.floor(unfoldedCanvas.height / gridHeight));

  unfoldedCtx.save();
  unfoldedCtx.setTransform(1, 0, 0, 1, 0, 0);
  unfoldedCtx.clearRect(0, 0, unfoldedCanvas.width, unfoldedCanvas.height);
  unfoldedCtx.fillStyle = BACKGROUND_COLOR;
  unfoldedCtx.fillRect(0, 0, unfoldedCanvas.width, unfoldedCanvas.height);

  const sourceCell = createCanvas(cellWidth, cellHeight);
  const sourceCtx = get2DContext(sourceCell);
  sourceCtx.imageSmoothingEnabled = true;
  sourceCtx.imageSmoothingQuality = 'high';
  sourceCtx.drawImage(
    foldedCanvas,
    0,
    0,
    foldedCanvas.width,
    foldedCanvas.height,
    0,
    0,
    cellWidth,
    cellHeight
  );

  const workingCell = CanvasService.isDiagonalFoldActive(folds)
    ? createDiagonalCell(sourceCell, folds)
    : sourceCell;

  for (let row = 0; row < gridHeight; row++) {
    for (let col = 0; col < gridWidth; col++) {
      drawMirroredCell(
        unfoldedCtx,
        workingCell,
        col * cellWidth,
        row * cellHeight,
        cellWidth,
        cellHeight,
        col % 2 === 1,
        row % 2 === 1
      );
    }
  }

  unfoldedCtx.restore();
}

function createDiagonalCell(
  sourceCell: HTMLCanvasElement,
  folds: FoldState
): HTMLCanvasElement {
  const { width, height } = sourceCell;
  const result = createCanvas(width, height);
  const ctx = get2DContext(result);

  ctx.drawImage(sourceCell, 0, 0);
  ctx.save();
  ctx.beginPath();

  if (folds.diagonal.direction === 'topRightToBottomLeft') {
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.clip();
    ctx.setTransform(0, -1, -1, 0, width, height);
  } else {
    ctx.moveTo(0, 0);
    ctx.lineTo(0, height);
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.clip();
    ctx.setTransform(0, 1, 1, 0, 0, 0);
  }

  ctx.drawImage(sourceCell, 0, 0);
  ctx.restore();
  return result;
}

function drawMirroredCell(
  targetCtx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
  flipX: boolean,
  flipY: boolean
): void {
  targetCtx.save();
  targetCtx.setTransform(
    flipX ? -1 : 1,
    0,
    0,
    flipY ? -1 : 1,
    flipX ? x + width : x,
    flipY ? y + height : y
  );
  targetCtx.drawImage(source, 0, 0, width, height);
  targetCtx.restore();
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function get2DContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is unavailable');
  return context;
}
