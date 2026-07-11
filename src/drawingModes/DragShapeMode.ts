import {
  DrawingMode,
  DrawingModeContext,
  DrawableDrawingTool,
  Point,
  UndoableHistoryItem,
} from "../types/DrawingMode";
import { ShapeFillMode } from "../types";
import { CanvasService } from "../services/CanvasService";

export abstract class DragShapeMode implements DrawingMode {
  private originalFoldedCanvasState: ImageData | null = null;
  private startPoint: Point | null = null;
  private lastPoint: Point | null = null;
  private active = false;

  protected abstract readonly tool: DrawableDrawingTool;

  protected abstract drawShape(
    ctx: CanvasRenderingContext2D,
    startPoint: Point,
    endPoint: Point,
    fillMode: ShapeFillMode
  ): void;

  start(point: Point, context: DrawingModeContext): void {
    const {
      foldedCtx,
      getFoldedCanvasDimensions,
    } = context;

    const foldedDimensions = getFoldedCanvasDimensions();
    if (foldedDimensions) {
      this.originalFoldedCanvasState = foldedCtx.getImageData(
        0,
        0,
        foldedDimensions.width,
        foldedDimensions.height
      );
    }

    this.startPoint = point;
    this.lastPoint = point;
    this.active = true;
  }

  continue(point: Point, context: DrawingModeContext): boolean {
    if (!this.active || !this.startPoint) return false;

    this.lastPoint = point;
    this.drawPreview(context, this.startPoint, point, 0.6);
    return true;
  }

  end(point: Point | null, context: DrawingModeContext): UndoableHistoryItem | null {
    const { getState } = context;
    const { lineThickness, config } = getState();

    if (!this.active || !this.startPoint) return null;

    const endPoint = point ?? this.lastPoint;
    if (!endPoint) return null;

    this.drawPreview(context, this.startPoint, endPoint, 1);

    const startPoint = this.startPoint;
    this.clearStoredCanvasState();

    return {
      action: this.tool,
      points: [startPoint, endPoint],
      shapeFillMode: this.getFillMode(context),
      style: {
        lineThickness,
        color: config.lineColor,
        shapeFillMode: this.getFillMode(context),
      },
    };
  }

  cancel(context: DrawingModeContext): void {
    const { foldedCtx } = context;

    if (this.originalFoldedCanvasState) {
      foldedCtx.putImageData(this.originalFoldedCanvasState, 0, 0);
    }

    this.clearStoredCanvasState();
  }

  private drawPreview(
    context: DrawingModeContext,
    startPoint: Point,
    endPoint: Point,
    alpha: number
  ): void {
    const { getState, foldedCtx, foldedCanvas, drawDiagonalFoldLinesOnFolded } = context;
    const { config, folds, lineThickness } = getState();

    if (this.originalFoldedCanvasState) {
      foldedCtx.putImageData(this.originalFoldedCanvasState, 0, 0);
    }

    foldedCtx.save();
    if (foldedCanvas) {
      CanvasService.clipToDrawableRegion(foldedCtx, foldedCanvas, folds);
    }
    foldedCtx.strokeStyle = config.lineColor;
    foldedCtx.lineWidth = lineThickness;
    foldedCtx.globalAlpha = alpha;
    foldedCtx.lineCap = "round";
    foldedCtx.lineJoin = "round";
    foldedCtx.fillStyle = config.lineColor;
    this.drawShape(foldedCtx, startPoint, endPoint, this.getFillMode(context));
    foldedCtx.restore();

    drawDiagonalFoldLinesOnFolded();
  }

  private getFillMode(context: DrawingModeContext): ShapeFillMode {
    return context.historyItem?.style?.shapeFillMode ??
      context.historyItem?.shapeFillMode ??
      context.getState().shapeFillMode;
  }

  private clearStoredCanvasState(): void {
    this.originalFoldedCanvasState = null;
    this.startPoint = null;
    this.lastPoint = null;
    this.active = false;
  }
}
