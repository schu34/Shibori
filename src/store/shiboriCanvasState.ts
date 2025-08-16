import { AppConfig, DrawingTool, FoldState, DiagonalDirection } from '../types';
import { UndoableHistoryItem } from '../types/DrawingMode';
import { SerializableState } from '../utils/urlStateUtils';
import { sanitizeState, validateState } from './stateValidation';
import { logger } from '../utils/logger';

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
    redrawTrigger: number; // Used to trigger canvas redraws
    isLoadingFromUrl: boolean; // Flag to prevent history clearing during URL loads
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
            enabled: true,
            count: 1,
            direction: DiagonalDirection.TopRightToBottomLeft
        }
    },
    canvasDimensions: {
        width: 1600,
        height: 1600
    },
    history: [],
    redrawTrigger: 0,
    isLoadingFromUrl: false
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
    CLEAR_UNDO_HISTORY = 'CLEAR_UNDO_HISTORY',
    LOAD_STATE_FROM_URL = 'LOAD_STATE_FROM_URL',
    RESET_TO_INITIAL = 'RESET_TO_INITIAL',
    REDRAW_FROM_HISTORY = 'REDRAW_FROM_HISTORY',
    FINISH_URL_LOADING = 'FINISH_URL_LOADING'
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
    | { type: ActionType.CLEAR_UNDO_HISTORY }
    | { type: ActionType.LOAD_STATE_FROM_URL, payload: SerializableState }
    | { type: ActionType.RESET_TO_INITIAL }
    | { type: ActionType.REDRAW_FROM_HISTORY }
    | { type: ActionType.FINISH_URL_LOADING };

