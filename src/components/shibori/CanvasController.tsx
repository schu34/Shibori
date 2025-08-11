import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { ActionType } from '../../store/shiboriCanvasState';
import { logger } from '../../utils/logger';

interface CanvasControllerProps {
    unfoldedCanvasRef: React.RefObject<HTMLCanvasElement>;
    foldedCanvasRef: React.RefObject<HTMLCanvasElement>;
    resetCanvases: () => void;
    drawFromHistory: (history: any[]) => void;
    updateUnfoldedCanvas: () => void;
}

/**
 * Manages canvas lifecycle, URL loading, and state synchronization
 * This component handles the complex orchestration of canvas operations
 */
export const CanvasController: React.FC<CanvasControllerProps> = ({
    unfoldedCanvasRef,
    foldedCanvasRef,
    resetCanvases,
    drawFromHistory,
    updateUnfoldedCanvas
}) => {
    const state = useAppSelector((state) => state.shibori);
    const dispatch = useAppDispatch();

    // Initialize canvases when dimensions or folds change
    useEffect(() => {
        // Don't reset canvases during URL loading - let the redraw trigger handle it
        if (!state.isLoadingFromUrl && state.redrawTrigger === 0) {
            logger.canvas.operation('initializing canvases due to dimension/fold change');
            resetCanvases();
        } else {
            logger.canvas.operation('skipping canvas reset during URL loading/redraw', {
                isLoadingFromUrl: state.isLoadingFromUrl,
                redrawTrigger: state.redrawTrigger
            });
        }
    }, [state.canvasDimensions, state.folds, resetCanvases, state.isLoadingFromUrl, state.redrawTrigger]);

    // Redraw canvas when redraw trigger changes (e.g., when loading from URL)
    useEffect(() => {
        if (state.redrawTrigger > 0 && state.history.length > 0) {
            logger.canvas.operation('redrawing from history due to redraw trigger', {
                redrawTrigger: state.redrawTrigger,
                historyLength: state.history.length
            });
            resetCanvases();
            drawFromHistory(state.history);
            updateUnfoldedCanvas();
        }
    }, [state.redrawTrigger, state.history, resetCanvases, drawFromHistory, updateUnfoldedCanvas]);

    // Handle canvas dimension updates and history management
    useEffect(() => {
        if (!unfoldedCanvasRef.current || !foldedCanvasRef.current) {
            return;
        }
        
        // Don't clear history during URL loading
        if (!state.isLoadingFromUrl) {
            logger.canvas.operation('clearing undo history', { isLoadingFromUrl: state.isLoadingFromUrl });
            dispatch({ type: ActionType.CLEAR_UNDO_HISTORY });
        } else {
            logger.canvas.operation('preserving history during URL load', {
                isLoadingFromUrl: state.isLoadingFromUrl,
                historyLength: state.history.length
            });
        }
        
        // Update canvas dimensions
        unfoldedCanvasRef.current.width = state.canvasDimensions.width;
        unfoldedCanvasRef.current.height = state.canvasDimensions.height;
        foldedCanvasRef.current.width = state.canvasDimensions.width / 2 ** state.folds.vertical;
        foldedCanvasRef.current.height = state.canvasDimensions.height / 2 ** state.folds.horizontal;
        logger.canvas.operation('updating canvas dimensions', state.canvasDimensions);

        // Reset canvases after dimension changes to ensure navy background is applied
        resetCanvases();
    }, [
        state.canvasDimensions, 
        unfoldedCanvasRef, 
        foldedCanvasRef, 
        state.folds.vertical, 
        state.folds.horizontal, 
        state.folds.diagonal, 
        resetCanvases, 
        dispatch, 
        state.isLoadingFromUrl
    ]);

    // Finish URL loading after canvas setup is complete
    useEffect(() => {
        if (state.isLoadingFromUrl && unfoldedCanvasRef.current && foldedCanvasRef.current) {
            logger.url.load('finishing URL loading after canvas setup', { 
                historyLength: state.history.length 
            });
            // Give a brief delay for canvas to be properly initialized
            const timeout = setTimeout(() => {
                dispatch({ type: ActionType.FINISH_URL_LOADING });
            }, 200); // Slightly longer delay to ensure canvas is ready
            return () => clearTimeout(timeout);
        }
    }, [state.isLoadingFromUrl, unfoldedCanvasRef, foldedCanvasRef, dispatch, state.history.length]);

    // This component renders nothing - it only manages canvas lifecycle
    return null;
};
