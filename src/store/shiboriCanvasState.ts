import type { UnknownAction } from '@reduxjs/toolkit';
import { AppConfig, DrawingTool, ShapeFillMode, FoldState, DiagonalDirection, HistoryAction } from '../types';
import { Point, UndoableHistoryItem } from '../types/DrawingMode';
import {
    normalizeSerializableStateFromUnknown
} from '../utils/urlStateUtils';
import type { SerializableState } from '../utils/urlStateUtils';
import { logger } from '../utils/logger';
import { assignHistoryItemId, ensureHistoryItemIds } from '../utils/historyOperations';

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
    shapeFillMode: ShapeFillMode;
    currentTool: DrawingTool;
    history: UndoableHistoryItem[];
    folds: FoldState;
    canvasDimensions: {
        width: number;
        height: number;
    };
    selectedHistoryItemId: string | null;
    selectionDragDelta: { x: number; y: number } | null;
    selectionRotationPreview: { angle: number; center: Point } | null;
}

// Initial state
export const initialState: State = {
    config: DEFAULT_CONFIG,
    circleRadius: DEFAULT_CONFIG.defaultCircleRadius,
    lineThickness: DEFAULT_CONFIG.defaultLineThickness,
    shapeFillMode: ShapeFillMode.Filled,
    currentTool: DrawingTool.Paintbrush,
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
    selectedHistoryItemId: null,
    selectionDragDelta: null,
    selectionRotationPreview: null
};

// Action types enum
export enum ActionType {
    SET_CIRCLE_RADIUS = 'SET_CIRCLE_RADIUS',
    SET_LINE_THICKNESS = 'SET_LINE_THICKNESS',
    SET_SHAPE_FILL_MODE = 'SET_SHAPE_FILL_MODE',
    SET_CURRENT_TOOL = 'SET_CURRENT_TOOL',
    UPDATE_FOLD = 'UPDATE_FOLD',
    TOGGLE_DIAGONAL_FOLD = 'TOGGLE_DIAGONAL_FOLD',
    UPDATE_DIAGONAL_FOLD_COUNT = 'UPDATE_DIAGONAL_FOLD_COUNT',
    UPDATE_DIAGONAL_FOLD_DIRECTION = 'UPDATE_DIAGONAL_FOLD_DIRECTION',
    RESET_FOLDS = 'RESET_FOLDS',
    SET_CANVAS_DIMENSIONS = 'SET_CANVAS_DIMENSIONS',
    ADD_HISTORY_ITEM = 'ADD_HISTORY_ITEM',
    UNDO = 'UNDO',
    SET_SELECTED_HISTORY_ITEM_ID = 'SET_SELECTED_HISTORY_ITEM_ID',
    SET_SELECTION_DRAG_DELTA = 'SET_SELECTION_DRAG_DELTA',
    SET_SELECTION_ROTATION_PREVIEW = 'SET_SELECTION_ROTATION_PREVIEW',
    CLEAR_SELECTION = 'CLEAR_SELECTION',
    LOAD_STATE_FROM_URL = 'LOAD_STATE_FROM_URL',
    RESET_TO_INITIAL = 'RESET_TO_INITIAL'
}

// Action type definitions
export type Action =
    | { type: ActionType.SET_CIRCLE_RADIUS, payload: number }
    | { type: ActionType.SET_LINE_THICKNESS, payload: number }
    | { type: ActionType.SET_SHAPE_FILL_MODE, payload: ShapeFillMode }
    | { type: ActionType.SET_CURRENT_TOOL, payload: DrawingTool }
    | { type: ActionType.UPDATE_FOLD, payload: { axis: 'vertical' | 'horizontal', value: number } }
    | { type: ActionType.TOGGLE_DIAGONAL_FOLD, payload: boolean }
    | { type: ActionType.UPDATE_DIAGONAL_FOLD_COUNT, payload: number }
    | { type: ActionType.UPDATE_DIAGONAL_FOLD_DIRECTION, payload: DiagonalDirection }
    | { type: ActionType.RESET_FOLDS }
    | { type: ActionType.SET_CANVAS_DIMENSIONS, payload: { width: number; height: number } }
    | { type: ActionType.ADD_HISTORY_ITEM, payload: UndoableHistoryItem }
    | { type: ActionType.UNDO }
    | { type: ActionType.SET_SELECTED_HISTORY_ITEM_ID, payload: string | null }
    | { type: ActionType.SET_SELECTION_DRAG_DELTA, payload: { x: number; y: number } | null }
    | { type: ActionType.SET_SELECTION_ROTATION_PREVIEW, payload: { angle: number; center: Point } | null }
    | { type: ActionType.CLEAR_SELECTION }
    | { type: ActionType.LOAD_STATE_FROM_URL, payload: SerializableState }
    | { type: ActionType.RESET_TO_INITIAL };

