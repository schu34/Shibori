import {
  convertBezierAnchor,
  evaluateBezier,
  getBezierSegments,
  moveBezierHandle,
  splitBezierPathSegment,
} from '../utils/bezierPath';
import { BezierPath } from '../types/DrawingMode';

const path: BezierPath = {
  closed: false,
  anchors: [
    { id: 'a', point: { x: 0, y: 0 }, inHandle: null, outHandle: { x: 0, y: 100 }, kind: 'corner' },
    { id: 'b', point: { x: 100, y: 0 }, inHandle: { x: 100, y: 100 }, outHandle: null, kind: 'corner' },
  ],
};

describe('bezier path geometry', () => {
  test('de Casteljau insertion preserves the exact curve', () => {
    const splitAt = 0.37;
    const next = splitBezierPathSegment(path, 0, splitAt, 'inserted');
    const original = getBezierSegments(path)[0].points;
    const [left, right] = getBezierSegments(next);

    for (let index = 0; index <= 20; index++) {
      const t = index / 20;
      const expected = evaluateBezier(original, t);
      const actual = t <= splitAt
        ? evaluateBezier(left.points, t / splitAt)
        : evaluateBezier(right.points, (t - splitAt) / (1 - splitAt));
      expect(actual.x).toBeCloseTo(expected.x, 6);
      expect(actual.y).toBeCloseTo(expected.y, 6);
    }
  });

  test('smooth handle movement keeps the opposite handle collinear and preserves its length', () => {
    const smooth: BezierPath = {
      closed: false,
      anchors: [
        { id: 'a', point: { x: 50, y: 50 }, inHandle: { x: 20, y: 50 }, outHandle: { x: 80, y: 50 }, kind: 'smooth' },
        { id: 'b', point: { x: 120, y: 50 }, inHandle: null, outHandle: null, kind: 'corner' },
      ],
    };
    const moved = moveBezierHandle(smooth, 'a', 'out', { x: 50, y: 90 }, false);
    const anchor = moved.anchors[0];
    expect(anchor.inHandle?.x).toBeCloseTo(50);
    expect(anchor.inHandle?.y).toBeCloseTo(20);
    expect(anchor.kind).toBe('smooth');
  });

  test('conversion toggles between collapsed corner and mirrored smooth handles', () => {
    const smooth = convertBezierAnchor(path, 'a');
    expect(smooth.anchors[0].kind).toBe('smooth');
    expect(smooth.anchors[0].inHandle).not.toBeNull();
    expect(convertBezierAnchor(smooth, 'a').anchors[0]).toEqual(expect.objectContaining({
      kind: 'corner',
      inHandle: null,
      outHandle: null,
    }));
  });
});
