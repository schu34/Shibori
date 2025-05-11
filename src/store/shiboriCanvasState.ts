import { AppConfig, DrawingTool, FoldState, DiagonalDirection } from '../types';
import { UndoableHistoryItem } from '../types/DrawingMode';

// Default configuration values
export const DEFAULT_CONFIG: AppConfig = {
    maxFolds: 3,
    defaultCircleRadius: 40,
    circleColor: 'white',
    defaultLineThickness: 20,
    lineColor: 'white',
};

// Define the State interface
export interface State {
    config: AppConfig;
    circleRadius: number;
    lineThickness: number;
    currentTool: DrawingTool;
    isDrawing: boolean;
    lineStartPoint: { x: number; y: number } | null;
    currentStrokePoints: { x: number; y: number }[];
    history: UndoableHistoryItem[];
    folds: FoldState;
    canvasDimensions: {
        width: number;
        height: number;
    };
}

// Initial state
export const initialState: State = {
    config: DEFAULT_CONFIG,
    circleRadius: DEFAULT_CONFIG.defaultCircleRadius,
    lineThickness: DEFAULT_CONFIG.defaultLineThickness,
    currentTool: DrawingTool.Paintbrush,
    isDrawing: false,
    lineStartPoint: null,
    currentStrokePoints: [],
    folds: {
        vertical: 1,
        horizontal: 1,
        diagonal: {
            enabled: false,
            count: 1,
            direction: DiagonalDirection.TopRightToBottomLeft
        }
    },
    canvasDimensions: {
        width: 1600,
        height: 1600
    },
    history: []
};

// Action types enum
export enum ActionType {
    SET_CIRCLE_RADIUS = 'SET_CIRCLE_RADIUS',
    SET_LINE_THICKNESS = 'SET_LINE_THICKNESS',
    SET_CURRENT_TOOL = 'SET_CURRENT_TOOL',
    SET_IS_DRAWING = 'SET_IS_DRAWING',
    SET_LINE_START_POINT = 'SET_LINE_START_POINT',
    UPDATE_FOLD = 'UPDATE_FOLD',
    TOGGLE_DIAGONAL_FOLD = 'TOGGLE_DIAGONAL_FOLD',
    UPDATE_DIAGONAL_FOLD_COUNT = 'UPDATE_DIAGONAL_FOLD_COUNT',
    UPDATE_DIAGONAL_FOLD_DIRECTION = 'UPDATE_DIAGONAL_FOLD_DIRECTION',
    RESET_FOLDS = 'RESET_FOLDS',
    SET_CANVAS_DIMENSIONS = 'SET_CANVAS_DIMENSIONS',
    ADD_STROKE_POINT = 'ADD_STROKE_POINT',
    CLEAR_STROKE_POINTS = 'CLEAR_STROKE_POINTS',
    ADD_HISTORY_ITEM = 'ADD_HISTORY_ITEM',
    UNDO = 'UNDO',
    CLEAR_UNDO_HISTORY = 'CLEAR_UNDO_HISTORY'
}

// Action type definitions
export type Action =
    | { type: ActionType.SET_CIRCLE_RADIUS, payload: number }
    | { type: ActionType.SET_LINE_THICKNESS, payload: number }
    | { type: ActionType.SET_CURRENT_TOOL, payload: DrawingTool }
    | { type: ActionType.SET_IS_DRAWING, payload: boolean }
    | { type: ActionType.SET_LINE_START_POINT, payload: { x: number; y: number } | null }
    | { type: ActionType.UPDATE_FOLD, payload: { axis: 'vertical' | 'horizontal', value: number } }
    | { type: ActionType.TOGGLE_DIAGONAL_FOLD, payload: boolean }
    | { type: ActionType.UPDATE_DIAGONAL_FOLD_COUNT, payload: number }
    | { type: ActionType.UPDATE_DIAGONAL_FOLD_DIRECTION, payload: DiagonalDirection }
    | { type: ActionType.RESET_FOLDS }
    | { type: ActionType.SET_CANVAS_DIMENSIONS, payload: { width: number; height: number } }
    | { type: ActionType.ADD_STROKE_POINT, payload: { x: number; y: number } }
    | { type: ActionType.CLEAR_STROKE_POINTS }
    | { type: ActionType.ADD_HISTORY_ITEM, payload: UndoableHistoryItem }
    | { type: ActionType.UNDO }
    | { type: ActionType.CLEAR_UNDO_HISTORY };

