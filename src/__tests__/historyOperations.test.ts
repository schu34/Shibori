import { DrawingTool, HistoryAction, ShapeFillMode } from '../types';
import {
  DrawableHistoryItem as DrawableCommand,
  PointDrawingTool,
  UndoableHistoryItem,
} from '../types/DrawingMode';
import {
  ensureHistoryItemIds,
  materializeDrawableStyles,
  resolveScene,
  createUpdatePathHistoryItem,
} from '../utils/historyOperations';

const draw = (
  id: string | undefined,
  action: PointDrawingTool = DrawingTool.Paintbrush,
  x = 0
): DrawableCommand => ({
  ...(id ? { id } : {}),
  action,
  points: [{ x, y: x }, { x: x + 10, y: x + 10 }],
});

describe('history domain operations', () => {
  test('assigns deterministic IDs and replaces duplicate IDs without mutating input', () => {
    const history: UndoableHistoryItem[] = [
      draw(undefined),
      draw('kept', DrawingTool.Line),
      draw('kept', DrawingTool.Circle),
    ];

    const normalized = ensureHistoryItemIds(history);

    expect(normalized.map((item) => item.id)).toEqual([
      'history-item-1',
      'kept',
      'history-item-3',
    ]);
    expect(history[0].id).toBeUndefined();
    expect(history[2].id).toBe('kept');
  });

  test('resolves draw, move, rotate, delete, and clear commands at any undo boundary', () => {
    const history: UndoableHistoryItem[] = [
      draw('brush', DrawingTool.Paintbrush, 0),
      draw('shape', DrawingTool.Rectangle, 100),
      {
        action: HistoryAction.Move,
        points: [],
        itemId: 'brush',
        fromPoints: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
        toPoints: [{ x: 20, y: 20 }, { x: 30, y: 30 }],
      },
      {
        action: HistoryAction.Rotate,
        points: [],
        itemId: 'shape',
        fromPoints: [{ x: 100, y: 100 }, { x: 110, y: 110 }],
        toPoints: [{ x: 100, y: 100 }, { x: 110, y: 110 }],
        toRotation: Math.PI / 2,
        toRotationCenter: { x: 105, y: 105 },
      },
      { action: HistoryAction.Delete, points: [], itemId: 'brush' },
      { action: HistoryAction.Clear, points: [] },
      draw('after-clear', DrawingTool.Line, 200),
    ];

    expect(resolveScene(history.slice(0, 3)).find((item) => item.id === 'brush')?.points)
      .toEqual([{ x: 20, y: 20 }, { x: 30, y: 30 }]);
    expect(resolveScene(history.slice(0, 4)).find((item) => item.id === 'shape'))
      .toEqual(expect.objectContaining({
        rotation: Math.PI / 2,
        rotationCenter: { x: 105, y: 105 },
      }));
    expect(resolveScene(history.slice(0, 5)).map((item) => item.id)).toEqual(['shape']);
    expect(resolveScene(history.slice(0, 6))).toEqual([]);
    expect(resolveScene(history).map((item) => item.id)).toEqual(['after-clear']);

    // Undoing the final draw leaves the clear boundary; undoing clear restores prior scene.
    expect(resolveScene(history.slice(0, -1))).toEqual([]);
    expect(resolveScene(history.slice(0, -2)).map((item) => item.id)).toEqual(['shape']);
  });

  test('returns detached scene geometry so consumers cannot mutate the operation log', () => {
    const original = draw('brush');
    const scene = resolveScene([original]);

    scene[0].points[0].x = 999;

    expect(original.points[0].x).toBe(0);
  });

  test('materializes missing style while preserving captured per-item values', () => {
    const history: UndoableHistoryItem[] = [
      draw(undefined, DrawingTool.Paintbrush),
      {
        ...draw('shape', DrawingTool.Circle),
        shapeFillMode: ShapeFillMode.Outline,
        style: { lineThickness: 7, color: 'red', shapeFillMode: ShapeFillMode.Filled },
      },
    ];

    const materialized = materializeDrawableStyles(history, {
      lineThickness: 20,
      color: 'white',
      shapeFillMode: ShapeFillMode.Outline,
    });

    expect(materialized[0]).toEqual(expect.objectContaining({
      id: 'history-item-1',
      style: { lineThickness: 20, color: 'white' },
    }));
    expect(materialized[1]).toEqual(expect.objectContaining({
      style: { lineThickness: 7, color: 'red', shapeFillMode: ShapeFillMode.Filled },
    }));
  });

  test('normalizes legacy bezier points and replays one undoable path update', () => {
    const legacy: UndoableHistoryItem = {
      id: 'curve',
      action: DrawingTool.Bezier,
      points: [{ x: 0, y: 0 }, { x: 0, y: 50 }, { x: 100, y: 50 }, { x: 100, y: 0 }],
    };
    const normalized = resolveScene([legacy])[0];
    expect(normalized.action).toBe(DrawingTool.Bezier);
    if (normalized.action !== DrawingTool.Bezier || !normalized.path) throw new Error('Missing path');
    const nextPath = {
      ...normalized.path,
      anchors: normalized.path.anchors.map((anchor, index) => index === 0
        ? { ...anchor, point: { x: 10, y: 20 } }
        : anchor),
    };
    const update = createUpdatePathHistoryItem('curve', normalized.path, nextPath);

    expect(resolveScene([legacy, update])[0]).toEqual(expect.objectContaining({ path: nextPath }));
    expect(resolveScene([legacy])[0]).toEqual(expect.objectContaining({ path: normalized.path }));
  });

  test('preserves transforms following a legacy four-point bezier command', () => {
    const fromPoints = [{ x: 0, y: 0 }, { x: 0, y: 50 }, { x: 100, y: 50 }, { x: 100, y: 0 }];
    const toPoints = fromPoints.map((point) => ({ x: point.x + 25, y: point.y + 10 }));
    const scene = resolveScene([
      { id: 'curve', action: DrawingTool.Bezier, points: fromPoints },
      { action: HistoryAction.Move, points: [], itemId: 'curve', fromPoints, toPoints },
    ]);

    expect(scene[0].action === DrawingTool.Bezier ? scene[0].path?.anchors.map((anchor) => anchor.point) : null)
      .toEqual([{ x: 25, y: 10 }, { x: 125, y: 10 }]);
  });
});
