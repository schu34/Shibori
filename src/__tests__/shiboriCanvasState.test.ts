import { DrawingTool, HistoryAction } from '../types';
import { initialState, ActionType, reducer } from '../store/shiboriCanvasState';
import { UndoableHistoryItem } from '../types/DrawingMode';

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
            makeHistoryItem(10),
            { action: HistoryAction.Clear, points: [] }
        ]);

        const afterNewStroke = reducer(afterClear, {
            type: ActionType.ADD_HISTORY_ITEM,
            payload: makeHistoryItem(80)
        });

        const afterUndoNewStroke = reducer(afterNewStroke, { type: ActionType.UNDO });
        expect(afterUndoNewStroke.history).toEqual([
            makeHistoryItem(10),
            { action: HistoryAction.Clear, points: [] }
        ]);

        const afterUndoClear = reducer(afterUndoNewStroke, { type: ActionType.UNDO });
        expect(afterUndoClear.history).toEqual([makeHistoryItem(10)]);
    });
});
