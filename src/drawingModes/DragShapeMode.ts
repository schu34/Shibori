import {
  DrawingMode,
  DrawingModeContext,
  DrawableDrawingTool,
  Point,
  UndoableHistoryItem,
} from "../types/DrawingMode";
import { ActionType } from "../store/shiboriCanvasState";
import { ShapeFillMode } from "../types";
import { CanvasService } from "../services/CanvasService";

export abstract class DragShapeMode implements DrawingMode {
  private originalFoldedCanvasState: ImageData | null = null;
  private originalUnfoldedCanvasState: ImageData | null = null;
  private lastPoint: Point | null = null;

  protected abstract readonly tool: DrawableDrawingTool;

  protected abstract drawShape(
    ctx: CanvasRenderingContext2D,
    startPoint: Point,
    endPoint: Point,
    fillMode: ShapeFillMode
  ): void;

  start(point: Point, context: DrawingModeContext): void {
    const {
      dispatch,
      foldedCtx,
      unfoldedCtx,
      getFoldedCanvasDimensions,
      getUnfoldedCanvasDimensions,
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

    const unfoldedDimensions = getUnfoldedCanvasDimensions();
    if (unfoldedDimensions) {
      this.originalUnfoldedCanvasState = unfoldedCtx.getImageData(
        0,
        0,
        unfoldedDimensions.width,
        unfoldedDimensions.height
      );
    }

    this.lastPoint = point;
    dispatch({ type: ActionType.SET_LINE_START_POINT, payload: point });
    dispatch({ type: ActionType.SET_IS_DRAWING, payload: true });
  }

  continue(point: Point, context: DrawingModeContext): boolean {
    const { getState } = context;
    const { isDrawing, lineStartPoint } = getState();

    if (!isDrawing || !lineStartPoint) return false;

    this.lastPoint = point;
    this.drawPreview(context, lineStartPoint, point, 0.6);
    return true;
  }

  end(point: Point | null, context: DrawingModeContext): UndoableHistoryItem | null {
    const { getState, dispatch } = context;
    const { isDrawing, lineStartPoint, lineThickness, config } = getState();

    if (!isDrawing || !lineStartPoint) return null;

    const endPoint = point ?? this.lastPoint;
    if (!endPoint) return null;

    this.drawPreview(context, lineStartPoint, endPoint, 1);

    dispatch({ type: ActionType.SET_IS_DRAWING, payload: false });
    dispatch({ type: ActionType.SET_LINE_START_POINT, payload: null });
    this.clearStoredCanvasState();

    return {
      action: this.tool,
      points: [lineStartPoint, endPoint],
      shapeFillMode: this.getFillMode(context),
      style: {
        lineThickness,
        color: config.lineColor,
        shapeFillMode: this.getFillMode(context),
      },
    };
  }

  cancel(context: DrawingModeContext): void {
    const { dispatch, foldedCtx, unfoldedCtx } = context;

    if (this.originalFoldedCanvasState) {
      foldedCtx.putImageData(this.originalFoldedCanvasState, 0, 0);
    }

    if (this.originalUnfoldedCanvasState) {
      unfoldedCtx.putImageData(this.originalUnfoldedCanvasState, 0, 0);
    }

    dispatch({ type: ActionType.SET_IS_DRAWING, payload: false });
    dispatch({ type: ActionType.SET_LINE_START_POINT, payload: null });
    this.clearStoredCanvasState();
  }

  private drawPreview(
    context: DrawingModeContext,
    startPoint: Point,
    endPoint: Point,
    alpha: number
  ): void {
    const { getState, foldedCtx, unfoldedCtx, foldedCanvas, drawDiagonalFoldLinesOnFolded } = context;
    const { config, folds, lineThickness } = getState();

    if (this.originalFoldedCanvasState) {
      foldedCtx.putImageData(this.originalFoldedCanvasState, 0, 0);
    }

    if (this.originalUnfoldedCanvasState) {
      unfoldedCtx.putImageData(this.originalUnfoldedCanvasState, 0, 0);
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
    this.originalUnfoldedCanvasState = null;
    this.lastPoint = null;
  }
}
