import { DrawingModeFactory } from '../drawingModes/DrawingModeFactory';
import { DrawingTool, ShapeFillMode } from '../types';
import { UndoableHistoryItem } from '../types/DrawingMode';

const options = { lineThickness: 10, hitTolerance: 2 };

describe('drawing mode geometry', () => {
  test.each([
    DrawingTool.Line,
    DrawingTool.Paintbrush,
    DrawingTool.Rectangle,
    DrawingTool.Square,
    DrawingTool.Circle,
  ])('%s exposes geometry', (tool) => {
    expect(DrawingModeFactory.getGeometry(tool)).toEqual({
      hitTest: expect.any(Function),
      getBounds: expect.any(Function),
      translate: expect.any(Function),
    });
  });

  test('select/move has no drawable geometry', () => {
    expect(() => DrawingModeFactory.getGeometry(DrawingTool.SelectMove)).toThrow('no drawable geometry');
  });

  test('line geometry hit tests, bounds, and translates', () => {
    const item: UndoableHistoryItem = {
      id: 'line',
      action: DrawingTool.Line,
      points: [{ x: 10, y: 10 }, { x: 110, y: 10 }],
    };
    const geometry = DrawingModeFactory.getGeometry(DrawingTool.Line);

    expect(geometry.hitTest(item, { x: 50, y: 12 }, options)).toBe(true);
    expect(geometry.hitTest(item, { x: 50, y: 40 }, options)).toBe(false);
    expect(geometry.getBounds(item, options)).toEqual({ minX: 5, minY: 5, maxX: 115, maxY: 15 });
    expect(geometry.translate(item, { x: 4, y: -2 }).points).toEqual([
      { x: 14, y: 8 },
      { x: 114, y: 8 },
    ]);
  });

  test('paintbrush geometry hit tests a polyline and translates', () => {
    const item: UndoableHistoryItem = {
      id: 'brush',
      action: DrawingTool.Paintbrush,
      points: [{ x: 10, y: 10 }, { x: 60, y: 60 }, { x: 110, y: 10 }],
    };
    const geometry = DrawingModeFactory.getGeometry(DrawingTool.Paintbrush);

    expect(geometry.hitTest(item, { x: 60, y: 55 }, options)).toBe(true);
    expect(geometry.hitTest(item, { x: 60, y: 90 }, options)).toBe(false);
    expect(geometry.translate(item, { x: -10, y: 10 }).points[0]).toEqual({ x: 0, y: 20 });
  });

  test('rectangle geometry respects filled and outline modes', () => {
    const filled: UndoableHistoryItem = {
      id: 'rect-filled',
      action: DrawingTool.Rectangle,
      shapeFillMode: ShapeFillMode.Filled,
      points: [{ x: 10, y: 20 }, { x: 110, y: 80 }],
    };
    const outline = { ...filled, id: 'rect-outline', shapeFillMode: ShapeFillMode.Outline };
    const geometry = DrawingModeFactory.getGeometry(DrawingTool.Rectangle);

    expect(geometry.hitTest(filled, { x: 50, y: 50 }, options)).toBe(true);
    expect(geometry.hitTest(outline, { x: 50, y: 50 }, options)).toBe(false);
    expect(geometry.hitTest(outline, { x: 10, y: 50 }, options)).toBe(true);
  });

  test('rectangle geometry hit tests and bounds rotated rectangles', () => {
    const item: UndoableHistoryItem = {
      id: 'rect-rotated',
      action: DrawingTool.Rectangle,
      shapeFillMode: ShapeFillMode.Filled,
      points: [{ x: 0, y: 0 }, { x: 100, y: 20 }],
      rotation: Math.PI / 2,
      rotationCenter: { x: 50, y: 10 },
    };
    const geometry = DrawingModeFactory.getGeometry(DrawingTool.Rectangle);

    expect(geometry.hitTest(item, { x: 50, y: 50 }, options)).toBe(true);
    expect(geometry.hitTest(item, { x: 90, y: 10 }, options)).toBe(false);
    expect(geometry.getBounds(item, options)).toEqual({
      minX: 35,
      minY: -45,
      maxX: 65,
      maxY: 65,
    });
  });

  test('square geometry uses the rendered square bounds', () => {
    const item: UndoableHistoryItem = {
      id: 'square',
      action: DrawingTool.Square,
      shapeFillMode: ShapeFillMode.Filled,
      points: [{ x: 20, y: 20 }, { x: 120, y: 80 }],
    };
    const geometry = DrawingModeFactory.getGeometry(DrawingTool.Square);

    expect(geometry.hitTest(item, { x: 70, y: 70 }, options)).toBe(true);
    expect(geometry.hitTest(item, { x: 110, y: 70 }, options)).toBe(false);
  });

  test('circle geometry respects filled and outline modes', () => {
    const filled: UndoableHistoryItem = {
      id: 'circle-filled',
      action: DrawingTool.Circle,
      shapeFillMode: ShapeFillMode.Filled,
      points: [{ x: 100, y: 100 }, { x: 150, y: 100 }],
    };
    const outline = { ...filled, id: 'circle-outline', shapeFillMode: ShapeFillMode.Outline };
    const geometry = DrawingModeFactory.getGeometry(DrawingTool.Circle);

    expect(geometry.hitTest(filled, { x: 110, y: 100 }, options)).toBe(true);
    expect(geometry.hitTest(outline, { x: 110, y: 100 }, options)).toBe(false);
    expect(geometry.hitTest(outline, { x: 150, y: 100 }, options)).toBe(true);
  });
});
