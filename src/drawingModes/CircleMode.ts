import { DrawingTool, ShapeFillMode } from "../types";
import { DrawingModeGeometry, Point } from "../types/DrawingMode";
import {
  expandBounds,
  getRectBounds,
  isPointInCircle,
  isPointNearCircleOutline,
  translatePoint,
  translatePoints,
} from "../utils/geometryMath";
import { DragShapeMode } from "./DragShapeMode";

export const CircleGeometry: DrawingModeGeometry = {
  hitTest(item, point, options) {
    if (item.points.length < 2) return false;
    const radius = Math.hypot(item.points[1].x - item.points[0].x, item.points[1].y - item.points[0].y);
    const fillMode = item.shapeFillMode ?? ShapeFillMode.Filled;
    const tolerance = (options.lineThickness / 2) + (options.hitTolerance ?? 8);

    return fillMode === ShapeFillMode.Filled
      ? isPointInCircle(point, item.points[0], radius)
      : isPointNearCircleOutline(point, item.points[0], radius, tolerance);
  },
  getBounds(item, options) {
    if (item.points.length < 2) return null;
    const radius = Math.hypot(item.points[1].x - item.points[0].x, item.points[1].y - item.points[0].y);
    const bounds = getRectBounds(
      { x: item.points[0].x - radius, y: item.points[0].y - radius },
      { x: item.points[0].x + radius, y: item.points[0].y + radius }
    );
    return expandBounds(bounds, options.lineThickness / 2);
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

export class CircleMode extends DragShapeMode {
  protected readonly tool = DrawingTool.Circle;

  protected drawShape(
    ctx: CanvasRenderingContext2D,
    startPoint: Point,
    endPoint: Point,
    fillMode: ShapeFillMode
  ): void {
    const radius = Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y);

    if (radius <= 0) return;

    ctx.beginPath();
    ctx.arc(startPoint.x, startPoint.y, radius, 0, Math.PI * 2);

    if (fillMode === ShapeFillMode.Filled) {
      ctx.fill();
      return;
    }

    ctx.stroke();
  }
}
