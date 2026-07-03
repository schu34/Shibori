import { DrawingTool, ShapeFillMode } from "../types";
import { DrawingModeGeometry, Point } from "../types/DrawingMode";
import {
  expandBounds,
  getRectBounds,
  getSquareEndPoint,
  isPointInBounds,
  isPointNearRectOutline,
  translatePoints,
} from "../utils/geometryMath";
import { DragShapeMode } from "./DragShapeMode";

export const SquareGeometry: DrawingModeGeometry = {
  hitTest(item, point, options) {
    if (item.points.length < 2) return false;
    const squareEnd = getSquareEndPoint(item.points[0], item.points[1]);
    const bounds = getRectBounds(item.points[0], squareEnd);
    const fillMode = item.shapeFillMode ?? ShapeFillMode.Filled;
    const tolerance = (options.lineThickness / 2) + (options.hitTolerance ?? 8);

    return fillMode === ShapeFillMode.Filled
      ? isPointInBounds(point, bounds)
      : isPointNearRectOutline(point, bounds, tolerance);
  },
  getBounds(item, options) {
    if (item.points.length < 2) return null;
    const squareEnd = getSquareEndPoint(item.points[0], item.points[1]);
    return expandBounds(getRectBounds(item.points[0], squareEnd), options.lineThickness / 2);
  },
  translate(item, delta) {
    return {
      ...item,
      points: translatePoints(item.points, delta),
    };
  },
};

export class SquareMode extends DragShapeMode {
  protected readonly tool = DrawingTool.Square;

  protected drawShape(
    ctx: CanvasRenderingContext2D,
    startPoint: Point,
    endPoint: Point,
    fillMode: ShapeFillMode
  ): void {
    const deltaX = endPoint.x - startPoint.x;
    const deltaY = endPoint.y - startPoint.y;
    const sideLength = Math.min(Math.abs(deltaX), Math.abs(deltaY));
    const width = Math.sign(deltaX || 1) * sideLength;
    const height = Math.sign(deltaY || 1) * sideLength;

    if (fillMode === ShapeFillMode.Filled) {
      ctx.fillRect(startPoint.x, startPoint.y, width, height);
      return;
    }

    ctx.strokeRect(startPoint.x, startPoint.y, width, height);
  }
}
