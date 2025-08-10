import { State } from './shiboriCanvasState';
import { DrawingTool, DiagonalDirection } from '../types';
import { logger } from '../utils/logger';

/**
 * Validates that the state is in a consistent and valid format
 * This helps catch state corruption and provides better debugging
 */
export function validateState(state: State): boolean {
    const errors: string[] = [];

    // Validate basic structure
    if (!state || typeof state !== 'object') {
        errors.push('State is not an object');
        return false;
    }

    // Validate canvas dimensions
    if (!state.canvasDimensions || 
        typeof state.canvasDimensions.width !== 'number' ||
        typeof state.canvasDimensions.height !== 'number' ||
        state.canvasDimensions.width <= 0 ||
        state.canvasDimensions.height <= 0) {
        errors.push('Invalid canvas dimensions');
    }

    // Validate folds
    if (!state.folds) {
        errors.push('Folds state missing');
    } else {
        if (typeof state.folds.vertical !== 'number' || 
            state.folds.vertical < 0 || 
            state.folds.vertical > (state.config?.maxFolds || 3)) {
            errors.push('Invalid vertical folds');
        }
        if (typeof state.folds.horizontal !== 'number' || 
            state.folds.horizontal < 0 || 
            state.folds.horizontal > (state.config?.maxFolds || 3)) {
            errors.push('Invalid horizontal folds');
        }
        if (state.folds.diagonal && 
            typeof state.folds.diagonal.count !== 'number' ||
            state.folds.diagonal.count < 0 || 
            state.folds.diagonal.count > 1) {
            errors.push('Invalid diagonal folds');
        }
    }

    // Validate drawing tool
    if (!Object.values(DrawingTool).includes(state.currentTool)) {
        errors.push('Invalid current tool');
    }

    // Validate tool settings
    if (typeof state.circleRadius !== 'number' || state.circleRadius <= 0) {
        errors.push('Invalid circle radius');
    }
    if (typeof state.lineThickness !== 'number' || state.lineThickness <= 0) {
        errors.push('Invalid line thickness');
    }

    // Validate history
    if (!Array.isArray(state.history)) {
        errors.push('History is not an array');
    }

    // Validate drawing session state
    if (typeof state.isDrawing !== 'boolean') {
        errors.push('isDrawing must be boolean');
    }
    if (state.lineStartPoint !== null && 
        (typeof state.lineStartPoint.x !== 'number' || 
         typeof state.lineStartPoint.y !== 'number')) {
        errors.push('Invalid line start point');
    }
    if (!Array.isArray(state.currentStrokePoints)) {
        errors.push('currentStrokePoints must be an array');
    }

    // Validate control state
    if (typeof state.redrawTrigger !== 'number') {
        errors.push('redrawTrigger must be a number');
    }
    if (typeof state.isLoadingFromUrl !== 'boolean') {
        errors.push('isLoadingFromUrl must be boolean');
    }

    if (errors.length > 0) {
        logger.error('State validation failed', new Error('Invalid state'), {
            component: 'StateValidation',
            data: { errors, state }
        });
        return false;
    }

    return true;
}

/**
 * Sanitizes state values to ensure they're within valid ranges
 * Returns a cleaned copy of the state
 */
export function sanitizeState(state: State): State {
    const sanitized = { ...state };

    // Sanitize canvas dimensions
    if (sanitized.canvasDimensions) {
        sanitized.canvasDimensions.width = Math.max(100, Math.min(3200, sanitized.canvasDimensions.width));
        sanitized.canvasDimensions.height = Math.max(100, Math.min(3200, sanitized.canvasDimensions.height));
    }

    // Sanitize folds
    const maxFolds = sanitized.config?.maxFolds || 3;
    if (sanitized.folds) {
        sanitized.folds.vertical = Math.max(0, Math.min(maxFolds, Math.floor(sanitized.folds.vertical || 0)));
        sanitized.folds.horizontal = Math.max(0, Math.min(maxFolds, Math.floor(sanitized.folds.horizontal || 0)));
        if (sanitized.folds.diagonal) {
            sanitized.folds.diagonal.count = Math.max(0, Math.min(1, Math.floor(sanitized.folds.diagonal.count || 0)));
        }
    }

    // Sanitize tool settings
    sanitized.circleRadius = Math.max(1, Math.min(200, sanitized.circleRadius || 40));
    sanitized.lineThickness = Math.max(1, Math.min(100, sanitized.lineThickness || 20));

    // Ensure valid tool
    if (!Object.values(DrawingTool).includes(sanitized.currentTool)) {
        sanitized.currentTool = DrawingTool.Paintbrush;
    }

    // Sanitize control values
    sanitized.redrawTrigger = Math.max(0, sanitized.redrawTrigger || 0);
    
    // Ensure boolean values
    sanitized.isDrawing = Boolean(sanitized.isDrawing);
    sanitized.isLoadingFromUrl = Boolean(sanitized.isLoadingFromUrl);

    // Ensure arrays
    if (!Array.isArray(sanitized.history)) {
        sanitized.history = [];
    }
    if (!Array.isArray(sanitized.currentStrokePoints)) {
        sanitized.currentStrokePoints = [];
    }

    logger.redux.stateChange('State sanitized', { originalValid: validateState(state) });

    return sanitized;
}

/**
 * Creates a safe state selector that validates the state before returning it
 * This helps prevent crashes from corrupted state
 */
export function createSafeSelector<T>(selector: (state: State) => T, fallback: T) {
    return (state: State): T => {
        try {
            if (validateState(state)) {
                return selector(state);
            }
            logger.warn('Using fallback due to invalid state', {
                component: 'SafeSelector',
                data: { fallback }
            });
            return fallback;
        } catch (error) {
            logger.error('Selector threw error, using fallback', error as Error, {
                component: 'SafeSelector',
                data: { fallback }
            });
            return fallback;
        }
    };
}