import { CanvasService } from '../services/CanvasService';
import { DrawingTool, HistoryAction, ShapeFillMode } from '../types';
import {
  BezierPath,
  BezierPathHistoryItem,
  DrawingMode,
  DrawingModeContext,
  DrawingModeGeometry,
  DrawingModeResult,
  Point,
} from '../types/DrawingMode';
import {
  cloneBezierPath,
  createAnchor,
  findNearestBezierLocation,
  flattenBezierSegment,
  getBezierPathBounds,
  getBezierSegments,
  legacyPointsToPath,
  traceBezierPath,
  translateBezierPath,
} from '../utils/bezierPath';
import { distanceToPolyline, expandBounds } from '../utils/geometryMath';

const CLOSE_TOLERANCE = 16;

function pathForItem(item: Parameters<DrawingModeGeometry['hitTest']>[0]): BezierPath | null {
  if (item.action !== DrawingTool.Bezier) return null;
  return item.path ?? legacyPointsToPath(item.points, item.id ?? 'bezier');
}

export const BezierGeometry: DrawingModeGeometry = {
  hitTest(item, point, options) {
    const path = pathForItem(item);
    if (!path) return false;
    const tolerance = (options.lineThickness / 2) + (options.hitTolerance ?? 8);
    if (path.closed && getFillMode(item) === ShapeFillMode.Filled && isPointInBezierPath(path, point)) {
      return true;
    }
    return getBezierSegments(path).some((segment) =>
      distanceToPolyline(point, flattenBezierSegment(segment.points, 64)) <= tolerance
    );
  },
  getBounds(item, options) {
    const path = pathForItem(item);
    const bounds = path ? getBezierPathBounds(path) : null;
    return bounds ? expandBounds(bounds, options.lineThickness / 2) : null;
  },
  translate(item, delta) {
    if (item.action !== DrawingTool.Bezier) return item;
    const path = pathForItem(item);
    if (!path) return item;
    return { ...item, points: [], path: translateBezierPath(path, delta) } as BezierPathHistoryItem;
  },
};

type Stage = 'idle' | 'active' | 'awaiting';

export class BezierMode implements DrawingMode {
  private stage: Stage = 'idle';
  private originalFoldedCanvasState: ImageData | null = null;
  private path: BezierPath = { anchors: [], closed: false };
  private activeAnchorId: string | null = null;
  private activeHandle: Point | null = null;
  private closing = false;
  private previewDrawn = false;
  private nextAnchorNumber = 1;
  private updateItemId: string | null = null;
  private originalPath: BezierPath | null = null;
  private resuming = false;

  resumePath(
    itemId: string,
    path: BezierPath,
    fromStart: boolean,
    point: Point,
    context: DrawingModeContext
  ): void {
    const dimensions = context.getFoldedCanvasDimensions();
    if (dimensions) {
      this.originalFoldedCanvasState = context.foldedCtx.getImageData(0, 0, dimensions.width, dimensions.height);
    }
    this.originalPath = cloneBezierPath(path);
    this.path = fromStart ? reverseBezierPath(path) : cloneBezierPath(path);
    this.updateItemId = itemId;
    const endpoint = this.path.anchors[this.path.anchors.length - 1];
    this.activeAnchorId = endpoint.id;
    this.activeHandle = point;
    this.resuming = true;
    this.stage = 'active';
    this.updateGuidance(context);
  }

  start(point: Point, context: DrawingModeContext): void {
    if (this.stage === 'idle') {
      const dimensions = context.getFoldedCanvasDimensions();
      if (dimensions) {
        this.originalFoldedCanvasState = context.foldedCtx.getImageData(0, 0, dimensions.width, dimensions.height);
      }
      this.path = { anchors: [], closed: false };
    }

    if (this.stage !== 'idle' && this.stage !== 'awaiting') return;
    const first = this.path.anchors[0];
    if (first && this.path.anchors.length >= 3 && pointDistance(first.point, point) <= CLOSE_TOLERANCE) {
      this.closing = true;
      this.activeAnchorId = first.id;
      this.activeHandle = first.inHandle ?? first.point;
      this.stage = 'active';
      this.updateGuidance(context);
      return;
    }

    const anchor = createAnchor(this.createAnchorId(), point);
    this.path.anchors.push(anchor);
    this.activeAnchorId = anchor.id;
    this.activeHandle = point;
    this.stage = 'active';
    this.drawPreview(context, this.path, 0.6);
    this.updateGuidance(context);
  }

  continue(point: Point, context: DrawingModeContext): boolean {
    if (this.stage !== 'active' || !this.activeAnchorId) return false;
    const anchor = this.path.anchors.find((candidate) => candidate.id === this.activeAnchorId);
    if (!anchor) return false;
    this.activeHandle = point;
    const moved = pointDistance(anchor.point, point) > 0.5;
    if (this.closing) {
      anchor.inHandle = moved ? { ...point } : anchor.inHandle;
    } else if (this.resuming) {
      anchor.outHandle = moved ? { ...point } : anchor.outHandle;
      anchor.kind = 'corner';
    } else if (this.path.anchors.length === 1) {
      anchor.outHandle = moved ? { ...point } : null;
      anchor.inHandle = moved ? reflectPoint(point, anchor.point) : null;
    } else {
      anchor.outHandle = moved ? { ...point } : null;
      anchor.inHandle = moved ? reflectPoint(point, anchor.point) : null;
    }
    anchor.kind = moved ? 'smooth' : 'corner';
    this.drawPreview(context, this.path, 0.6);
    this.updateGuidance(context);
    return true;
  }

