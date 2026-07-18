import {
  BezierAnchor,
  BezierPath,
  Bounds,
  Point,
} from '../types/DrawingMode';
import { rotatePoint, translatePoint } from './geometryMath';

export interface BezierSegment {
  index: number;
  start: BezierAnchor;
  end: BezierAnchor;
  points: [Point, Point, Point, Point];
}

export function cloneBezierPath(path: BezierPath): BezierPath {
  return {
    closed: path.closed,
    anchors: path.anchors.map((anchor) => ({
      ...anchor,
      point: { ...anchor.point },
      inHandle: anchor.inHandle ? { ...anchor.inHandle } : null,
      outHandle: anchor.outHandle ? { ...anchor.outHandle } : null,
    })),
  };
}

export function createAnchor(
  id: string,
  point: Point,
  inHandle: Point | null = null,
  outHandle: Point | null = null,
  kind: BezierAnchor['kind'] = 'corner'
): BezierAnchor {
  return { id, point: { ...point }, inHandle, outHandle, kind };
}

export function legacyPointsToPath(points: Point[], itemId = 'bezier'): BezierPath | null {
  if (points.length !== 4) return null;
  return {
    closed: false,
    anchors: [
      createAnchor(`${itemId}:anchor:1`, points[0], null, { ...points[1] }, 'corner'),
      createAnchor(`${itemId}:anchor:2`, points[3], { ...points[2] }, null, 'corner'),
    ],
  };
}

export function getBezierSegments(path: BezierPath): BezierSegment[] {
  const segments: BezierSegment[] = [];
  const count = path.closed ? path.anchors.length : path.anchors.length - 1;
  for (let index = 0; index < count; index++) {
    const start = path.anchors[index];
    const end = path.anchors[(index + 1) % path.anchors.length];
    if (!start || !end) continue;
    segments.push({
      index,
      start,
      end,
      points: [
        start.point,
        start.outHandle ?? start.point,
        end.inHandle ?? end.point,
        end.point,
      ],
    });
  }
  return segments;
}

