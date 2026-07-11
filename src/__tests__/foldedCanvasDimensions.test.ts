import { getFoldedCanvasDimensions } from '../utils/foldedCanvasDimensions';

describe('getFoldedCanvasDimensions', () => {
  const dimensions = { width: 1600, height: 1600 };

  test('keeps matching fold counts at full backing resolution', () => {
    expect(getFoldedCanvasDimensions(dimensions, { vertical: 3, horizontal: 3 }))
      .toEqual({ width: 1600, height: 1600 });
  });

  test('makes unmatched horizontal folds short and wide', () => {
    expect(getFoldedCanvasDimensions(dimensions, { vertical: 0, horizontal: 3 }))
      .toEqual({ width: 1600, height: 200 });
  });

  test('makes unmatched vertical folds tall and narrow', () => {
    expect(getFoldedCanvasDimensions(dimensions, { vertical: 3, horizontal: 0 }))
      .toEqual({ width: 200, height: 1600 });
  });

  test('preserves the unfolded canvas aspect ratio before applying unmatched folds', () => {
    expect(getFoldedCanvasDimensions(
      { width: 1200, height: 800 },
      { vertical: 1, horizontal: 3 }
    )).toEqual({ width: 1200, height: 200 });
  });
});
