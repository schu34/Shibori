import { DrawingTool, ShapeFillMode } from "../types";
import { DrawingModeGeometry, Point } from "../types/DrawingMode";
import {
  expandBounds,
  getRectBounds,
  isPointInBounds,
  isPointNearRectOutline,
  translatePoints,
} from "../utils/geometryMath";
import { DragShapeMode } from "./DragShapeMode";

export const RectangleGeometry: DrawingModeGeometry = {
  hitTest(item, point, options) {
    if (item.points.length < 2) return false;
    const bounds = getRectBounds(item.points[0], item.points[1]);
    const fillMode = item.shapeFillMode ?? ShapeFillMode.Filled;
    const tolerance = (options.lineThickness / 2) + (options.hitTolerance ?? 8);

    return fillMode === ShapeFillMode.Filled
      ? isPointInBounds(point, bounds)
      : isPointNearRectOutline(point, bounds, tolerance);
  },
  getBounds(item, options) {
    if (item.points.length < 2) return null;
    return expandBounds(getRectBounds(item.points[0], item.points[1]), options.lineThickness / 2);
  },
  translate(item, delta) {
    return {
      ...item,
      points: translatePoints(item.points, delta),
    };
  },
};

export class RectangleMode extends DragShapeMode {
  protected readonly tool = DrawingTool.Rectangle;

  protected drawShape(
    ctx: CanvasRenderingContext2D,
    startPoint: Point,
    endPoint: Point,
    fillMode: ShapeFillMode
  ): void {
    const width = endPoint.x - startPoint.x;
    const height = endPoint.y - startPoint.y;

    if (fillMode === ShapeFillMode.Filled) {
      ctx.fillRect(startPoint.x, startPoint.y, width, height);
      return;
    }

    ctx.strokeRect(startPoint.x, startPoint.y, width, height);
  }
}