// Reducer function
export function reducer(state: State, action: Action): State {
    switch (action.type) {
        case ActionType.SET_CIRCLE_RADIUS:
            return { ...state, circleRadius: action.payload };
        case ActionType.SET_LINE_THICKNESS:
            return { ...state, lineThickness: action.payload };
        case ActionType.SET_CURRENT_TOOL:
            return { ...state, currentTool: action.payload };
        case ActionType.SET_IS_DRAWING:
            return { ...state, isDrawing: action.payload };
        case ActionType.SET_LINE_START_POINT:
            return { ...state, lineStartPoint: action.payload };
        case ActionType.ADD_STROKE_POINT:
            return { ...state, currentStrokePoints: [...state.currentStrokePoints, action.payload] };
        case ActionType.CLEAR_STROKE_POINTS:
            return { ...state, currentStrokePoints: [] };
        case ActionType.UPDATE_FOLD: {
            const newFolds = {
                ...state.folds,
                [action.payload.axis]: action.payload.value
            };

            // Check if canvas is still square after this update
            const isSquare =
                (action.payload.axis === 'vertical' && action.payload.value === state.folds.horizontal) ||
                (action.payload.axis === 'horizontal' && action.payload.value === state.folds.vertical);

            // If not square, reset diagonal folds
            if (!isSquare) {
                newFolds.diagonal = {
                    ...state.folds.diagonal,
                    enabled: false,
                    count: 0
                };
            }

            return {
                ...state,
                folds: newFolds
            };
        }
        case ActionType.TOGGLE_DIAGONAL_FOLD: {
            // Don't enable diagonal folds if canvas isn't square
            const isSquare = state.folds.vertical === state.folds.horizontal;
            const canEnable = action.payload && isSquare;

            return {
                ...state,
                folds: {
                    ...state.folds,
                    diagonal: {
                        ...state.folds.diagonal,
                        enabled: canEnable,
                        // Reset count to 0 if disabling
                        count: canEnable ? state.folds.diagonal.count : 0
                    }
                }
            };
        }
        case ActionType.UPDATE_DIAGONAL_FOLD_COUNT: {
            // Enforce only one diagonal fold
            const newCount = action.payload > 1 ? 1 : action.payload;

            return {
                ...state,
                folds: {
                    ...state.folds,
                    diagonal: {
                        ...state.folds.diagonal,
                        count: newCount
                    }
                },
            };
        }
        case ActionType.UPDATE_DIAGONAL_FOLD_DIRECTION:
            return {
                ...state,
                folds: {
                    ...state.folds,
                    diagonal: {
                        ...state.folds.diagonal,
                        direction: action.payload
                    }
                },
            };
        case ActionType.RESET_FOLDS:
            return {
                ...state,
                folds: {
                    ...initialState.folds
                },
            };
        case ActionType.SET_CANVAS_DIMENSIONS:
            return {
                ...state,
                canvasDimensions: action.payload
            };
        case ActionType.ADD_HISTORY_ITEM:
            return {
                ...state,
                history: [...state.history, action.payload]
            };
        case ActionType.UNDO:
            return {
                ...state,
                history: state.history.slice(0, -1)
            };
        case ActionType.CLEAR_UNDO_HISTORY:
            return {
                ...state,
                history: []
            };
        default:
            return state;
    }
} 
