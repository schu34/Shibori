import { DrawingTool, ShapeFillMode } from "../types";
import { Point } from "../types/DrawingMode";
import { DragShapeMode } from "./DragShapeMode";

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
