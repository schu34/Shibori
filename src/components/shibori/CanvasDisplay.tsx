import React from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { useAppSelector } from '../../hooks/useReduxHooks';
import { CanvasRenderer } from './CanvasRenderer';
import { CanvasEventHandler } from './CanvasEventHandler';
import { CanvasController } from './CanvasController';
import { logger } from '../../utils/logger';

/**
 * Main canvas display component that orchestrates the three focused sub-components:
 * - CanvasRenderer: Handles the visual rendering of canvases
 * - CanvasEventHandler: Manages touch event listeners 
 * - CanvasController: Manages canvas lifecycle and state synchronization
 */
export const CanvasDisplay: React.FC = () => {
    const state = useAppSelector((state) => state.shibori);
    const {
        unfoldedCanvasRef,
        foldedCanvasRef,
        foldedCtxRef,
        unfoldedCtxRef,
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

    logger.canvas.operation('CanvasDisplay rendering with focused components');

    const handleClearCanvas = () => {
        resetCanvases();
    };

    return (
        <>
            <CanvasController
                unfoldedCanvasRef={unfoldedCanvasRef}
                foldedCanvasRef={foldedCanvasRef}
                foldedCtxRef={foldedCtxRef}
                unfoldedCtxRef={unfoldedCtxRef}
                resetCanvases={resetCanvases}
                drawFromHistory={drawFromHistory}
                updateUnfoldedCanvas={updateUnfoldedCanvas}
            />
            
            <CanvasEventHandler
                foldedCanvasRef={foldedCanvasRef}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchCancel}
            />
            
            <CanvasRenderer
                foldedCanvasRef={foldedCanvasRef}
                unfoldedCanvasRef={unfoldedCanvasRef}
                canvasDimensions={state.canvasDimensions}
                folds={state.folds}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onClear={handleClearCanvas}
                onUndo={undo}
                onDownload={downloadUnfoldedCanvas}
            />
        </>
    );
}; 
