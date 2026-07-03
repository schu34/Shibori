import { DrawingTool, ShapeFillMode } from "../types";
import { DrawingModeGeometry, Point } from "../types/DrawingMode";
import {
  expandBounds,
  getRectBounds,
  getBoundsCenter,
  isPointInBounds,
  isPointNearRectOutline,
  rotateBounds,
  rotatePoint,
  translatePoint,
  translatePoints,
} from "../utils/geometryMath";
import { DragShapeMode } from "./DragShapeMode";

export const RectangleGeometry: DrawingModeGeometry = {
  hitTest(item, point, options) {
    if (item.points.length < 2) return false;
    const bounds = getRectBounds(item.points[0], item.points[1]);
    const localPoint = item.rotation
      ? rotatePoint(point, item.rotationCenter ?? getBoundsCenter(bounds), -item.rotation)
      : point;
    const fillMode = item.shapeFillMode ?? ShapeFillMode.Filled;
    const tolerance = (options.lineThickness / 2) + (options.hitTolerance ?? 8);

    return fillMode === ShapeFillMode.Filled
      ? isPointInBounds(localPoint, bounds)
      : isPointNearRectOutline(localPoint, bounds, tolerance);
  },
  getBounds(item, options) {
    if (item.points.length < 2) return null;
    const bounds = getRectBounds(item.points[0], item.points[1]);
    const rotatedBounds = item.rotation
      ? rotateBounds(bounds, item.rotationCenter ?? getBoundsCenter(bounds), item.rotation)
      : bounds;
    return expandBounds(rotatedBounds, options.lineThickness / 2);
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
