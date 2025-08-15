import { State } from './shiboriCanvasState';
import { OrganizedState } from './slices';
import { logger } from '../utils/logger';

/**
 * Converts the new organized state structure back to the old flat structure
 * This maintains compatibility with existing components and hooks
 */
export function organizedStateToFlatState(organizedState: OrganizedState): State {
    return {
        // App settings
        config: organizedState.appSettings.config,
        canvasDimensions: organizedState.appSettings.canvasDimensions,
        
        // Drawing config
        currentTool: organizedState.drawingConfig.currentTool,
        circleRadius: organizedState.drawingConfig.circleRadius,
        lineThickness: organizedState.drawingConfig.lineThickness,
        
        // Folding
        folds: organizedState.folding.folds,
        
        // Drawing session
        isDrawing: organizedState.drawingSession.isDrawing,
        lineStartPoint: organizedState.drawingSession.lineStartPoint,
        currentStrokePoints: organizedState.drawingSession.currentStrokePoints,
        
        // History
        history: organizedState.canvasHistory.history,
        
        // Control
        redrawTrigger: organizedState.appControl.redrawTrigger,
        isLoadingFromUrl: organizedState.appControl.isLoadingFromUrl,
    };
}

/**
 * Converts the old flat state structure to the new organized structure
 * Used when migrating or for backwards compatibility
 */
export function flatStateToOrganizedState(flatState: State): OrganizedState {
    logger.redux.stateChange('Converting flat state to organized state');
    
    return {
        appSettings: {
            config: flatState.config,
            canvasDimensions: flatState.canvasDimensions,
        },
        drawingConfig: {
            currentTool: flatState.currentTool,
            circleRadius: flatState.circleRadius,
            lineThickness: flatState.lineThickness,
        },
        folding: {
            folds: flatState.folds,
        },
        drawingSession: {
            isDrawing: flatState.isDrawing,
            lineStartPoint: flatState.lineStartPoint,
            currentStrokePoints: flatState.currentStrokePoints,
        },
        canvasHistory: {
            history: flatState.history,
        },
        appControl: {
            redrawTrigger: flatState.redrawTrigger,
            isLoadingFromUrl: flatState.isLoadingFromUrl,
        },
    };
}