import { getStroke } from "perfect-freehand";
import { CanvasService } from "../services/CanvasService";
import { AppConfig, DrawingTool, FoldState, ShapeFillMode } from "../types";
import { DrawableHistoryItem } from "./historyOperations";
import { getBoundsCenter, getRectBounds, getSquareEndPoint } from "./geometryMath";

export interface HistoryRenderOptions {
  config: AppConfig;
  folds: FoldState;
  lineThickness: number;
  shapeFillMode: ShapeFillMode;
}

export function clearFoldedCanvas(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement
): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "navy";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

export function renderDrawableHistoryItem(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  item: DrawableHistoryItem,
  options: HistoryRenderOptions
): void {
  ctx.save();
  CanvasService.clipToDrawableRegion(ctx, canvas, options.folds);

  switch (item.action) {
    case DrawingTool.Paintbrush:
      renderPaintbrush(ctx, item, options);
      break;
    case DrawingTool.Line:
      renderLine(ctx, item, options);
      break;
    case DrawingTool.Rectangle:
      renderRectangle(ctx, item, options);
      break;
    case DrawingTool.Square:
      renderSquare(ctx, item, options);
      break;
    case DrawingTool.Circle:
      renderCircle(ctx, item, options);
      break;
  }

  ctx.restore();
}

export function renderDrawableHistoryItems(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  items: DrawableHistoryItem[],
  options: HistoryRenderOptions
): void {
  for (const item of items) {
    renderDrawableHistoryItem(ctx, canvas, item, options);
  }
}

function renderPaintbrush(
  ctx: CanvasRenderingContext2D,
  item: DrawableHistoryItem,
  options: HistoryRenderOptions
): void {
  if (item.points.length === 0) return;

  const stroke = getStroke(item.points, {
    size: options.lineThickness * 2,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
  });

  if (!stroke.length) return;

  ctx.fillStyle = options.config.lineColor;
  ctx.beginPath();
  const [firstX, firstY] = stroke[0];
  ctx.moveTo(firstX, firstY);

  for (let i = 1; i < stroke.length; i++) {
    const [x, y] = stroke[i];
    ctx.lineTo(x, y);
  }

  ctx.closePath();
  ctx.fill();
}

function renderLine(
  ctx: CanvasRenderingContext2D,
  item: DrawableHistoryItem,
  options: HistoryRenderOptions
): void {
  if (item.points.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(item.points[0].x, item.points[0].y);
  ctx.lineTo(item.points[1].x, item.points[1].y);
  ctx.strokeStyle = options.config.lineColor;
  ctx.lineWidth = options.lineThickness;
  ctx.stroke();
}

function renderRectangle(
  ctx: CanvasRenderingContext2D,
  item: DrawableHistoryItem,
  options: HistoryRenderOptions
): void {
  if (item.points.length < 2) return;

  const width = item.points[1].x - item.points[0].x;
  const height = item.points[1].y - item.points[0].y;
  renderRectLikeShape(ctx, item, options, width, height);
}

function renderSquare(
  ctx: CanvasRenderingContext2D,
  item: DrawableHistoryItem,
  options: HistoryRenderOptions
): void {
  if (item.points.length < 2) return;

  const squareEnd = getSquareEndPoint(item.points[0], item.points[1]);
  const width = squareEnd.x - item.points[0].x;
  const height = squareEnd.y - item.points[0].y;
  renderRectLikeShape(ctx, item, options, width, height);
}

function renderRectLikeShape(
  ctx: CanvasRenderingContext2D,
  item: DrawableHistoryItem,
  options: HistoryRenderOptions,
  width: number,
  height: number
): void {
  const fillMode = item.shapeFillMode ?? options.shapeFillMode;

  ctx.save();
  if (item.rotation) {
    const bounds = getRectBounds(
      item.points[0],
      {
        x: item.points[0].x + width,
        y: item.points[0].y + height,
      }
    );
    const center = item.rotationCenter ?? getBoundsCenter(bounds);
    ctx.translate(center.x, center.y);
    ctx.rotate(item.rotation);
    ctx.translate(-center.x, -center.y);
  }

  ctx.strokeStyle = options.config.lineColor;
  ctx.lineWidth = options.lineThickness;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.fillStyle = options.config.lineColor;

  if (fillMode === ShapeFillMode.Filled) {
    ctx.fillRect(item.points[0].x, item.points[0].y, width, height);
    ctx.restore();
    return;
  }

  ctx.strokeRect(item.points[0].x, item.points[0].y, width, height);
  ctx.restore();
}

function renderCircle(
  ctx: CanvasRenderingContext2D,
  item: DrawableHistoryItem,
  options: HistoryRenderOptions
): void {
  if (item.points.length < 2) return;

  const radius = Math.hypot(
    item.points[1].x - item.points[0].x,
    item.points[1].y - item.points[0].y
  );
  if (radius <= 0) return;

  const fillMode = item.shapeFillMode ?? options.shapeFillMode;
  ctx.strokeStyle = options.config.lineColor;
  ctx.lineWidth = options.lineThickness;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.fillStyle = options.config.lineColor;
  ctx.beginPath();
  ctx.arc(item.points[0].x, item.points[0].y, radius, 0, Math.PI * 2);

  if (fillMode === ShapeFillMode.Filled) {
    ctx.fill();
    return;
  }

  ctx.stroke();
}
