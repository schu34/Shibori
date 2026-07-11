import { bootstrapSharedState } from '../services/bootstrapSharedState';
import { createAppStore } from '../store';
import { initialState } from '../store/shiboriCanvasState';
import { DrawingTool } from '../types';
import { encodeStateToUrl } from '../utils/urlStateUtils';

describe('shared-state bootstrap', () => {
  test('dispatches valid state before synchronously cleaning the URL', () => {
    const encoded = encodeStateToUrl({
      history: [{
        id: 'shared-line',
        action: DrawingTool.Line,
        points: [{ x: 1, y: 1 }, { x: 9, y: 9 }],
        style: { lineThickness: 17, color: 'white' },
      }],
      folds: initialState.folds,
      canvasDimensions: initialState.canvasDimensions,
      circleRadius: initialState.circleRadius,
      lineThickness: 17,
      shapeFillMode: initialState.shapeFillMode,
      currentTool: DrawingTool.Line,
    });
    const appStore = createAppStore();
    const order: string[] = [];
    const dispatch = jest.fn((action) => {
      order.push('dispatch');
      return appStore.dispatch(action);
    });
    const replaceState = jest.fn(() => order.push('cleanup'));
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    const loaded = bootstrapSharedState(
      { href: `https://example.test/app?shared=${encoded}&keep=1`, search: `?shared=${encoded}&keep=1` },
      { replaceState },
      'Shibori',
      dispatch
    );

    expect(loaded).toBe(true);
    expect(order).toEqual(['dispatch', 'cleanup']);
    expect(appStore.getState().shibori.history[0]).toEqual(expect.objectContaining({ id: 'shared-line' }));
    expect(replaceState).toHaveBeenCalledWith({}, 'Shibori', 'https://example.test/app?keep=1');
    expect(setTimeoutSpy).not.toHaveBeenCalled();
    setTimeoutSpy.mockRestore();
  });

  test('does not dispatch or clean an invalid shared parameter', () => {
    const dispatch = jest.fn();
    const replaceState = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const loaded = bootstrapSharedState(
      { href: 'https://example.test/?shared=invalid', search: '?shared=invalid' },
      { replaceState },
      'Shibori',
      dispatch
    );

    expect(loaded).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });
});
