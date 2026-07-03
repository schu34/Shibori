import {
  DrawingMode,
  Point,
  DrawingModeContext,
  UndoableHistoryItem,
} from "../types/DrawingMode";
import { ActionType } from "../store/shiboriCanvasState";
import { DrawingTool } from "../types";
import { CanvasService } from "../services/CanvasService";
import { DrawingModeGeometry } from "../types/DrawingMode";
import {
  distanceToSegment,
  expandBounds,
  getBoundsFromPoints,
  translatePoint,
  translatePoints,
} from "../utils/geometryMath";

export const LineGeometry: DrawingModeGeometry = {
  hitTest(item, point, options) {
    if (item.points.length < 2) return false;
    const tolerance = (options.lineThickness / 2) + (options.hitTolerance ?? 8);
    return distanceToSegment(point, item.points[0], item.points[1]) <= tolerance;
  },
  getBounds(item, options) {
    const bounds = getBoundsFromPoints(item.points);
    return bounds ? expandBounds(bounds, options.lineThickness / 2) : null;
  },
  translate(item, delta) {
    return {
      ...item,
      points: translatePoints(item.points, delta),
      rotationCenter: item.rotationCenter
        ? translatePoint(item.rotationCenter, delta)
        : undefined,
    };
  },
};

export class LineMode implements DrawingMode {
  private originalFoldedCanvasState: ImageData | null = null;
  private originalUnfoldedCanvasState: ImageData | null = null;

  readonly id = DrawingTool.Line;

  lastPoint: Point | null = null;

  start(point: Point, context: DrawingModeContext): void {
    const {
      dispatch,
      foldedCtx,
      unfoldedCtx,
      getFoldedCanvasDimensions,
      getUnfoldedCanvasDimensions,
    } = context;

    // Store canvas states for preview
    const foldedDimensions = getFoldedCanvasDimensions();
    const unfoldedDimensions = getUnfoldedCanvasDimensions();

    if (foldedDimensions) {
      this.originalFoldedCanvasState = foldedCtx.getImageData(
        0,
        0,
        foldedDimensions.width,
        foldedDimensions.height
      );
    }

    if (unfoldedDimensions) {
      this.originalUnfoldedCanvasState = unfoldedCtx.getImageData(
        0,
        0,
        unfoldedDimensions.width,
        unfoldedDimensions.height
      );
    }

    dispatch({ type: ActionType.SET_LINE_START_POINT, payload: point });
    dispatch({ type: ActionType.SET_IS_DRAWING, payload: true });
  }

  continue(point: Point, context: DrawingModeContext): boolean {
    const {
      getState,
      foldedCtx,
      unfoldedCtx,
      drawDiagonalFoldLinesOnFolded,
      foldedCanvas,
    } = context;

    const { isDrawing, lineStartPoint, config, folds, lineThickness } = getState();
    if (!isDrawing || !lineStartPoint) return false;

    // Restore original states
    if (this.originalFoldedCanvasState) {
      foldedCtx.putImageData(this.originalFoldedCanvasState, 0, 0);
    }
    if (this.originalUnfoldedCanvasState) {
      unfoldedCtx.putImageData(this.originalUnfoldedCanvasState, 0, 0);
    }

    // Draw preview line
    foldedCtx.save();
    if (foldedCanvas) {
      CanvasService.clipToDrawableRegion(foldedCtx, foldedCanvas, folds);
    }
    foldedCtx.beginPath();
    foldedCtx.moveTo(lineStartPoint.x, lineStartPoint.y);
    foldedCtx.lineTo(point.x, point.y);
    foldedCtx.strokeStyle = config.lineColor;
    foldedCtx.lineWidth = lineThickness;
    foldedCtx.globalAlpha = 0.6;
    foldedCtx.stroke();
    foldedCtx.restore();

    drawDiagonalFoldLinesOnFolded();
    this.lastPoint = point;
    return true;
  }

  end(
    point: Point | null,
    context: DrawingModeContext
  ): UndoableHistoryItem | null {
    const {
      getState,
      dispatch,
      foldedCtx,
      foldedCanvas,
      drawDiagonalFoldLinesOnFolded,
    } = context;

    const { isDrawing, lineStartPoint, config, folds, lineThickness } = getState();
    if (!isDrawing || !lineStartPoint || !this.lastPoint) return null;

    if (point) {
      this.lastPoint = point;
    }

    // Draw final line
    foldedCtx.save();
    if (foldedCanvas) {
      CanvasService.clipToDrawableRegion(foldedCtx, foldedCanvas, folds);
    }
    foldedCtx.beginPath();
    foldedCtx.moveTo(lineStartPoint.x, lineStartPoint.y);
    foldedCtx.lineTo(this.lastPoint.x, this.lastPoint.y);
    foldedCtx.strokeStyle = config.lineColor;
    foldedCtx.lineWidth = lineThickness;
    foldedCtx.stroke();
    foldedCtx.restore();

    drawDiagonalFoldLinesOnFolded();

    // Reset state
    dispatch({ type: ActionType.SET_IS_DRAWING, payload: false });
    dispatch({ type: ActionType.SET_LINE_START_POINT, payload: null });
    this.originalFoldedCanvasState = null;
    this.originalUnfoldedCanvasState = null;

    return {
      action: this.id,
      points: [lineStartPoint, this.lastPoint],
    };
  }

  cancel(context: DrawingModeContext): void {
    const { dispatch, foldedCtx, unfoldedCtx } = context;

    // Restore original states if they exist
    if (this.originalFoldedCanvasState && foldedCtx) {
      foldedCtx.putImageData(this.originalFoldedCanvasState, 0, 0);
    }

    if (this.originalUnfoldedCanvasState && unfoldedCtx) {
      unfoldedCtx.putImageData(this.originalUnfoldedCanvasState, 0, 0);
    }

    // Reset state
    dispatch({ type: ActionType.SET_IS_DRAWING, payload: false });
    dispatch({ type: ActionType.SET_LINE_START_POINT, payload: null });
    this.originalFoldedCanvasState = null;
    this.originalUnfoldedCanvasState = null;
  }
}
