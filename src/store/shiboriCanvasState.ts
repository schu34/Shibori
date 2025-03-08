import { AppConfig, DrawingTool, FoldState } from '../types';

// Default configuration values
export const DEFAULT_CONFIG: AppConfig = {
    unfoldedCanvasWidth: 400,
    unfoldedCanvasHeight: 400,
    maxFolds: 3,
    defaultCircleRadius: 20,
    circleColor: 'white',
    defaultLineThickness: 2,
    lineColor: 'white',
    debounceDelay: 15
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
        vertical: 2,
        horizontal: 2
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
        case 'UPDATE_FOLD':
            return {
                ...state,
                folds: {
                    ...state.folds,
                    [action.payload.axis]: action.payload.value
                }
            };
        case 'RESET_FOLDS':
            return {
                ...state,
                folds: { vertical: 1, horizontal: 1 }
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