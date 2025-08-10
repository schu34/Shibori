import React, { useEffect } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { ActionType } from '../../store/shiboriCanvasState';
import { useEffectDebugger } from '../../utils/debugging';
import { logger } from '../../utils/logger';

export const CanvasDisplay: React.FC = () => {
    const state = useAppSelector((state) => state.shibori);
    const dispatch = useAppDispatch();
    // Use our custom canvas hook
    const {
        unfoldedCanvasRef,
        foldedCanvasRef,
        resetCanvases,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleMouseLeave,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
        handleTouchCancel,
        downloadUnfoldedCanvas,
        undo,
        drawFromHistory,
        updateUnfoldedCanvas,
    } = useCanvas();

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

    // Add touch event listeners with passive: false to ensure preventDefault works
    useEffect(() => {
        const foldedCanvas = foldedCanvasRef.current;
        if (!foldedCanvas) return;

        // Options for the event listeners - critical for making preventDefault work
        const options = { passive: false };

        // Convert React touch event handlers to DOM event handlers
        const touchStartHandler = (e: TouchEvent) => handleTouchStart(e as unknown as React.TouchEvent<HTMLCanvasElement>);
        const touchMoveHandler = (e: TouchEvent) => handleTouchMove(e as unknown as React.TouchEvent<HTMLCanvasElement>);
        const touchEndHandler = (e: TouchEvent) => handleTouchEnd(e as unknown as React.TouchEvent<HTMLCanvasElement>);
        const touchCancelHandler = (e: TouchEvent) => handleTouchCancel(e as unknown as React.TouchEvent<HTMLCanvasElement>);

        // Add event listeners with non-passive option
        foldedCanvas.addEventListener('touchstart', touchStartHandler, options);
        foldedCanvas.addEventListener('touchmove', touchMoveHandler, options);
        foldedCanvas.addEventListener('touchend', touchEndHandler, options);
        foldedCanvas.addEventListener('touchcancel', touchCancelHandler, options);

        // Clean up event listeners when component unmounts
        return () => {
            foldedCanvas.removeEventListener('touchstart', touchStartHandler);
            foldedCanvas.removeEventListener('touchmove', touchMoveHandler);
            foldedCanvas.removeEventListener('touchend', touchEndHandler);
            foldedCanvas.removeEventListener('touchcancel', touchCancelHandler);
        };
    }, [handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel, foldedCanvasRef]);

    useEffectDebugger(() => {
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
        
        unfoldedCanvasRef.current.width = state.canvasDimensions.width;
        unfoldedCanvasRef.current.height = state.canvasDimensions.height;
        foldedCanvasRef.current.width = state.canvasDimensions.width / 2 ** state.folds.vertical;
        foldedCanvasRef.current.height = state.canvasDimensions.height / 2 ** state.folds.horizontal;
        logger.canvas.operation('updating canvas dimensions', state.canvasDimensions);

        // Reset canvases after dimension changes to ensure navy background is applied
        resetCanvases();
    }, [state.canvasDimensions, unfoldedCanvasRef, foldedCanvasRef, state.folds.vertical, state.folds.horizontal, state.folds.diagonal, resetCanvases, dispatch, state.isLoadingFromUrl]);

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

    const handleClearCanvas = () => {
        resetCanvases();
    };

    return (
        <div className="canvas-container">
            <div className="canvas-wrapper">
                <h3>Folded Version</h3>
                <canvas
                    ref={foldedCanvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseLeave}
                />
            </div>
            <div className="canvas-wrapper">
                <div className="canvas-header">
                    <h3>Unfolded Version</h3>
                    <div className="canvas-actions">
                        <button
                            className="download-button"
                            onClick={handleClearCanvas}
                            title="Clear canvas"
                        >
                            Clear
                        </button>
                        <button
                            className="download-button"
                            onClick={undo}
                            title="Undo"
                        >
                            Undo
                        </button>
                        <button
                            className="download-button"
                            onClick={downloadUnfoldedCanvas}
                            title="Download as PNG image"
                        >
                            Download
                        </button>
                    </div>
                </div>
                <canvas ref={unfoldedCanvasRef} />
            </div>
        </div>
    );
}; 
