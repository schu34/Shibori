import { DrawingTool, HistoryAction } from '../types';
import { initialState, ActionType, reducer } from '../store/shiboriCanvasState';
import { UndoableHistoryItem } from '../types/DrawingMode';
import { buildDrawableHistory, createMoveHistoryItem, createRotateHistoryItem } from '../utils/historyOperations';

const makeHistoryItem = (x: number): UndoableHistoryItem => ({
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
            history: [makeHistoryItem(10)]
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

    test('loaded URL history is backfilled with drawable ids', () => {
        const loaded = reducer(initialState, {
            type: ActionType.LOAD_STATE_FROM_URL,
            payload: {
                history: [makeHistoryItem(10)],
                folds: initialState.folds,
                canvasDimensions: initialState.canvasDimensions,
                circleRadius: initialState.circleRadius,
                lineThickness: initialState.lineThickness,
                shapeFillMode: initialState.shapeFillMode,
                currentTool: initialState.currentTool,
            }
        });

        expect(loaded.history[0].id).toBe('history-item-1');
        expect(loaded.selectedHistoryItemId).toBeNull();
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
