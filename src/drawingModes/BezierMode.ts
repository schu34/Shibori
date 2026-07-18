import { CanvasService } from '../services/CanvasService';
import { DrawingTool } from '../types';
import {
  DrawingMode,
  DrawingModeContext,
  DrawingModeGeometry,
  DrawingModeResult,
  Point,
} from '../types/DrawingMode';
import {
  distanceToPolyline,
  expandBounds,
  translatePoint,
  translatePoints,
} from '../utils/geometryMath';

const HIT_TEST_SEGMENTS = 64;

export const BezierGeometry: DrawingModeGeometry = {
  hitTest(item, point, options) {
    if (item.points.length !== 4) return false;
    const tolerance = (options.lineThickness / 2) + (options.hitTolerance ?? 8);
    return distanceToPolyline(point, flattenBezier(item.points, HIT_TEST_SEGMENTS)) <= tolerance;
  },
  getBounds(item, options) {
    if (item.points.length !== 4) return null;
    const bounds = getBezierBounds(item.points);
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

type Stage = 'idle' | 'first-active' | 'awaiting-second' | 'second-active';

export class BezierMode implements DrawingMode {
  private stage: Stage = 'idle';
  private originalFoldedCanvasState: ImageData | null = null;
  private startAnchor: Point | null = null;
  private firstControl: Point | null = null;
  private endAnchor: Point | null = null;
  private secondControl: Point | null = null;
  private endHandle: Point | null = null;
  private previewDrawn = false;

  start(point: Point, context: DrawingModeContext): void {
    if (this.stage === 'idle') {
      const dimensions = context.getFoldedCanvasDimensions();
      if (dimensions) {
        this.originalFoldedCanvasState = context.foldedCtx.getImageData(
          0,
          0,
          dimensions.width,
          dimensions.height
        );
      }
      this.startAnchor = point;
      this.firstControl = point;
      this.stage = 'first-active';
      this.updateGuidance(context);
      return;
    }

    if (this.stage === 'awaiting-second') {
      this.endAnchor = point;
      this.endHandle = point;
      this.secondControl = point;
      this.stage = 'second-active';
      this.updateGuidance(context);
    }
  }

  continue(point: Point, context: DrawingModeContext): boolean {
    if (this.stage === 'first-active') {
      this.firstControl = point;
      this.updateGuidance(context);
      return false;
    }

    if (this.stage !== 'second-active' || !this.endAnchor) return false;
    this.endHandle = point;
    this.secondControl = reflectPoint(point, this.endAnchor);
    this.drawPreview(context, 0.6);
    this.updateGuidance(context);
    return true;
  }

  end(point: Point | null, context: DrawingModeContext): DrawingModeResult {
    if (this.stage === 'first-active' && this.startAnchor && this.firstControl) {
      if (point) this.firstControl = point;
      this.stage = 'awaiting-second';
      this.updateGuidance(context);
      return { status: 'continue' };
    }

    if (this.stage !== 'second-active' ||
        !this.startAnchor ||
        !this.firstControl ||
        !this.endAnchor ||
        !this.secondControl) {
      this.reset(context, true);
      return { status: 'discard' };
    }

    if (point) {
      this.endHandle = point;
      this.secondControl = reflectPoint(point, this.endAnchor);
    }
    this.drawPreview(context, 1);

    const { lineThickness, config } = context.getState();
    const points = [
      this.startAnchor,
      this.firstControl,
      this.secondControl,
      this.endAnchor,
    ];
    this.reset(context, false);
    return {
      status: 'commit',
      item: {
        action: DrawingTool.Bezier,
        points,
        style: {
          lineThickness,
          color: config.lineColor,
        },
      },
    };
  }

  cancel(context: DrawingModeContext): void {
    this.reset(context, true);
  }

  private drawPreview(context: DrawingModeContext, alpha: number): void {
    if (!this.startAnchor || !this.firstControl || !this.secondControl || !this.endAnchor) return;
    const { foldedCtx, foldedCanvas, getState } = context;
    const { config, folds, lineThickness } = getState();

    if (this.originalFoldedCanvasState) {
      foldedCtx.putImageData(this.originalFoldedCanvasState, 0, 0);
    }
    foldedCtx.save();
    if (foldedCanvas) CanvasService.clipToDrawableRegion(foldedCtx, foldedCanvas, folds);
    foldedCtx.beginPath();
    foldedCtx.moveTo(this.startAnchor.x, this.startAnchor.y);
    foldedCtx.bezierCurveTo(
      this.firstControl.x,
      this.firstControl.y,
      this.secondControl.x,
      this.secondControl.y,
      this.endAnchor.x,
      this.endAnchor.y
    );
    foldedCtx.strokeStyle = config.lineColor;
    foldedCtx.lineWidth = lineThickness;
    foldedCtx.lineCap = 'round';
    foldedCtx.lineJoin = 'round';
    foldedCtx.globalAlpha = alpha;
    foldedCtx.stroke();
    foldedCtx.restore();
    this.previewDrawn = true;
  }

  private updateGuidance(context: DrawingModeContext): void {
    if (!this.startAnchor || !this.firstControl) return;
    context.setDrawingGuidance({
      kind: 'bezier',
      startAnchor: this.startAnchor,
      firstControl: this.firstControl,
      ...(this.endAnchor ? { endAnchor: this.endAnchor } : {}),
      ...(this.secondControl ? { secondControl: this.secondControl } : {}),
      ...(this.endHandle ? { endHandle: this.endHandle } : {}),
    });
  }

  private reset(context: DrawingModeContext, restoreCanvas: boolean): void {
    if (restoreCanvas && this.previewDrawn && this.originalFoldedCanvasState) {
      context.foldedCtx.putImageData(this.originalFoldedCanvasState, 0, 0);
    }
    context.setDrawingGuidance(null);
    this.stage = 'idle';
    this.originalFoldedCanvasState = null;
    this.startAnchor = null;
    this.firstControl = null;
    this.endAnchor = null;
    this.secondControl = null;
    this.endHandle = null;
    this.previewDrawn = false;
  }
}

function reflectPoint(point: Point, center: Point): Point {
  return { x: (2 * center.x) - point.x, y: (2 * center.y) - point.y };
}

function flattenBezier(points: Point[], segments: number): Point[] {
  return Array.from({ length: segments + 1 }, (_, index) => evaluateBezier(points, index / segments));
}

function getBezierBounds(points: Point[]) {
  const parameters = new Set<number>([0, 1]);
  for (const axis of ['x', 'y'] as const) {
    for (const value of derivativeRoots(points.map((point) => point[axis]))) {
      if (value > 0 && value < 1) parameters.add(value);
    }
  }
  const evaluated = [...parameters].map((parameter) => evaluateBezier(points, parameter));
  return {
    minX: Math.min(...evaluated.map((point) => point.x)),
    minY: Math.min(...evaluated.map((point) => point.y)),
    maxX: Math.max(...evaluated.map((point) => point.x)),
    maxY: Math.max(...evaluated.map((point) => point.y)),
  };
}

function derivativeRoots([p0, p1, p2, p3]: number[]): number[] {
  const a = -p0 + (3 * p1) - (3 * p2) + p3;
  const b = 2 * (p0 - (2 * p1) + p2);
  const c = p1 - p0;
  if (Math.abs(a) < 1e-9) return Math.abs(b) < 1e-9 ? [] : [-c / b];
  const discriminant = (b * b) - (4 * a * c);
  if (discriminant < 0) return [];
  const root = Math.sqrt(discriminant);
  return [(-b + root) / (2 * a), (-b - root) / (2 * a)];
}

function evaluateBezier([p0, p1, p2, p3]: Point[], t: number): Point {
  const inverse = 1 - t;
  return {
    x: (inverse ** 3 * p0.x) + (3 * inverse ** 2 * t * p1.x) +
      (3 * inverse * t ** 2 * p2.x) + (t ** 3 * p3.x),
    y: (inverse ** 3 * p0.y) + (3 * inverse ** 2 * t * p1.y) +
      (3 * inverse * t ** 2 * p2.y) + (t ** 3 * p3.y),
  };
}
