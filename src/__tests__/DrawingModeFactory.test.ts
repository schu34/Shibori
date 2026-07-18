import { DrawingModeFactory } from '../drawingModes/DrawingModeFactory';
import { DrawingTool } from '../types';
import { DrawableDrawingTool } from '../types/DrawingMode';

describe('DrawingModeFactory', () => {
  beforeEach(() => DrawingModeFactory.clearInstances());

  test.each([
    [DrawingTool.Paintbrush, 'PaintbrushMode'],
    [DrawingTool.Line, 'LineMode'],
    [DrawingTool.Rectangle, 'RectangleMode'],
    [DrawingTool.Square, 'SquareMode'],
    [DrawingTool.Circle, 'CircleMode'],
    [DrawingTool.Bezier, 'BezierMode'],
  ] satisfies Array<[DrawableDrawingTool, string]>)('creates %s with %s', (tool, expectedModeName) => {
    expect(DrawingModeFactory.getTool(tool).constructor.name).toBe(expectedModeName);
  });

  test('caches one drawing mode per drawable tool', () => {
    const first = DrawingModeFactory.getTool(DrawingTool.Paintbrush);
    expect(DrawingModeFactory.getTool(DrawingTool.Paintbrush)).toBe(first);

    DrawingModeFactory.clearInstances();
    expect(DrawingModeFactory.getTool(DrawingTool.Paintbrush)).not.toBe(first);
  });

  test('rejects unknown tools', () => {
    expect(() => DrawingModeFactory.getTool('unknown' as DrawableDrawingTool))
      .toThrow('Unknown drawing tool: unknown');
  });
});
