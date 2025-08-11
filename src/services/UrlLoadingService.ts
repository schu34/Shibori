import { Dispatch } from 'react';
import { ActionType, Action } from '../store/shiboriCanvasState';
import { decodeStateFromUrl, SerializableState } from '../utils/urlStateUtils';
import { logger } from '../utils/logger';

/**
 * Service responsible for handling URL-based state loading
 * Extracts URL loading logic from components for better separation of concerns
 */
export class UrlLoadingService {
    /**
     * Processes a shared URL parameter and loads the state into Redux
     * @param urlParam - The base64 encoded state parameter from the URL
     * @param dispatch - Redux dispatch function
     * @returns Promise that resolves when loading is complete
     */
    static async loadStateFromUrl(urlParam: string, dispatch: Dispatch<Action>): Promise<void> {
        logger.url.load('UrlLoadingService processing shared URL parameter', { 
            paramLength: urlParam.length 
        });

        try {
            // Decode the URL parameter to state
            const decodedState: SerializableState = decodeStateFromUrl(urlParam);
            
            if (!decodedState) {
                logger.url.load('failed to decode URL parameter, using default state');
                return;
            }

            logger.url.load('successfully decoded shared state', {
                historyLength: decodedState.history?.length || 0,
                folds: decodedState.folds,
                canvasDimensions: decodedState.canvasDimensions,
                currentTool: decodedState.currentTool
            });

            // Load the state into Redux - this will trigger canvas redraw
            dispatch({
                type: ActionType.LOAD_STATE_FROM_URL,
                payload: decodedState
            });

        } catch (error) {
            logger.error('Failed to load state from URL', error as Error, {
                component: 'UrlLoadingService',
                data: { urlParam: urlParam.slice(0, 50) + '...' } // Log first 50 chars for debugging
            });
        }
    }

    /**
     * Cleans up URL parameters after successful loading
     * @param currentUrl - The current window location
     * @returns void
     */
    static cleanupUrlParameter(currentUrl: Location): void {
        if (currentUrl.search.includes('shared=')) {
            logger.url.load('cleaning up URL parameter after successful load');
            
            // Create new URL without the shared parameter
            const url = new URL(currentUrl.href);
            url.searchParams.delete('shared');
            
            // Update browser URL without causing a page reload
            window.history.replaceState({}, document.title, url.toString());
            
            logger.url.load('URL parameter cleaned up successfully');
        }
    }

    /**
     * Checks if the current URL contains a shared state parameter
     * @param currentUrl - The current window location
     * @returns The shared parameter value if present, null otherwise
     */
    static getSharedParameterFromUrl(currentUrl: Location): string | null {
        const urlParams = new URLSearchParams(currentUrl.search);
        const sharedParam = urlParams.get('shared');
        
        if (sharedParam) {
            logger.url.load('found shared parameter in URL', { 
                paramLength: sharedParam.length 
            });
            return sharedParam;
        }
        
        return null;
    }

    /**
     * Validates that a URL parameter looks like valid base64 encoded state
     * @param param - The URL parameter to validate
     * @returns True if the parameter appears valid
     */
    static validateUrlParameter(param: string): boolean {
        if (!param || typeof param !== 'string') {
            return false;
        }

        // Check if it looks like base64
        const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
        if (!base64Pattern.test(param)) {
            logger.url.load('URL parameter does not match base64 pattern');
            return false;
        }

        // Check minimum length (base64 encoded JSON should be reasonably long)
        if (param.length < 50) {
            logger.url.load('URL parameter too short to be valid state');
            return false;
        }

        return true;
    }
}