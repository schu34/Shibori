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
        initializeCanvases,
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
        initializeCanvases();
    }, [state.canvasDimensions, state.folds, initializeCanvases]);

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
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onTouchCancel={handleTouchCancel}
                />
            </div>
            <div className="canvas-wrapper">
                <h3>Unfolded Version</h3>
                <canvas ref={unfoldedCanvasRef} />
            </div>
        </div>
    );
}; 