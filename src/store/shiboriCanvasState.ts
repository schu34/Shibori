import { AppConfig, DrawingTool, FoldState, DiagonalDirection } from '../types';

// Default configuration values
export const DEFAULT_CONFIG: AppConfig = {
    unfoldedCanvasWidth: 800,
    unfoldedCanvasHeight: 800,
    maxFolds: 3,
    defaultCircleRadius: 20,
    circleColor: 'white',
    defaultLineThickness: 4,
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
    currentTool: DrawingTool.Circle,
    isDrawing: false,
    lineStartPoint: null,
    folds: {
        vertical: 1,
        horizontal: 1,
        diagonal: {
            enabled: false,
            count: 1,
            direction: DiagonalDirection.TopLeftToBottomRight
        }
    },
    canvasDimensions: {
        width: DEFAULT_CONFIG.unfoldedCanvasWidth,
        height: DEFAULT_CONFIG.unfoldedCanvasHeight
    }
};

// Define action types
export type Action =
    | { type: 'SET_CIRCLE_RADIUS', payload: number }
    | { type: 'SET_LINE_THICKNESS', payload: number }
    | { type: 'SET_CURRENT_TOOL', payload: DrawingTool }
    | { type: 'SET_IS_DRAWING', payload: boolean }
    | { type: 'SET_LINE_START_POINT', payload: { x: number; y: number } | null }
    | { type: 'UPDATE_FOLD', payload: { axis: 'vertical' | 'horizontal', value: number } }
    | { type: 'TOGGLE_DIAGONAL_FOLD', payload: boolean }
    | { type: 'UPDATE_DIAGONAL_FOLD_COUNT', payload: number }
    | { type: 'UPDATE_DIAGONAL_FOLD_DIRECTION', payload: DiagonalDirection }
    | { type: 'RESET_FOLDS' }
    | { type: 'SET_CANVAS_DIMENSIONS', payload: { width: number; height: number } }
    | { type: 'UPDATE_CANVAS_WIDTH', payload: number }
    | { type: 'UPDATE_CANVAS_HEIGHT', payload: number };

// Reducer function
export function reducer(state: State, action: Action): State {
    switch (action.type) {
        case 'SET_CIRCLE_RADIUS':
            return { ...state, circleRadius: action.payload };
        case 'SET_LINE_THICKNESS':
            return { ...state, lineThickness: action.payload };
        case 'SET_CURRENT_TOOL':
            return { ...state, currentTool: action.payload };
        case 'SET_IS_DRAWING':
            return { ...state, isDrawing: action.payload };
        case 'SET_LINE_START_POINT':
            return { ...state, lineStartPoint: action.payload };
        case 'UPDATE_FOLD': {
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
        case 'TOGGLE_DIAGONAL_FOLD': {
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
        case 'UPDATE_DIAGONAL_FOLD_COUNT': {
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
                }
            };
        }
        case 'UPDATE_DIAGONAL_FOLD_DIRECTION':
            return {
                ...state,
                folds: {
                    ...state.folds,
                    diagonal: {
                        ...state.folds.diagonal,
                        direction: action.payload
                    }
                }
            };
        case 'RESET_FOLDS':
            return {
                ...state,
                folds: {
                    ...initialState.folds
                }
            };
        case 'SET_CANVAS_DIMENSIONS':
            return {
                ...state,
                canvasDimensions: action.payload
            };
        case 'UPDATE_CANVAS_WIDTH':
            return {
                ...state,
                canvasDimensions: {
                    ...state.canvasDimensions,
                    width: action.payload
                }
            };
        case 'UPDATE_CANVAS_HEIGHT':
            return {
                ...state,
                canvasDimensions: {
                    ...state.canvasDimensions,
                    height: action.payload
                }
            };
        default:
            return state;
    }
} 