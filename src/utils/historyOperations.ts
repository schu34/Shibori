import { DrawingTool, HistoryAction } from "../types";
import {
  DrawableDrawingTool,
  DrawableHistoryItem as DrawableCommand,
  DrawingStyle,
  BezierPath,
  BezierPathHistoryItem,
  Point,
  TransformHistoryItem,
  UpdatePathHistoryItem,
  UndoableHistoryItem,
} from "../types/DrawingMode";
import { rotatePoints, translatePoint, translatePoints } from "./geometryMath";
import { cloneBezierPath, legacyPointsToPath, rotateBezierPath, translateBezierPath } from "./bezierPath";

export type DrawableHistoryItem = DrawableCommand & {
  id: string;
};

export interface DrawingStyleDefaults {
  lineThickness: number;
  color: string;
  shapeFillMode: DrawingStyle["shapeFillMode"];
}

export function isDrawableHistoryItem(item: UndoableHistoryItem): item is DrawableHistoryItem {
  return isDrawableCommand(item) &&
    typeof item.id === "string" &&
    item.id.length > 0;
}

export function isDrawableAction(action: UndoableHistoryItem["action"]): action is DrawableDrawingTool {
  return action === DrawingTool.Paintbrush ||
    action === DrawingTool.Line ||
    action === DrawingTool.Rectangle ||
    action === DrawingTool.Square ||
    action === DrawingTool.Circle ||
    action === DrawingTool.Bezier;
}

export function isDrawableCommand(item: UndoableHistoryItem): item is DrawableCommand {
  return isDrawableAction(item.action);
}

export function ensureHistoryItemIds(history: UndoableHistoryItem[]): UndoableHistoryItem[] {
  const usedIds = new Set<string>();
  let changed = false;

  const normalizedHistory = history.map((item, index) => {
    if (!isDrawableCommand(item)) {
      return item;
    }

    const existingId = typeof item.id === "string" && item.id.length > 0 ? item.id : null;
    if (existingId && !usedIds.has(existingId)) {
      usedIds.add(existingId);
      const normalized = normalizeBezierCommand(item, existingId);
      if (normalized !== item) changed = true;
      return normalized;
    }

    const id = createHistoryItemId(usedIds, index);
    usedIds.add(id);
    changed = true;
    return normalizeBezierCommand({
      ...item,
      id,
    }, id);
  });

  return changed ? normalizedHistory : history;
}

export function assignHistoryItemId(
  item: UndoableHistoryItem,
  history: UndoableHistoryItem[]
): UndoableHistoryItem {
  if (!isDrawableCommand(item) || item.id) {
    return item;
  }

  const usedIds = new Set(
    history
      .map((historyItem) => isDrawableCommand(historyItem) ? historyItem.id : undefined)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
  );
  const id = createHistoryItemId(usedIds, history.length);

  return normalizeBezierCommand({
    ...item,
    id,
  }, id);
}

/**
 * Adds stable IDs and complete style snapshots without mutating the input log.
 * This is used both when producing v2 shares and while migrating legacy links.
 */
export function materializeDrawableStyles(
  history: UndoableHistoryItem[],
  defaults: DrawingStyleDefaults
): UndoableHistoryItem[] {
  return ensureHistoryItemIds(history).map((item) => {
    if (!isDrawableHistoryItem(item)) return item;

    const shapeFillMode = isShapeAction(item.action)
      ? item.style?.shapeFillMode ?? item.shapeFillMode ?? defaults.shapeFillMode
      : undefined;

    return {
      ...item,
      style: {
        lineThickness: item.style?.lineThickness ?? defaults.lineThickness,
        color: item.style?.color ?? defaults.color,
        ...(shapeFillMode === undefined ? {} : { shapeFillMode }),
      },
    };
  });
}

/** Resolves the operation log into the drawables visible at that history boundary. */
export function resolveScene(history: UndoableHistoryItem[]): DrawableHistoryItem[] {
  const drawables: DrawableHistoryItem[] = [];

  for (const item of ensureHistoryItemIds(history)) {
    if (item.action === HistoryAction.Clear) {
      drawables.length = 0;
      continue;
    }

    if (item.action === HistoryAction.Move || item.action === HistoryAction.Rotate) {
      applyTransformOperation(drawables, item);
      continue;
    }

    if (item.action === HistoryAction.Delete) {
      applyDeleteOperation(drawables, item.itemId);
      continue;
    }

    if (item.action === HistoryAction.UpdatePath) {
      applyUpdatePathOperation(drawables, item);
      continue;
    }

    if (isDrawableHistoryItem(item)) {
      drawables.push(cloneDrawable(item));
    }
  }

  return drawables;
}

/** @deprecated Prefer the domain-oriented resolveScene name. */
export function buildDrawableHistory(history: UndoableHistoryItem[]): DrawableHistoryItem[] {
  return resolveScene(history);
}

export function createMoveHistoryItem(
  itemId: string,
  fromPoints: Point[],
  toPoints: Point[],
  fromRotation?: number,
  toRotation?: number,
  fromRotationCenter?: Point,
  toRotationCenter?: Point
): TransformHistoryItem {
  const historyItem: TransformHistoryItem = {
    action: HistoryAction.Move,
    itemId,
    points: [],
    fromPoints,
    toPoints,
  };

  if (fromRotation !== undefined) historyItem.fromRotation = fromRotation;
  if (toRotation !== undefined) historyItem.toRotation = toRotation;
  if (fromRotationCenter) historyItem.fromRotationCenter = fromRotationCenter;
  if (toRotationCenter) historyItem.toRotationCenter = toRotationCenter;

  return historyItem;
}