export function traceBezierPath(ctx: CanvasRenderingContext2D, path: BezierPath): void {
  if (path.anchors.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(path.anchors[0].point.x, path.anchors[0].point.y);
  for (const segment of getBezierSegments(path)) {
    ctx.bezierCurveTo(
      segment.points[1].x,
      segment.points[1].y,
      segment.points[2].x,
      segment.points[2].y,
      segment.points[3].x,
      segment.points[3].y
    );
  }
  if (path.closed) ctx.closePath();
}

export function evaluateBezier([p0, p1, p2, p3]: readonly Point[], t: number): Point {
  const inverse = 1 - t;
  return {
    x: (inverse ** 3 * p0.x) + (3 * inverse ** 2 * t * p1.x) +
      (3 * inverse * t ** 2 * p2.x) + (t ** 3 * p3.x),
    y: (inverse ** 3 * p0.y) + (3 * inverse ** 2 * t * p1.y) +
      (3 * inverse * t ** 2 * p2.y) + (t ** 3 * p3.y),
  };
}

export function flattenBezierSegment(points: readonly Point[], segments = 48): Point[] {
  return Array.from({ length: segments + 1 }, (_, index) => evaluateBezier(points, index / segments));
}

export function getBezierPathBounds(path: BezierPath): Bounds | null {
  const evaluated: Point[] = [];
  for (const segment of getBezierSegments(path)) {
    const parameters = new Set<number>([0, 1]);
    for (const axis of ['x', 'y'] as const) {
      for (const value of derivativeRoots(segment.points.map((point) => point[axis]))) {
        if (value > 0 && value < 1) parameters.add(value);
      }
    }
    for (const parameter of parameters) evaluated.push(evaluateBezier(segment.points, parameter));
  }
  if (evaluated.length === 0 && path.anchors[0]) evaluated.push(path.anchors[0].point);
  if (evaluated.length === 0) return null;
  return {
    minX: Math.min(...evaluated.map((point) => point.x)),
    minY: Math.min(...evaluated.map((point) => point.y)),
    maxX: Math.max(...evaluated.map((point) => point.x)),
    maxY: Math.max(...evaluated.map((point) => point.y)),
  };
}

export function findNearestBezierLocation(
  path: BezierPath,
  target: Point,
  samplesPerSegment = 64
): { segmentIndex: number; t: number; point: Point; distance: number } | null {
  let best: { segmentIndex: number; t: number; point: Point; distance: number } | null = null;
  for (const segment of getBezierSegments(path)) {
    for (let sample = 0; sample <= samplesPerSegment; sample++) {
      const t = sample / samplesPerSegment;
      const point = evaluateBezier(segment.points, t);
      const distance = Math.hypot(target.x - point.x, target.y - point.y);
      if (!best || distance < best.distance) best = { segmentIndex: segment.index, t, point, distance };
    }
  }
  if (!best) return null;
  const segment = getBezierSegments(path).find((candidate) => candidate.index === best!.segmentIndex);
  if (!segment) return best;
  let left = Math.max(0, best.t - (1 / samplesPerSegment));
  let right = Math.min(1, best.t + (1 / samplesPerSegment));
  for (let iteration = 0; iteration < 12; iteration++) {
    const t1 = left + ((right - left) / 3);
    const t2 = right - ((right - left) / 3);
    const d1 = pointDistance(target, evaluateBezier(segment.points, t1));
    const d2 = pointDistance(target, evaluateBezier(segment.points, t2));
    if (d1 <= d2) right = t2;
    else left = t1;
  }
  const t = (left + right) / 2;
  const point = evaluateBezier(segment.points, t);
  return { segmentIndex: segment.index, t, point, distance: pointDistance(target, point) };
}

export function splitBezierPathSegment(path: BezierPath, segmentIndex: number, t: number, anchorId: string): BezierPath {
  const next = cloneBezierPath(path);
  const startIndex = segmentIndex;
  const endIndex = (segmentIndex + 1) % next.anchors.length;
  const start = next.anchors[startIndex];
  const end = next.anchors[endIndex];
  if (!start || !end) return next;
  const p0 = start.point;
  const p1 = start.outHandle ?? start.point;
  const p2 = end.inHandle ?? end.point;
  const p3 = end.point;
  const q0 = lerp(p0, p1, t);
  const q1 = lerp(p1, p2, t);
  const q2 = lerp(p2, p3, t);
  const r0 = lerp(q0, q1, t);
  const r1 = lerp(q1, q2, t);
  const split = lerp(r0, r1, t);
  start.outHandle = q0;
  end.inHandle = q2;
  const inserted = createAnchor(anchorId, split, r0, r1, 'smooth');
  if (endIndex === 0) next.anchors.push(inserted);
  else next.anchors.splice(endIndex, 0, inserted);
  return next;
}

export function translateBezierPath(path: BezierPath, delta: Point): BezierPath {
  const next = cloneBezierPath(path);
  for (const anchor of next.anchors) {
    anchor.point = translatePoint(anchor.point, delta);
    if (anchor.inHandle) anchor.inHandle = translatePoint(anchor.inHandle, delta);
    if (anchor.outHandle) anchor.outHandle = translatePoint(anchor.outHandle, delta);
  }
  return next;
}

export function rotateBezierPath(path: BezierPath, center: Point, angle: number): BezierPath {
  const next = cloneBezierPath(path);
  for (const anchor of next.anchors) {
    anchor.point = rotatePoint(anchor.point, center, angle);
    if (anchor.inHandle) anchor.inHandle = rotatePoint(anchor.inHandle, center, angle);
    if (anchor.outHandle) anchor.outHandle = rotatePoint(anchor.outHandle, center, angle);
  }
  return next;
}

export function moveBezierAnchors(path: BezierPath, anchorIds: ReadonlySet<string>, delta: Point): BezierPath {
  const next = cloneBezierPath(path);
  for (const anchor of next.anchors) {
    if (!anchorIds.has(anchor.id)) continue;
    anchor.point = translatePoint(anchor.point, delta);
    if (anchor.inHandle) anchor.inHandle = translatePoint(anchor.inHandle, delta);
    if (anchor.outHandle) anchor.outHandle = translatePoint(anchor.outHandle, delta);
  }
  return next;
}

export function moveBezierHandle(
  path: BezierPath,
  anchorId: string,
  side: 'in' | 'out',
  point: Point,
  breakPair: boolean
): BezierPath {
  const next = cloneBezierPath(path);
  const anchor = next.anchors.find((candidate) => candidate.id === anchorId);
  if (!anchor) return next;
  const key = side === 'in' ? 'inHandle' : 'outHandle';
  const oppositeKey = side === 'in' ? 'outHandle' : 'inHandle';
  anchor[key] = { ...point };
  if (breakPair) anchor.kind = 'corner';
  if (anchor.kind === 'smooth' && !breakPair) {
    const opposite = anchor[oppositeKey];
    const length = opposite ? pointDistance(anchor.point, opposite) : pointDistance(anchor.point, point);
    const angle = Math.atan2(point.y - anchor.point.y, point.x - anchor.point.x) + Math.PI;
    anchor[oppositeKey] = {
      x: anchor.point.x + (Math.cos(angle) * length),
      y: anchor.point.y + (Math.sin(angle) * length),
    };
  }
  return next;
}

export function convertBezierAnchor(path: BezierPath, anchorId: string): BezierPath {
  const next = cloneBezierPath(path);
  const anchor = next.anchors.find((candidate) => candidate.id === anchorId);
  if (!anchor) return next;
  if (anchor.kind === 'smooth') {
    anchor.kind = 'corner';
    anchor.inHandle = null;
    anchor.outHandle = null;
    return next;
  }
  const fallbackLength = 40;
  const existing = anchor.outHandle ?? anchor.inHandle;
  const angle = existing
    ? Math.atan2(existing.y - anchor.point.y, existing.x - anchor.point.x)
    : 0;
  const length = existing ? Math.max(1, pointDistance(anchor.point, existing)) : fallbackLength;
  anchor.kind = 'smooth';
  anchor.outHandle = {
    x: anchor.point.x + (Math.cos(angle) * length),
    y: anchor.point.y + (Math.sin(angle) * length),
  };
  anchor.inHandle = {
    x: anchor.point.x - (Math.cos(angle) * length),
    y: anchor.point.y - (Math.sin(angle) * length),
  };
  return next;
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

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + ((b.x - a.x) * t), y: a.y + ((b.y - a.y) * t) };
}

function pointDistance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
