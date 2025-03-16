import React, { useEffect } from 'react';
import { State, Action } from '../../store/shiboriCanvasState';
import { useCanvas } from '../../hooks/useCanvas';

interface CanvasDisplayProps {
    state: State;
    dispatch: React.Dispatch<Action>;
}

export const CanvasDisplay: React.FC<CanvasDisplayProps> = ({ state, dispatch }) => {
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
        handleTouchCancel
    } = useCanvas({ state, dispatch });

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
        unfoldedCanvasRef.current.width = state.canvasDimensions.width;
        unfoldedCanvasRef.current.height = state.canvasDimensions.height;
        foldedCanvasRef.current.width = state.canvasDimensions.width / 2 ** state.folds.vertical;
        foldedCanvasRef.current.height = state.canvasDimensions.height / 2 ** state.folds.horizontal;
        console.log('state.canvasDimensions', state.canvasDimensions);
    }, [state.canvasDimensions, unfoldedCanvasRef, foldedCanvasRef, state.folds.vertical, state.folds.horizontal]);

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
                <h3>Unfolded Version</h3>
                <canvas ref={unfoldedCanvasRef} />
            </div>
        </div>
    );
}; 