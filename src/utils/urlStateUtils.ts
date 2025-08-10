import { State } from '../store/shiboriCanvasState';
import { DrawingTool, FoldState } from '../types';
import { UndoableHistoryItem } from '../types/DrawingMode';

// Interface for the subset of state we want to encode in URLs
export interface SerializableState {
    history: UndoableHistoryItem[];
    folds: FoldState;
    canvasDimensions: {
        width: number;
        height: number;
    };
    circleRadius: number;
    lineThickness: number;
    currentTool: DrawingTool;
}

// Extract serializable state from full application state
export function extractSerializableState(state: State): SerializableState {
    return {
        history: state.history,
        folds: state.folds,
        canvasDimensions: state.canvasDimensions,
        circleRadius: state.circleRadius,
        lineThickness: state.lineThickness,
        currentTool: state.currentTool,
    };
}

// Encode state to URL-safe base64 string
export function encodeStateToUrl(state: SerializableState): string {
    try {
        const jsonString = JSON.stringify(state);
        // Use btoa for base64 encoding, but make it URL-safe
        const base64 = btoa(jsonString);
        // Replace URL-unsafe characters
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    } catch (error) {
        console.error('Failed to encode state to URL:', error);
        return '';
    }
}

// Decode URL parameter back to state
export function decodeStateFromUrl(encodedState: string): SerializableState | null {
    try {
        // Restore base64 padding and URL-unsafe characters
        let base64 = encodedState.replace(/-/g, '+').replace(/_/g, '/');
        // Add padding if needed
        while (base64.length % 4) {
            base64 += '=';
        }
        
        const jsonString = atob(base64);
        const parsed = JSON.parse(jsonString);
        
        // Validate the decoded state structure
        if (!isValidSerializableState(parsed)) {
            console.warn('Invalid state structure in URL parameter');
            return null;
        }
        
        return parsed as SerializableState;
    } catch (error) {
        console.error('Failed to decode state from URL:', error);
        return null;
    }
}

// Validate that the decoded object has the expected structure
function isValidSerializableState(obj: unknown): obj is SerializableState {
    if (!obj || typeof obj !== 'object') return false;
    
    // Type assertion after checking it's an object
    const candidate = obj as Record<string, unknown>;
    
    // Check required properties exist
    if (!Array.isArray(candidate.history)) return false;
    if (!candidate.folds || typeof candidate.folds !== 'object') return false;
    if (!candidate.canvasDimensions || typeof candidate.canvasDimensions !== 'object') return false;
    if (typeof candidate.circleRadius !== 'number') return false;
    if (typeof candidate.lineThickness !== 'number') return false;
    if (!Object.values(DrawingTool).includes(candidate.currentTool as DrawingTool)) return false;
    
    // Validate folds structure
    const folds = candidate.folds as Record<string, unknown>;
    if (typeof folds.vertical !== 'number' || 
        typeof folds.horizontal !== 'number' ||
        !folds.diagonal || 
        typeof folds.diagonal !== 'object') {
        return false;
    }
    
    const diagonal = folds.diagonal as Record<string, unknown>;
    if (typeof diagonal.enabled !== 'boolean' ||
        typeof diagonal.count !== 'number') {
        return false;
    }
    
    // Validate canvas dimensions
    const canvasDimensions = candidate.canvasDimensions as Record<string, unknown>;
    if (typeof canvasDimensions.width !== 'number' ||
        typeof canvasDimensions.height !== 'number') {
        return false;
    }
    
    // Validate history items structure
    const history = candidate.history as unknown[];
    for (const item of history) {
        if (!item || typeof item !== 'object') return false;
        
        const historyItem = item as Record<string, unknown>;
        if (!Object.values(DrawingTool).includes(historyItem.action as DrawingTool) ||
            !Array.isArray(historyItem.points)) {
            return false;
        }
        
        // Validate points in each history item
        for (const point of historyItem.points) {
            if (!point || typeof point !== 'object') return false;
            
            const pointObj = point as Record<string, unknown>;
            if (typeof pointObj.x !== 'number' ||
                typeof pointObj.y !== 'number') {
                return false;
            }
        }
    }
    
    return true;
}

// Generate a shareable URL with current state
export function generateShareableUrl(state: SerializableState, baseUrl: string = window.location.origin): string {
    const encodedState = encodeStateToUrl(state);
    if (!encodedState) {
        return baseUrl; // Return base URL if encoding fails
    }
    
    const url = new URL(baseUrl);
    url.searchParams.set('shared', encodedState);
    return url.toString();
}

// Extract shared state from current URL
export function getSharedStateFromCurrentUrl(): SerializableState | null {
    const urlParams = new URLSearchParams(window.location.search);
    const encodedState = urlParams.get('shared');
    
    if (!encodedState) {
        return null;
    }
    
    return decodeStateFromUrl(encodedState);
}

// Clear the shared parameter from URL without page reload
export function clearSharedParamFromUrl(): void {
    if (window.history && window.history.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.delete('shared');
        window.history.replaceState({}, document.title, url.toString());
    }
}