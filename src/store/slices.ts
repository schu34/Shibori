import { AppConfig, DrawingTool, FoldState, DiagonalDirection } from '../types';
import { UndoableHistoryItem } from '../types/DrawingMode';

// Persistent application settings
export interface AppSettingsState {
    config: AppConfig;
    canvasDimensions: {
        width: number;
        height: number;
    };
}

// Drawing tool configuration  
export interface DrawingConfigState {
    currentTool: DrawingTool;
    circleRadius: number;
    lineThickness: number;
}

// Folding configuration
export interface FoldingState {
    folds: FoldState;
}

// Drawing session state (transient)
export interface DrawingSessionState {
    isDrawing: boolean;
    lineStartPoint: { x: number; y: number } | null;
    currentStrokePoints: { x: number; y: number }[];
}

// Canvas history
export interface CanvasHistoryState {
    history: UndoableHistoryItem[];
}

// Application control state (UI/system state)
export interface AppControlState {
    redrawTrigger: number;
    isLoadingFromUrl: boolean;
}

// Default values for each slice
export const DEFAULT_APP_CONFIG: AppConfig = {
    maxFolds: 3,
    defaultCircleRadius: 40,
    circleColor: 'white',
    defaultLineThickness: 20,
    lineColor: 'white',
};

export const defaultAppSettings: AppSettingsState = {
    config: DEFAULT_APP_CONFIG,
    canvasDimensions: {
        width: 1600,
        height: 1600
    }
};

export const defaultDrawingConfig: DrawingConfigState = {
    currentTool: DrawingTool.Paintbrush,
    circleRadius: DEFAULT_APP_CONFIG.defaultCircleRadius,
    lineThickness: DEFAULT_APP_CONFIG.defaultLineThickness,
};

export const defaultFoldingState: FoldingState = {
    folds: {
        vertical: 1,
        horizontal: 1,
        diagonal: {
            enabled: false,
            count: 1,
            direction: DiagonalDirection.TopRightToBottomLeft
        }
    }
};

export const defaultDrawingSession: DrawingSessionState = {
    isDrawing: false,
    lineStartPoint: null,
    currentStrokePoints: [],
};

export const defaultCanvasHistory: CanvasHistoryState = {
    history: [],
};

export const defaultAppControl: AppControlState = {
    redrawTrigger: 0,
    isLoadingFromUrl: false,
};

// Combined state interface (maintains compatibility)
export interface OrganizedState {
    appSettings: AppSettingsState;
    drawingConfig: DrawingConfigState;
    folding: FoldingState;
    drawingSession: DrawingSessionState;
    canvasHistory: CanvasHistoryState;
    appControl: AppControlState;
}

export const defaultOrganizedState: OrganizedState = {
    appSettings: defaultAppSettings,
    drawingConfig: defaultDrawingConfig,
    folding: defaultFoldingState,
    drawingSession: defaultDrawingSession,
    canvasHistory: defaultCanvasHistory,
    appControl: defaultAppControl,
};