  end(point: Point | null, context: DrawingModeContext): DrawingModeResult {
    if (this.stage !== 'active') return { status: 'discard' };
    if (point) this.continue(point, context);
    if (this.closing) {
      this.path.closed = true;
      return this.commit(context);
    }
    this.resuming = false;
    this.stage = 'awaiting';
    this.activeAnchorId = null;
    this.activeHandle = null;
    this.drawPreview(context, this.path, 0.6);
    this.updateGuidance(context);
    return { status: 'continue' };
  }

  hover(point: Point, context: DrawingModeContext): boolean {
    if (this.stage !== 'awaiting' || this.path.anchors.length === 0) return false;
    const preview = cloneBezierPath(this.path);
    preview.anchors.push(createAnchor('hover', point));
    this.drawPreview(context, preview, 0.6);
    this.updateGuidance(context, point);
    return true;
  }

  finish(context: DrawingModeContext): DrawingModeResult {
    if (this.path.anchors.length < 2) {
      this.reset(context, true);
      return { status: 'discard' };
    }
    return this.commit(context);
  }

  cancel(context: DrawingModeContext): void {
    this.reset(context, true);
  }

  private commit(context: DrawingModeContext): DrawingModeResult {
    const { lineThickness, config, shapeFillMode } = context.getState();
    const path = cloneBezierPath(this.path);
    const updateItemId = this.updateItemId;
    const originalPath = this.originalPath ? cloneBezierPath(this.originalPath) : null;
    this.drawPreview(context, path, 1);
    this.reset(context, false);
    if (updateItemId && originalPath) {
      return {
        status: 'commit',
        item: {
          action: HistoryAction.UpdatePath,
          points: [],
          itemId: updateItemId,
          fromPath: originalPath,
          toPath: path,
        },
      };
    }
    return {
      status: 'commit',
      item: {
        action: DrawingTool.Bezier,
        points: [],
        path,
        style: { lineThickness, color: config.lineColor, shapeFillMode },
      },
    };
  }

  private drawPreview(context: DrawingModeContext, path: BezierPath, alpha: number): void {
    const { foldedCtx, foldedCanvas, getState } = context;
    const { config, folds, lineThickness, shapeFillMode } = getState();
    if (this.originalFoldedCanvasState) foldedCtx.putImageData(this.originalFoldedCanvasState, 0, 0);
    foldedCtx.save();
    if (foldedCanvas) CanvasService.clipToDrawableRegion(foldedCtx, foldedCanvas, folds);
    traceBezierPath(foldedCtx, path);
    foldedCtx.strokeStyle = config.lineColor;
    foldedCtx.fillStyle = config.lineColor;
    foldedCtx.lineWidth = lineThickness;
    foldedCtx.lineCap = 'round';
    foldedCtx.lineJoin = 'round';
    foldedCtx.globalAlpha = alpha;
    if (path.closed && shapeFillMode === ShapeFillMode.Filled) foldedCtx.fill();
    else foldedCtx.stroke();
    foldedCtx.restore();
    this.previewDrawn = true;
  }

  private updateGuidance(context: DrawingModeContext, hoverPoint?: Point): void {
    context.setDrawingGuidance({
      kind: 'bezier',
      path: cloneBezierPath(this.path),
      ...(hoverPoint ? { hoverPoint } : {}),
      ...(this.activeHandle ? { activeHandle: { ...this.activeHandle } } : {}),
    });
  }

  private reset(context: DrawingModeContext, restoreCanvas: boolean): void {
    if (restoreCanvas && this.previewDrawn && this.originalFoldedCanvasState) {
      context.foldedCtx.putImageData(this.originalFoldedCanvasState, 0, 0);
    }
    context.setDrawingGuidance(null);
    this.stage = 'idle';
    this.originalFoldedCanvasState = null;
    this.path = { anchors: [], closed: false };
    this.activeAnchorId = null;
    this.activeHandle = null;
    this.closing = false;
    this.previewDrawn = false;
    this.updateItemId = null;
    this.originalPath = null;
    this.resuming = false;
  }

  private createAnchorId(): string {
    return `bezier-anchor-${this.nextAnchorNumber++}`;
  }
}

function isPointInBezierPath(path: BezierPath, point: Point): boolean {
  const polygon = getBezierSegments(path).flatMap((segment) => flattenBezierSegment(segment.points, 32));
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const a = polygon[index];
    const b = polygon[previous];
    if (((a.y > point.y) !== (b.y > point.y)) &&
        point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function getFillMode(item: Parameters<DrawingModeGeometry['hitTest']>[0]): ShapeFillMode {
  return item.style?.shapeFillMode ?? item.shapeFillMode ?? ShapeFillMode.Filled;
}

function reflectPoint(point: Point, center: Point): Point {
  return { x: (2 * center.x) - point.x, y: (2 * center.y) - point.y };
}

function pointDistance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function reverseBezierPath(path: BezierPath): BezierPath {
  const next = cloneBezierPath(path);
  next.anchors.reverse();
  for (const anchor of next.anchors) {
    const inHandle = anchor.inHandle;
    anchor.inHandle = anchor.outHandle;
    anchor.outHandle = inHandle;
  }
  return next;
}

export { findNearestBezierLocation };
