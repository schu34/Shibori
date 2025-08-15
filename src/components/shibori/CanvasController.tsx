import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { ActionType } from '../../store/shiboriCanvasState';
import { useEffectDebugger } from '../../utils/debugging';
import { logger } from '../../utils/logger';
import { CanvasService } from '../../services/CanvasService';

interface CanvasControllerProps {
    unfoldedCanvasRef: React.RefObject<HTMLCanvasElement | null>;
    foldedCanvasRef: React.RefObject<HTMLCanvasElement | null>;
    foldedCtxRef: React.RefObject<CanvasRenderingContext2D | null>;
    unfoldedCtxRef: React.RefObject<CanvasRenderingContext2D | null>;
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
    foldedCtxRef,
    unfoldedCtxRef,
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

    // Only reset canvases when the actual canvas structure changes, not drawing state
    useEffectDebugger(() => {
        if (!unfoldedCanvasRef.current || !foldedCanvasRef.current) {
            return;
        }
        
        // Only reset if we're not currently drawing (to avoid clearing during drawing operations)
        if (state.isDrawing) {
            logger.canvas.operation('CanvasController: skipping reset during drawing');
            return;
        }
        
        logger.canvas.operation('CanvasController: canvas structural change, resetting');
        
        // Clear undo history for structural changes (unless loading from URL)
        if (!state.isLoadingFromUrl) {
            dispatch({ type: ActionType.CLEAR_UNDO_HISTORY });
        }
        
        // Update canvas dimensions using CanvasService
        unfoldedCanvasRef.current.width = state.canvasDimensions.width;
        unfoldedCanvasRef.current.height = state.canvasDimensions.height;
        
        // Re-initialize unfolded context after dimension change
        if (unfoldedCanvasRef.current) {
            const ctx = unfoldedCanvasRef.current.getContext("2d", {
                willReadFrequently: true,
            });
            unfoldedCtxRef.current = ctx;
            logger.canvas.operation("re-initialized unfolded canvas context after dimension change");
        }

        // Use CanvasService to properly handle folded canvas dimensions and context
        if (foldedCanvasRef.current && unfoldedCanvasRef.current && unfoldedCtxRef.current) {
            // Create temporary context for the service call
            const tempFoldedCtx = foldedCanvasRef.current.getContext("2d", {
                willReadFrequently: true,
            });
            
            if (tempFoldedCtx) {
                const context = {
                    foldedCanvas: foldedCanvasRef.current,
                    unfoldedCanvas: unfoldedCanvasRef.current,
                    foldedCtx: tempFoldedCtx,
                    unfoldedCtx: unfoldedCtxRef.current
                };
                const newFoldedCtx = CanvasService.updateFoldedCanvasDimensions(context, state.folds);
                if (newFoldedCtx) {
                    foldedCtxRef.current = newFoldedCtx;
                    logger.canvas.operation("updated folded canvas dimensions via CanvasService");
                }
            }
        }

        // Reset canvases after dimension changes
        resetCanvases();
    }, [
        state.canvasDimensions.width,
        state.canvasDimensions.height, 
        unfoldedCanvasRef, 
        foldedCanvasRef, 
        state.folds.vertical, 
        state.folds.horizontal, 
        state.folds.diagonal.count,
        state.folds.diagonal.enabled,
        state.folds.diagonal.direction,
        state.isLoadingFromUrl,
        state.isDrawing
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