// Untrusted shared documents are validated at the URL-load boundary. Internal
// actions enforce only the focused invariants they own.
export function reducer(state: State = initialState, reduxAction: Action | UnknownAction): State {
    const action = reduxAction as Action;
    // Debug all actions that could affect history
    if (action.type === ActionType.LOAD_STATE_FROM_URL || 
        action.type === ActionType.UNDO ||
        action.type === ActionType.ADD_HISTORY_ITEM ||
        state.history.length > 0) {
        logger.redux.action(`REDUCER: ${action.type}`, {
            inputHistoryLength: state.history.length
        });
    }

    let newState: State;
    
    switch (action.type) {
        case ActionType.SET_CIRCLE_RADIUS:
            newState = {
                ...state,
                circleRadius: clampFinite(action.payload, 1, 200, state.circleRadius)
            };
            break;
        case ActionType.SET_LINE_THICKNESS:
            newState = {
                ...state,
                lineThickness: clampFinite(action.payload, 1, 100, state.lineThickness)
            };
            break;
        case ActionType.SET_SHAPE_FILL_MODE:
            newState = { ...state, shapeFillMode: action.payload };
            break;
        case ActionType.SET_CURRENT_TOOL:
            newState = {
                ...state,
                currentTool: action.payload,
                selectedHistoryItemId: action.payload === DrawingTool.SelectMove ? state.selectedHistoryItemId : null,
                selectionDragDelta: action.payload === DrawingTool.SelectMove ? state.selectionDragDelta : null,
                selectionRotationPreview: action.payload === DrawingTool.SelectMove ? state.selectionRotationPreview : null
            };
            break;
        case ActionType.UPDATE_FOLD: {
            const maxFolds = state.config?.maxFolds || 3;
            const currentValue = state.folds[action.payload.axis];
            const clampedValue = Math.floor(
                clampFinite(action.payload.value, 0, maxFolds, currentValue)
            );
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
            const newCount = Math.floor(
                clampFinite(action.payload, 0, 1, state.folds.diagonal.count)
            );

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
        case ActionType.SET_CANVAS_DIMENSIONS: {
            // Validate and clamp canvas dimensions
            const clampedWidth = clampFinite(
                action.payload.width,
                100,
                3200,
                state.canvasDimensions.width
            );
            const clampedHeight = clampFinite(
                action.payload.height,
                100,
                3200,
                state.canvasDimensions.height
            );
            newState = {
                ...state,
                canvasDimensions: {
                    width: clampedWidth,
                    height: clampedHeight
                }
            };
            break;
        }
        case ActionType.ADD_HISTORY_ITEM:
            newState = {
                ...state,
                history: [
                    ...state.history,
                    assignHistoryItemId(action.payload, state.history)
                ],
                selectedHistoryItemId: action.payload.action === HistoryAction.Clear ||
                    action.payload.action === HistoryAction.Delete
                    ? null
                    : state.selectedHistoryItemId,
                selectionDragDelta: null,
                selectionRotationPreview: null
            };
            break;
        case ActionType.UNDO:
            newState = {
                ...state,
                history: state.history.slice(0, -1),
                selectionDragDelta: null,
                selectionRotationPreview: null
            };
            break;
        case ActionType.SET_SELECTED_HISTORY_ITEM_ID:
            newState = {
                ...state,
                selectedHistoryItemId: action.payload,
                selectionDragDelta: null,
                selectionRotationPreview: null
            };
            break;
        case ActionType.SET_SELECTION_DRAG_DELTA:
            newState = {
                ...state,
                selectionDragDelta: action.payload,
                selectionRotationPreview: null
            };
            break;
        case ActionType.SET_SELECTION_ROTATION_PREVIEW:
            newState = {
                ...state,
                selectionDragDelta: null,
                selectionRotationPreview: action.payload
            };
            break;
        case ActionType.CLEAR_SELECTION:
            newState = {
                ...state,
                selectedHistoryItemId: null,
                selectionDragDelta: null,
                selectionRotationPreview: null
            };
            break;
        case ActionType.LOAD_STATE_FROM_URL: {
            const loadedState = normalizeSerializableStateFromUnknown(action.payload);
            if (!loadedState) {
                logger.warn('Rejected invalid shared state at Redux boundary', {
                    component: 'Reducer',
                    data: { action: action.type }
                });
                return state;
            }

            logger.redux.action('LOAD_STATE_FROM_URL', {
                historyLength: loadedState.history.length,
                firstHistoryItem: loadedState.history[0] || null,
                folds: loadedState.folds,
                currentTool: loadedState.currentTool
            });
            
            newState = {
                ...state,
                history: ensureHistoryItemIds(loadedState.history),
                folds: loadedState.folds,
                canvasDimensions: loadedState.canvasDimensions,
                circleRadius: loadedState.circleRadius,
                lineThickness: loadedState.lineThickness,
                shapeFillMode: loadedState.shapeFillMode,
                currentTool: loadedState.currentTool,
                selectedHistoryItemId: null,
                selectionDragDelta: null,
                selectionRotationPreview: null
            };
            
            logger.redux.action('LOAD_STATE_FROM_URL result', {
                resultHistoryLength: newState.history.length
            });
            break;
        }
        case ActionType.RESET_TO_INITIAL:
            newState = {
                ...initialState
            };
            break;
        default:
            newState = state;
            break;
    }

    // Structural changes atomically discard commands that were authored in a
    // different fold/dimension coordinate system. URL loading is intentionally
    // excluded because its structure and history arrive as one validated unit.
    if (isStructuralAction(action) && hasStructuralChange(state, newState)) {
        newState = {
            ...newState,
            history: [],
            selectedHistoryItemId: null,
            selectionDragDelta: null,
            selectionRotationPreview: null,
        };
    }

    // Log state changes in development
    if (process.env.NODE_ENV === 'development' && newState !== state) {
        logger.redux.stateChange('State updated', {
            action: action.type,
            hasChanges: true
        });
    }
    
    return newState;
}

function isStructuralAction(action: Action): boolean {
    return action.type === ActionType.UPDATE_FOLD
        || action.type === ActionType.TOGGLE_DIAGONAL_FOLD
        || action.type === ActionType.UPDATE_DIAGONAL_FOLD_COUNT
        || action.type === ActionType.UPDATE_DIAGONAL_FOLD_DIRECTION
        || action.type === ActionType.RESET_FOLDS
        || action.type === ActionType.SET_CANVAS_DIMENSIONS;
}

function hasStructuralChange(previous: State, next: State): boolean {
    return previous.canvasDimensions.width !== next.canvasDimensions.width
        || previous.canvasDimensions.height !== next.canvasDimensions.height
        || previous.folds.vertical !== next.folds.vertical
        || previous.folds.horizontal !== next.folds.horizontal
        || previous.folds.diagonal.enabled !== next.folds.diagonal.enabled
        || previous.folds.diagonal.count !== next.folds.diagonal.count
        || previous.folds.diagonal.direction !== next.folds.diagonal.direction;
}

function clampFinite(value: number, min: number, max: number, fallback: number): number {
    return Number.isFinite(value)
        ? Math.max(min, Math.min(max, value))
        : fallback;
}
