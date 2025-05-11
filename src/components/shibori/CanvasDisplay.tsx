import React, { useEffect } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { ActionType } from '../../store/shiboriCanvasState';

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
    } = useCanvas();

    // Initialize canvases when dimensions or folds change
    useEffect(() => {
        resetCanvases();
    }, [state.canvasDimensions, state.folds, resetCanvases]);

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

    useEffect(() => {
        if (!unfoldedCanvasRef.current || !foldedCanvasRef.current) {
            return;
        }
        dispatch({ type: ActionType.CLEAR_UNDO_HISTORY });
        unfoldedCanvasRef.current.width = state.canvasDimensions.width;
        unfoldedCanvasRef.current.height = state.canvasDimensions.height;
        foldedCanvasRef.current.width = state.canvasDimensions.width / 2 ** state.folds.vertical;
        foldedCanvasRef.current.height = state.canvasDimensions.height / 2 ** state.folds.horizontal;
        console.log('state.canvasDimensions', state.canvasDimensions);

        // Reset canvases after dimension changes to ensure navy background is applied
        resetCanvases();
    }, [state.canvasDimensions, unfoldedCanvasRef, foldedCanvasRef, state.folds.vertical, state.folds.horizontal, state.folds.diagonal, resetCanvases, dispatch]);

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