export function createRotateHistoryItem(
  item: DrawableHistoryItem,
  angleRadians: number,
  center: Point
): TransformHistoryItem | UpdatePathHistoryItem {
  const rotatedItem = getRotatedHistoryItemPreview(item, angleRadians, center);

  if (item.action === DrawingTool.Bezier && rotatedItem.action === DrawingTool.Bezier && item.path && rotatedItem.path) {
    return createUpdatePathHistoryItem(item.id, item.path, rotatedItem.path);
  }

  return {
    action: HistoryAction.Rotate,
    itemId: item.id,
    points: [],
    fromPoints: item.points,
    toPoints: rotatedItem.points,
    fromRotation: item.rotation,
    toRotation: rotatedItem.rotation,
    fromRotationCenter: item.rotationCenter,
    toRotationCenter: rotatedItem.rotationCenter,
  };
}

export function createDeleteHistoryItem(itemId: string): UndoableHistoryItem {
  return {
    action: HistoryAction.Delete,
    itemId,
    points: [],
  };
}

export function getTranslatedHistoryItemPreview(
  item: DrawableHistoryItem,
  delta: Point
): DrawableHistoryItem {
  if (item.action === DrawingTool.Bezier && item.path) {
    return { ...item, points: [], path: translateBezierPath(item.path, delta) };
  }
  return {
    ...item,
    points: translatePoints(item.points, delta),
    rotationCenter: item.rotationCenter
      ? translatePoint(item.rotationCenter, delta)
      : undefined,
  };
}

export function getRotatedHistoryItemPreview(
  item: DrawableHistoryItem,
  angleRadians: number,
  center: Point
): DrawableHistoryItem {
  if (item.action === DrawingTool.Bezier && item.path) {
    return { ...item, points: [], path: rotateBezierPath(item.path, center, angleRadians) };
  }
  if (usesRotationMetadata(item.action)) {
    return {
      ...item,
      rotation: (item.rotation ?? 0) + angleRadians,
      rotationCenter: center,
    };
  }

  return {
    ...item,
    points: rotatePoints(item.points, center, angleRadians),
  };
}

export function createUpdatePathHistoryItem(
  itemId: string,
  fromPath: BezierPath,
  toPath: BezierPath
): UpdatePathHistoryItem {
  return {
    action: HistoryAction.UpdatePath,
    itemId,
    points: [],
    fromPath: cloneBezierPath(fromPath),
    toPath: cloneBezierPath(toPath),
  };
}

function applyTransformOperation(drawables: DrawableHistoryItem[], operation: TransformHistoryItem): void {
  const index = drawables.findIndex((item) => item.id === operation.itemId);
  if (index === -1) return;

  const item = drawables[index];
  if (item.action === DrawingTool.Bezier && item.path) {
    const transformedPath = legacyPointsToPath(operation.toPoints, item.id);
    if (transformedPath) {
      drawables[index] = { ...item, points: [], path: transformedPath };
    }
    return;
  }

  drawables[index] = {
    ...item,
    points: operation.toPoints.map(clonePoint),
    rotation: operation.toRotation ?? item.rotation,
    rotationCenter: operation.toRotationCenter
      ? clonePoint(operation.toRotationCenter)
      : item.rotationCenter,
  };
}

function applyDeleteOperation(drawables: DrawableHistoryItem[], itemId: string): void {
  const index = drawables.findIndex((item) => item.id === itemId);
  if (index !== -1) {
    drawables.splice(index, 1);
  }
}

function applyUpdatePathOperation(drawables: DrawableHistoryItem[], operation: UpdatePathHistoryItem): void {
  const index = drawables.findIndex((item) => item.id === operation.itemId);
  const item = drawables[index];
  if (index === -1 || item.action !== DrawingTool.Bezier) return;
  drawables[index] = { ...item, points: [], path: cloneBezierPath(operation.toPath) };
}

function usesRotationMetadata(action: DrawableHistoryItem["action"]): boolean {
  return action === DrawingTool.Rectangle ||
    action === DrawingTool.Square ||
    action === DrawingTool.Circle;
}

function isShapeAction(action: DrawableHistoryItem["action"]): boolean {
  return action === DrawingTool.Rectangle ||
    action === DrawingTool.Square ||
    action === DrawingTool.Circle ||
    action === DrawingTool.Bezier;
}

function createHistoryItemId(usedIds: Set<string>, preferredIndex: number): string {
  let id = `history-item-${preferredIndex + 1}`;
  let suffix = 1;

  while (usedIds.has(id)) {
    id = `history-item-${preferredIndex + 1}-${suffix}`;
    suffix++;
  }

  return id;
}

function cloneDrawable(item: DrawableHistoryItem): DrawableHistoryItem {
  if (item.action === DrawingTool.Bezier && item.path) {
    return {
      ...item,
      points: [],
      path: cloneBezierPath(item.path),
      style: item.style ? { ...item.style } : undefined,
      rotationCenter: item.rotationCenter ? clonePoint(item.rotationCenter) : undefined,
    };
  }
  return {
    ...item,
    points: item.points.map(clonePoint),
    style: item.style ? { ...item.style } : undefined,
    rotationCenter: item.rotationCenter ? clonePoint(item.rotationCenter) : undefined,
  };
}

function normalizeBezierCommand(item: DrawableCommand, id: string): DrawableCommand {
  if (item.action !== DrawingTool.Bezier || item.path) return item;
  const path = legacyPointsToPath(item.points, id);
  if (!path) return item;
  return { ...item, points: [], path } as BezierPathHistoryItem;
}

function clonePoint(point: Point): Point {
  return { x: point.x, y: point.y };
}