// Reducer function with state validation
export function reducer(state: State, action: Action): State {
    // Validate incoming state
    if (!validateState(state)) {
        logger.warn('Invalid state detected, sanitizing', {
            component: 'Reducer',
            data: { action: action.type }
        });
        state = sanitizeState(state);
    }

    // Debug all actions that could affect history
    if (action.type === ActionType.LOAD_STATE_FROM_URL || 
        action.type === ActionType.CLEAR_UNDO_HISTORY ||
        action.type === ActionType.UNDO ||
        action.type === ActionType.ADD_HISTORY_ITEM ||
        state.history.length > 0) {
        logger.redux.action(`REDUCER: ${action.type}`, {
            inputHistoryLength: state.history.length,
            isLoadingFromUrl: state.isLoadingFromUrl,
            redrawTrigger: state.redrawTrigger
        });
    }

    let newState: State;
    
    switch (action.type) {
        case ActionType.SET_CIRCLE_RADIUS:
            newState = { ...state, circleRadius: Math.max(1, Math.min(200, action.payload)) };
            break;
        case ActionType.SET_LINE_THICKNESS:
            newState = { ...state, lineThickness: Math.max(1, Math.min(100, action.payload)) };
            break;
        case ActionType.SET_CURRENT_TOOL:
            newState = { ...state, currentTool: action.payload };
            break;
        case ActionType.SET_IS_DRAWING:
            newState = { ...state, isDrawing: action.payload };
            break;
        case ActionType.SET_LINE_START_POINT:
            newState = { ...state, lineStartPoint: action.payload };
            break;
        case ActionType.ADD_STROKE_POINT:
            newState = { ...state, currentStrokePoints: [...state.currentStrokePoints, action.payload] };
            break;
        case ActionType.CLEAR_STROKE_POINTS:
            newState = { ...state, currentStrokePoints: [] };
            break;
        case ActionType.UPDATE_FOLD: {
            const maxFolds = state.config?.maxFolds || 3;
            const clampedValue = Math.max(0, Math.min(maxFolds, action.payload.value));
            const newFolds = {
                ...state.folds,
                [action.payload.axis]: clampedValue
            };

            // Check if canvas will be square after this update
            const newVertical = action.payload.axis === 'vertical' ? clampedValue : state.folds.vertical;
            const newHorizontal = action.payload.axis === 'horizontal' ? clampedValue : state.folds.horizontal;
            const isSquare = newVertical === newHorizontal;

            // If not square, disable diagonal folds; if becoming square, restore default diagonal state
            if (!isSquare) {
                newFolds.diagonal = {
                    ...state.folds.diagonal,
                    enabled: false,
                    count: 0
                };
            } else if (isSquare && !state.folds.diagonal.enabled) {
                // If canvas becomes square and diagonal folding was disabled, restore it to default state
                newFolds.diagonal = {
                    ...state.folds.diagonal,
                    enabled: true,
                    count: 1
                };
            }
            // Keep diagonal folds unchanged if canvas was already square

            newState = {
                ...state,
                folds: newFolds
            };
            break;
        }
        case ActionType.TOGGLE_DIAGONAL_FOLD: {
            // Don't enable diagonal folds if canvas isn't square
            const isSquare = state.folds.vertical === state.folds.horizontal;
            const canEnable = action.payload && isSquare;

            newState = {
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
            break;
        }
        case ActionType.UPDATE_DIAGONAL_FOLD_COUNT: {
            // Enforce only one diagonal fold
            const newCount = Math.max(0, Math.min(1, action.payload));

            newState = {
                ...state,
                folds: {
                    ...state.folds,
                    diagonal: {
                        ...state.folds.diagonal,
                        count: newCount,
                        // Auto-enable diagonal folding when count > 0, disable when count = 0
                        enabled: newCount > 0
                    }
                },
            };
            break;
        }
        case ActionType.UPDATE_DIAGONAL_FOLD_DIRECTION:
            newState = {
                ...state,
                folds: {
                    ...state.folds,
                    diagonal: {
                        ...state.folds.diagonal,
                        direction: action.payload
                    }
                },
            };
            break;
        case ActionType.RESET_FOLDS:
            newState = {
                ...state,
                folds: {
                    ...initialState.folds
                },
            };
            break;
        case ActionType.SET_CANVAS_DIMENSIONS:
            // Validate and clamp canvas dimensions
            const clampedWidth = Math.max(100, Math.min(3200, action.payload.width));
            const clampedHeight = Math.max(100, Math.min(3200, action.payload.height));
            newState = {
                ...state,
                canvasDimensions: {
                    width: clampedWidth,
                    height: clampedHeight
                }
            };
            break;
        case ActionType.ADD_HISTORY_ITEM:
            newState = {
                ...state,
                history: [...state.history, action.payload]
            };
            break;
        case ActionType.UNDO:
            newState = {
                ...state,
                history: state.history.slice(0, -1)
            };
            break;
        case ActionType.CLEAR_UNDO_HISTORY:
            logger.redux.action('CLEAR_UNDO_HISTORY', {
                currentHistoryLength: state.history.length,
                isLoadingFromUrl: state.isLoadingFromUrl,
                redrawTrigger: state.redrawTrigger
            });
            
            // Don't clear history during URL loading to preserve loaded history
            if (state.isLoadingFromUrl && state.history.length > 0) {
                logger.redux.action('PREVENTING history clear during URL loading', {
                    historyLength: state.history.length,
                    isLoadingFromUrl: state.isLoadingFromUrl
                });
                newState = state; // No change
            } else {
                newState = {
                    ...state,
                    history: []
                };
            }
            break;
        case ActionType.LOAD_STATE_FROM_URL:
            logger.redux.action('LOAD_STATE_FROM_URL', {
                historyLength: action.payload.history?.length || 0,
                firstHistoryItem: action.payload.history?.[0] || null,
                folds: action.payload.folds,
                currentTool: action.payload.currentTool
            });
            
            newState = {
                ...state,
                history: action.payload.history || [],
                folds: action.payload.folds,
                canvasDimensions: action.payload.canvasDimensions,
                circleRadius: Math.max(1, Math.min(200, action.payload.circleRadius || state.circleRadius)),
                lineThickness: Math.max(1, Math.min(100, action.payload.lineThickness || state.lineThickness)),
                currentTool: action.payload.currentTool || state.currentTool,
                // Reset transient drawing state
                isDrawing: false,
                lineStartPoint: null,
                currentStrokePoints: [],
                // Increment redraw trigger to force canvas redraw
                redrawTrigger: state.redrawTrigger + 1,
                // Mark that we're loading from URL to prevent history clearing
                isLoadingFromUrl: true
            };
            
            logger.redux.action('LOAD_STATE_FROM_URL result', {
                resultHistoryLength: newState.history.length,
                resultRedrawTrigger: newState.redrawTrigger,
                resultIsLoadingFromUrl: newState.isLoadingFromUrl
            });
            break;
        case ActionType.RESET_TO_INITIAL:
            newState = {
                ...initialState
            };
            break;
        case ActionType.REDRAW_FROM_HISTORY:
            newState = {
                ...state,
                redrawTrigger: state.redrawTrigger + 1
            };
            break;
        case ActionType.FINISH_URL_LOADING:
            newState = {
                ...state,
                isLoadingFromUrl: false
            };
            break;
        default:
            newState = state;
            break;
    }

    // Validate the new state before returning
    const validatedState = sanitizeState(newState);
    
    // Log state changes in development
    if (process.env.NODE_ENV === 'development' && newState !== state) {
        logger.redux.stateChange('State updated', {
            action: action.type,
            hasChanges: true
        });
    }
    
    return validatedState;
} 
