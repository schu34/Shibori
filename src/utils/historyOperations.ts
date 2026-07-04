import { DrawingTool, HistoryAction } from "../types";
import { Point, UndoableHistoryItem } from "../types/DrawingMode";
import { rotatePoints, translatePoint, translatePoints } from "./geometryMath";

export type DrawableHistoryItem = UndoableHistoryItem & {
  id: string;
  action: Exclude<DrawingTool, DrawingTool.SelectMove>;
};

export function isDrawableHistoryItem(item: UndoableHistoryItem): item is DrawableHistoryItem {
  return Object.values(DrawingTool).includes(item.action as DrawingTool) &&
    item.action !== DrawingTool.SelectMove &&
    typeof item.id === "string" &&
    item.id.length > 0;
}

export function isDrawableAction(action: UndoableHistoryItem["action"]): action is DrawableHistoryItem["action"] {
  return Object.values(DrawingTool).includes(action as DrawingTool) && action !== DrawingTool.SelectMove;
}

export function ensureHistoryItemIds(history: UndoableHistoryItem[]): UndoableHistoryItem[] {
  const usedIds = new Set<string>();
  let changed = false;

  const normalizedHistory = history.map((item, index) => {
    if (!isDrawableAction(item.action)) {
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
  if (!isDrawableAction(item.action) || item.id) {
    return item;
  }

  const usedIds = new Set(
    history
      .map((historyItem) => historyItem.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
  );
  const id = createHistoryItemId(usedIds, history.length);

  return {
    ...item,
    id,
  };
}

export function buildDrawableHistory(history: UndoableHistoryItem[]): DrawableHistoryItem[] {
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
      applyDeleteOperation(drawables, item);
      continue;
    }

    if (isDrawableHistoryItem(item)) {
      drawables.push(item);
    }
  }

  return drawables;
}

export function createMoveHistoryItem(
  itemId: string,
  fromPoints: Point[],
  toPoints: Point[],
  fromRotation?: number,
  toRotation?: number,
  fromRotationCenter?: Point,
  toRotationCenter?: Point
): UndoableHistoryItem {
  const historyItem: UndoableHistoryItem = {
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
): UndoableHistoryItem {
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

function applyTransformOperation(drawables: DrawableHistoryItem[], operation: UndoableHistoryItem): void {
  if (!operation.itemId || !operation.toPoints) return;

  const index = drawables.findIndex((item) => item.id === operation.itemId);
  if (index === -1) return;

  drawables[index] = {
    ...drawables[index],
    points: operation.toPoints,
    rotation: operation.toRotation ?? drawables[index].rotation,
    rotationCenter: operation.toRotationCenter ?? drawables[index].rotationCenter,
  };
}

function applyDeleteOperation(drawables: DrawableHistoryItem[], operation: UndoableHistoryItem): void {
  if (!operation.itemId) return;

  const index = drawables.findIndex((item) => item.id === operation.itemId);
  if (index !== -1) {
    drawables.splice(index, 1);
  }
}

function usesRotationMetadata(action: DrawableHistoryItem["action"]): boolean {
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
