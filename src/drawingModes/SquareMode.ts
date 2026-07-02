import { DrawingTool, ShapeFillMode } from "../types";
import { Point } from "../types/DrawingMode";
import { DragShapeMode } from "./DragShapeMode";

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
