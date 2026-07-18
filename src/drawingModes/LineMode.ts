import {
  DrawingMode,
  DrawingModeResult,
  Point,
  DrawingModeContext,
} from "../types/DrawingMode";
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
  private startPoint: Point | null = null;
  private active = false;

  readonly id = DrawingTool.Line;

  lastPoint: Point | null = null;

  start(point: Point, context: DrawingModeContext): void {
    const {
      foldedCtx,
      getFoldedCanvasDimensions,
    } = context;

    // Store canvas states for preview
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
    const {
      getState,
      foldedCtx,
      foldedCanvas,
    } = context;

    const { config, folds, lineThickness } = getState();
    if (!this.active || !this.startPoint) return false;

    // Restore original states
    if (this.originalFoldedCanvasState) {
      foldedCtx.putImageData(this.originalFoldedCanvasState, 0, 0);
    }
    // Draw preview line
    foldedCtx.save();
    if (foldedCanvas) {
      CanvasService.clipToDrawableRegion(foldedCtx, foldedCanvas, folds);
    }
    foldedCtx.beginPath();
    foldedCtx.moveTo(this.startPoint.x, this.startPoint.y);
    foldedCtx.lineTo(point.x, point.y);
    foldedCtx.strokeStyle = config.lineColor;
    foldedCtx.lineWidth = lineThickness;
    foldedCtx.globalAlpha = 0.6;
    foldedCtx.stroke();
    foldedCtx.restore();

    this.lastPoint = point;
    return true;
  }

  end(
    point: Point | null,
    context: DrawingModeContext
  ): DrawingModeResult {
    const {
      getState,
      foldedCtx,
      foldedCanvas,
    } = context;

    const { config, folds, lineThickness } = getState();
    if (!this.active || !this.startPoint || !this.lastPoint) return { status: "discard" };

    if (point) {
      this.lastPoint = point;
    }

    // Draw final line
    foldedCtx.save();
    if (foldedCanvas) {
      CanvasService.clipToDrawableRegion(foldedCtx, foldedCanvas, folds);
    }
    foldedCtx.beginPath();
    foldedCtx.moveTo(this.startPoint.x, this.startPoint.y);
    foldedCtx.lineTo(this.lastPoint.x, this.lastPoint.y);
    foldedCtx.strokeStyle = config.lineColor;
    foldedCtx.lineWidth = lineThickness;
    foldedCtx.stroke();
    foldedCtx.restore();

    // Reset state
    const startPoint = this.startPoint;
    const lastPoint = this.lastPoint;
    this.active = false;
    this.startPoint = null;
    this.lastPoint = null;
    this.originalFoldedCanvasState = null;

    return {
      status: "commit",
      item: {
        action: this.id,
        points: [startPoint, lastPoint],
        style: {
          lineThickness,
          color: config.lineColor,
        },
      },
    };
  }

  cancel(context: DrawingModeContext): void {
    const { foldedCtx } = context;

    // Restore original states if they exist
    if (this.originalFoldedCanvasState && foldedCtx) {
      foldedCtx.putImageData(this.originalFoldedCanvasState, 0, 0);
    }

    this.active = false;
    this.startPoint = null;
    this.lastPoint = null;
    this.originalFoldedCanvasState = null;
  }
}
