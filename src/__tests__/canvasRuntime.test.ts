import { CanvasContext } from '../services/CanvasService';
import { initialState, reducer, ActionType } from '../store/shiboriCanvasState';
import { DrawingTool, HistoryAction } from '../types';
import { DrawableHistoryItem } from '../types/DrawingMode';
import {
  CanvasTransactionServices,
  renderCanvasTransaction,
} from '../rendering/canvasRuntime';
import { selectCanvasRuntimeState } from '../hooks/useCanvasRuntime';
import { createAppStore } from '../store';
import { createMoveHistoryItem } from '../utils/historyOperations';

function makeContext(): CanvasContext {
  return {
    foldedCanvas: { width: 100, height: 100 } as HTMLCanvasElement,
    unfoldedCanvas: { width: 100, height: 100 } as HTMLCanvasElement,
    foldedCtx: {} as CanvasRenderingContext2D,
    unfoldedCtx: {} as CanvasRenderingContext2D,
  };
}

function makeDrawable(id = 'draw-1'): DrawableHistoryItem {
  return {
    id,
    action: DrawingTool.Line,
    points: [{ x: 1, y: 2 }, { x: 3, y: 4 }],
    style: { lineThickness: 10, color: 'white' },
  };
}

function makeServices(order: string[]) {
  const services: CanvasTransactionServices = {
    clear: jest.fn(() => order.push('clear')),
    renderHistory: jest.fn(() => order.push('render')),
    drawFoldedGuidance: jest.fn(() => order.push('guidance')),
    mirror: jest.fn(() => order.push('mirror')),
  };
  return services;
}

describe('canvas runtime transaction', () => {
  test('unrelated control state is excluded from runtime subscriptions', () => {
    const appStore = createAppStore();
    const before = selectCanvasRuntimeState(appStore.getState());

    appStore.dispatch({ type: ActionType.SET_CIRCLE_RADIUS, payload: 91 });
    const after = selectCanvasRuntimeState(appStore.getState());

    expect(after).toEqual(before);
  });

  test('uses canonical ordering and mirrors exactly once for a committed scene', () => {
    const order: string[] = [];
    const services = makeServices(order);

    renderCanvasTransaction(makeContext(), {
      ...initialState,
      history: [makeDrawable()],
    }, services);

    expect(order).toEqual(['clear', 'render', 'guidance', 'mirror']);
    expect(services.mirror).toHaveBeenCalledTimes(1);
  });

  test('a scene ending in Clear leaves the unfolded canvas cleared', () => {
    const order: string[] = [];
    const services = makeServices(order);

    renderCanvasTransaction(makeContext(), {
      ...initialState,
      history: [makeDrawable(), { action: HistoryAction.Clear, points: [] }],
    }, services);

    expect(order).toEqual(['clear', 'render', 'guidance']);
    expect(services.mirror).not.toHaveBeenCalled();
  });

  test('undo and loaded-share state replay through the same transaction', () => {
    const first = makeDrawable('first');
    const second = makeDrawable('second');
    const loaded = reducer(initialState, {
      type: ActionType.LOAD_STATE_FROM_URL,
      payload: {
        version: 2,
        history: [first, second],
        folds: initialState.folds,
        canvasDimensions: initialState.canvasDimensions,
        circleRadius: initialState.circleRadius,
        lineThickness: initialState.lineThickness,
        shapeFillMode: initialState.shapeFillMode,
        currentTool: initialState.currentTool,
      },
    });
    const undone = reducer(loaded, { type: ActionType.UNDO });
    const services = makeServices([]);

    renderCanvasTransaction(makeContext(), undone, services);

    expect(services.renderHistory).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      [expect.objectContaining({ id: 'first' })],
      expect.anything()
    );
    expect(services.mirror).toHaveBeenCalledTimes(1);
  });

  test('transform preview overrides only the selected drawable without a command commit', () => {
    const selected = makeDrawable('selected');
    const other = makeDrawable('other');
    const move = createMoveHistoryItem(
      'selected',
      selected.points,
      selected.points.map((point) => ({ x: point.x + 5, y: point.y + 7 }))
    );
    const services = makeServices([]);

    renderCanvasTransaction(makeContext(), {
      ...initialState,
      history: [selected, other],
      preview: {
        selectedHistoryItemId: 'selected',
        selectionDragDelta: { x: 5, y: 7 },
        selectionRotationPreview: null,
      },
    }, services);

    const rendered = (services.renderHistory as jest.Mock).mock.calls[0][2] as DrawableHistoryItem[];
    expect(rendered.find((item) => item.id === 'selected')?.points).toEqual(move.toPoints);
    expect(rendered.find((item) => item.id === 'other')?.points).toEqual(other.points);
  });
});
