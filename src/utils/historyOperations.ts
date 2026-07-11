import { DrawingTool, HistoryAction } from "../types";
import {
  DrawableDrawingTool,
  DrawableHistoryItem as DrawableCommand,
  DrawingStyle,
  Point,
  TransformHistoryItem,
  UndoableHistoryItem,
} from "../types/DrawingMode";
import { rotatePoints, translatePoint, translatePoints } from "./geometryMath";

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
    action === DrawingTool.Circle;
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
      return item;
    }

    const id = createHistoryItemId(usedIds, index);
    usedIds.add(id);
    changed = true;
    return {
      ...item,
      id,
    };
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

  return {
    ...item,
    id,
  };
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
): TransformHistoryItem {
  const rotatedItem = getRotatedHistoryItemPreview(item, angleRadians, center);

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

function applyTransformOperation(drawables: DrawableHistoryItem[], operation: TransformHistoryItem): void {
  const index = drawables.findIndex((item) => item.id === operation.itemId);
  if (index === -1) return;

  drawables[index] = {
    ...drawables[index],
    points: operation.toPoints.map(clonePoint),
    rotation: operation.toRotation ?? drawables[index].rotation,
    rotationCenter: operation.toRotationCenter
      ? clonePoint(operation.toRotationCenter)
      : drawables[index].rotationCenter,
  };
}

function applyDeleteOperation(drawables: DrawableHistoryItem[], itemId: string): void {
  const index = drawables.findIndex((item) => item.id === itemId);
  if (index !== -1) {
    drawables.splice(index, 1);
  }
}

function usesRotationMetadata(action: DrawableHistoryItem["action"]): boolean {
  return action === DrawingTool.Rectangle ||
    action === DrawingTool.Square ||
    action === DrawingTool.Circle;
}

function isShapeAction(action: DrawableHistoryItem["action"]): boolean {
  return action === DrawingTool.Rectangle ||
    action === DrawingTool.Square ||
    action === DrawingTool.Circle;
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
  return {
    ...item,
    points: item.points.map(clonePoint),
    style: item.style ? { ...item.style } : undefined,
    rotationCenter: item.rotationCenter ? clonePoint(item.rotationCenter) : undefined,
  };
}

function clonePoint(point: Point): Point {
  return { x: point.x, y: point.y };
}
