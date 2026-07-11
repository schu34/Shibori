import { DrawingTool, HistoryAction } from '../types';
import { initialState, ActionType, reducer } from '../store/shiboriCanvasState';
import { DrawableHistoryItem, UndoableHistoryItem } from '../types/DrawingMode';
import {
    buildDrawableHistory,
    createDeleteHistoryItem,
    createMoveHistoryItem,
    createRotateHistoryItem
} from '../utils/historyOperations';
import { SHARE_SCHEMA_VERSION } from '../utils/urlStateUtils';
import type { SerializableState } from '../utils/urlStateUtils';
import { createAppStore } from '../store';

const makeHistoryItem = (x: number): DrawableHistoryItem => ({
    action: DrawingTool.Paintbrush,
    points: [
        { x, y: x },
        { x: x + 10, y: x + 10 }
    ]
});

describe('shiboriCanvasState reducer', () => {
    test('clear is undoable while still separating later undo from pre-clear strokes', () => {
        const beforeClear = {
            ...initialState,
            history: [{ ...makeHistoryItem(10), id: 'history-item-1' }]
        };

        const afterClear = reducer(beforeClear, {
            type: ActionType.ADD_HISTORY_ITEM,
            payload: { action: HistoryAction.Clear, points: [] }
        });
        expect(afterClear.history).toEqual([
            expect.objectContaining({ ...makeHistoryItem(10), id: 'history-item-1' }),
            { action: HistoryAction.Clear, points: [] }
        ]);

        const afterNewStroke = reducer(afterClear, {
            type: ActionType.ADD_HISTORY_ITEM,
            payload: makeHistoryItem(80)
        });

        const afterUndoNewStroke = reducer(afterNewStroke, { type: ActionType.UNDO });
        expect(afterUndoNewStroke.history).toEqual([
            expect.objectContaining({ ...makeHistoryItem(10), id: 'history-item-1' }),
            { action: HistoryAction.Clear, points: [] }
        ]);

        const afterUndoClear = reducer(afterUndoNewStroke, { type: ActionType.UNDO });
        expect(afterUndoClear.history).toEqual([
            expect.objectContaining({ ...makeHistoryItem(10), id: 'history-item-1' })
        ]);
    });

    test('new drawable history items receive stable ids', () => {
        const next = reducer(initialState, {
            type: ActionType.ADD_HISTORY_ITEM,
            payload: makeHistoryItem(10)
        });

        expect(next.history[0]).toEqual(expect.objectContaining({
            id: 'history-item-1',
            action: DrawingTool.Paintbrush,
        }));
    });

    test('loaded URL history preserves validated drawable ids', () => {
        const sharedItem: DrawableHistoryItem = {
            ...makeHistoryItem(10),
            id: 'shared-item',
            style: {
                lineThickness: initialState.lineThickness,
                color: initialState.config.lineColor,
            },
        };
        const loaded = reducer(initialState, {
            type: ActionType.LOAD_STATE_FROM_URL,
            payload: {
                version: SHARE_SCHEMA_VERSION,
                history: [sharedItem],
                folds: initialState.folds,
                canvasDimensions: initialState.canvasDimensions,
                circleRadius: initialState.circleRadius,
                lineThickness: initialState.lineThickness,
                shapeFillMode: initialState.shapeFillMode,
                currentTool: initialState.currentTool,
            }
        });

        expect(loaded.history[0].id).toBe('shared-item');
        expect(loaded.selectedHistoryItemId).toBeNull();
    });

    test('unknown Redux actions preserve state without globally sanitizing it', () => {
        const state = {
            ...initialState,
            lineThickness: 999,
        };

        const result = reducer(state, { type: 'third-party/unknown' });

        expect(result).toBe(state);
        expect(result.lineThickness).toBe(999);
    });

    test('ordinary internal actions enforce only their own invariant', () => {
        const state = {
            ...initialState,
            circleRadius: 999,
            canvasDimensions: { width: 4000, height: 4000 },
        };

        const result = reducer(state, {
            type: ActionType.SET_LINE_THICKNESS,
            payload: 500,
        });

        expect(result.lineThickness).toBe(100);
        expect(result.circleRadius).toBe(999);
        expect(result.canvasDimensions).toEqual({ width: 4000, height: 4000 });
    });

    test('numeric actions cannot introduce non-finite values', () => {
        const radius = reducer(initialState, {
            type: ActionType.SET_CIRCLE_RADIUS,
            payload: Number.NaN,
        });
        const thickness = reducer(initialState, {
            type: ActionType.SET_LINE_THICKNESS,
            payload: Number.POSITIVE_INFINITY,
        });
        const fold = reducer(initialState, {
            type: ActionType.UPDATE_FOLD,
            payload: { axis: 'vertical', value: Number.NaN },
        });
        const diagonal = reducer(initialState, {
            type: ActionType.UPDATE_DIAGONAL_FOLD_COUNT,
            payload: Number.NEGATIVE_INFINITY,
        });
        const dimensions = reducer(initialState, {
            type: ActionType.SET_CANVAS_DIMENSIONS,
            payload: {
                width: Number.NaN,
                height: Number.POSITIVE_INFINITY,
            },
        });

        expect(radius.circleRadius).toBe(initialState.circleRadius);
        expect(thickness.lineThickness).toBe(initialState.lineThickness);
        expect(fold.folds.vertical).toBe(initialState.folds.vertical);
        expect(diagonal.folds.diagonal.count).toBe(initialState.folds.diagonal.count);
        expect(dimensions.canvasDimensions).toEqual(initialState.canvasDimensions);
    });

    test('fold actions retain their integer invariant', () => {
        const result = reducer(initialState, {
            type: ActionType.UPDATE_FOLD,
            payload: { axis: 'vertical', value: 2.9 },
        });

        expect(result.folds.vertical).toBe(2);
    });

    test.each([
        {
            name: 'fold',
            action: { type: ActionType.UPDATE_FOLD, payload: { axis: 'vertical' as const, value: 2 } },
        },
        {
            name: 'canvas dimensions',
            action: { type: ActionType.SET_CANVAS_DIMENSIONS, payload: { width: 800, height: 900 } },
        },
    ])('$name changes atomically reset history and selection', ({ action }) => {
        const state = {
            ...initialState,
            history: [{ ...makeHistoryItem(10), id: 'selected' }],
            selectedHistoryItemId: 'selected',
            selectionDragDelta: { x: 2, y: 3 },
        };

        const result = reducer(state, action);

        expect(result.history).toEqual([]);
        expect(result.selectedHistoryItemId).toBeNull();
        expect(result.selectionDragDelta).toBeNull();
    });

    test('tool and style changes preserve history', () => {
        const history = [{ ...makeHistoryItem(10), id: 'draw-1' }];
        const withTool = reducer({ ...initialState, history }, {
            type: ActionType.SET_CURRENT_TOOL,
            payload: DrawingTool.Line,
        });
        const withStyle = reducer(withTool, {
            type: ActionType.SET_LINE_THICKNESS,
            payload: 44,
        });

        expect(withStyle.history).toBe(history);
    });

    test('malformed external state is rejected at the URL-load boundary', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const malformedPayload = {
            version: SHARE_SCHEMA_VERSION,
            history: 'not-an-array',
        };

        const result = reducer(initialState, {
            type: ActionType.LOAD_STATE_FROM_URL,
            payload: malformedPayload as unknown as SerializableState,
        });

        expect(result).toBe(initialState);
        warn.mockRestore();
    });

    test('createAppStore accepts isolated preloaded state under the shibori namespace', () => {
        const preloaded = {
            ...initialState,
            lineThickness: 73,
        };
        const appStore = createAppStore({ shibori: preloaded });

        expect(appStore.getState().shibori).toEqual(preloaded);

        appStore.dispatch({
            type: ActionType.SET_LINE_THICKNESS,
            payload: 101,
        });
        expect(appStore.getState().shibori.lineThickness).toBe(100);
    });

    test('move operations affect only the target drawable and are undoable', () => {
        const first = { ...makeHistoryItem(10), id: 'first' };
        const second = { ...makeHistoryItem(80), id: 'second' };
        const beforeMove = {
            ...initialState,
            history: [first, second],
            selectedHistoryItemId: 'first'
        };
        const move = createMoveHistoryItem('first', first.points, [
            { x: 15, y: 15 },
            { x: 25, y: 25 }
        ]);

        const afterMove = reducer(beforeMove, {
            type: ActionType.ADD_HISTORY_ITEM,
            payload: move
        });
        const movedDrawables = buildDrawableHistory(afterMove.history);

        expect(movedDrawables.find((item) => item.id === 'first')?.points).toEqual(move.toPoints);
        expect(movedDrawables.find((item) => item.id === 'second')?.points).toEqual(second.points);

        const afterUndo = reducer(afterMove, { type: ActionType.UNDO });
        expect(buildDrawableHistory(afterUndo.history).find((item) => item.id === 'first')?.points)
            .toEqual(first.points);
    });

    test('rotate operations affect only the target drawable and are undoable', () => {
        const first: UndoableHistoryItem = {
            action: DrawingTool.Rectangle,
            id: 'first',
            points: [{ x: 0, y: 0 }, { x: 100, y: 20 }],
        };
        const second = { ...makeHistoryItem(80), id: 'second' };
        const beforeRotate = {
            ...initialState,
            history: [first, second],
            selectedHistoryItemId: 'first'
        };
        const rotate = createRotateHistoryItem(
            first as typeof first & { id: string; action: DrawingTool.Rectangle },
            Math.PI / 2,
            { x: 50, y: 10 }
        );

        const afterRotate = reducer(beforeRotate, {
            type: ActionType.ADD_HISTORY_ITEM,
            payload: rotate
        });
        const rotatedDrawables = buildDrawableHistory(afterRotate.history);

        expect(rotatedDrawables.find((item) => item.id === 'first')).toEqual(expect.objectContaining({
            points: first.points,
            rotation: Math.PI / 2,
            rotationCenter: { x: 50, y: 10 }
        }));
        expect(rotatedDrawables.find((item) => item.id === 'second')?.points).toEqual(second.points);

        const afterUndo = reducer(afterRotate, { type: ActionType.UNDO });
        expect(buildDrawableHistory(afterUndo.history).find((item) => item.id === 'first')).toEqual(first);
    });

    test('delete operations remove only the target drawable, clear selection, and are undoable', () => {
        const first = { ...makeHistoryItem(10), id: 'first' };
        const second = { ...makeHistoryItem(80), id: 'second' };
        const beforeDelete = {
            ...initialState,
            history: [first, second],
            selectedHistoryItemId: 'first'
        };

        const afterDelete = reducer(beforeDelete, {
            type: ActionType.ADD_HISTORY_ITEM,
            payload: createDeleteHistoryItem('first')
        });
        const remainingDrawables = buildDrawableHistory(afterDelete.history);

        expect(remainingDrawables.find((item) => item.id === 'first')).toBeUndefined();
        expect(remainingDrawables.find((item) => item.id === 'second')?.points).toEqual(second.points);
        expect(afterDelete.selectedHistoryItemId).toBeNull();

        const afterUndo = reducer(afterDelete, { type: ActionType.UNDO });
        expect(buildDrawableHistory(afterUndo.history).map((item) => item.id)).toEqual(['first', 'second']);
    });

    test('clear clears selection', () => {
        const afterClear = reducer({
            ...initialState,
            history: [{ ...makeHistoryItem(10), id: 'history-item-1' }],
            selectedHistoryItemId: 'history-item-1'
        }, {
            type: ActionType.ADD_HISTORY_ITEM,
            payload: { action: HistoryAction.Clear, points: [] }
        });

        expect(afterClear.selectedHistoryItemId).toBeNull();
    });
});
