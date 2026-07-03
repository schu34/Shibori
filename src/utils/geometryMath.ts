import { Bounds, Point } from "../types/DrawingMode";

export function translatePoints(points: Point[], delta: Point): Point[] {
  return points.map((point) => ({
    x: point.x + delta.x,
    y: point.y + delta.y,
  }));
}

export function translatePoint(point: Point, delta: Point): Point {
  return {
    x: point.x + delta.x,
    y: point.y + delta.y,
  };
}

export function rotatePoint(point: Point, center: Point, angleRadians: number): Point {
  const cos = Math.cos(angleRadians);
  const sin = Math.sin(angleRadians);
  const dx = point.x - center.x;
  const dy = point.y - center.y;

  return {
    x: center.x + (dx * cos) - (dy * sin),
    y: center.y + (dx * sin) + (dy * cos),
  };
}

export function rotatePoints(points: Point[], center: Point, angleRadians: number): Point[] {
  return points.map((point) => rotatePoint(point, center, angleRadians));
}

export function getBoundsFromPoints(points: Point[]): Bounds | null {
  if (points.length === 0) return null;

  return points.reduce<Bounds>(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    {
      minX: points[0].x,
      minY: points[0].y,
      maxX: points[0].x,
      maxY: points[0].y,
    }
  );
}

export function expandBounds(bounds: Bounds, amount: number): Bounds {
  return {
    minX: bounds.minX - amount,
    minY: bounds.minY - amount,
    maxX: bounds.maxX + amount,
    maxY: bounds.maxY + amount,
  };
}

export function getBoundsCenter(bounds: Bounds): Point {
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
}

export function getBoundsCorners(bounds: Bounds): Point[] {
  return [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ];
}

export function rotateBounds(bounds: Bounds, center: Point, angleRadians: number): Bounds {
  const rotatedCorners = rotatePoints(getBoundsCorners(bounds), center, angleRadians);
  const rotatedBounds = getBoundsFromPoints(rotatedCorners);

  return rotatedBounds ?? bounds;
}

export function isPointInBounds(point: Point, bounds: Bounds): boolean {
  return point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.y >= bounds.minY &&
    point.y <= bounds.maxY;
}

export function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared)
  );

  const projection = {
    x: start.x + t * dx,
    y: start.y + t * dy,
  };

  return Math.hypot(point.x - projection.x, point.y - projection.y);
}

export function distanceToPolyline(point: Point, points: Point[]): number {
  if (points.length === 0) return Infinity;
  if (points.length === 1) return Math.hypot(point.x - points[0].x, point.y - points[0].y);

  let shortest = Infinity;
  for (let i = 1; i < points.length; i++) {
    shortest = Math.min(shortest, distanceToSegment(point, points[i - 1], points[i]));
  }

  return shortest;
}

export function getRectBounds(start: Point, end: Point): Bounds {
  return {
    minX: Math.min(start.x, end.x),
    minY: Math.min(start.y, end.y),
    maxX: Math.max(start.x, end.x),
    maxY: Math.max(start.y, end.y),
  };
}

export function getSquareEndPoint(start: Point, end: Point): Point {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const sideLength = Math.min(Math.abs(deltaX), Math.abs(deltaY));

  return {
    x: start.x + Math.sign(deltaX || 1) * sideLength,
    y: start.y + Math.sign(deltaY || 1) * sideLength,
  };
}

export function isPointNearRectOutline(point: Point, bounds: Bounds, tolerance: number): boolean {
  const expanded = expandBounds(bounds, tolerance);
  if (!isPointInBounds(point, expanded)) return false;

  const inner = {
    minX: bounds.minX + tolerance,
    minY: bounds.minY + tolerance,
    maxX: bounds.maxX - tolerance,
    maxY: bounds.maxY - tolerance,
  };

  return !isPointInBounds(point, inner);
}

export function isPointInCircle(point: Point, center: Point, radius: number): boolean {
  return Math.hypot(point.x - center.x, point.y - center.y) <= radius;
}

export function isPointNearCircleOutline(
  point: Point,
  center: Point,
  radius: number,
  tolerance: number
): boolean {
  return Math.abs(Math.hypot(point.x - center.x, point.y - center.y) - radius) <= tolerance;
}
