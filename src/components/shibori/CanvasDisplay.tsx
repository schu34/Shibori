import React from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { ActionType } from '../../store/shiboriCanvasState';
import { HistoryAction } from '../../types';
import { CanvasRenderer } from './CanvasRenderer';
import { CanvasEventHandler } from './CanvasEventHandler';
import { logger } from '../../utils/logger';

/**
 * Main canvas display component:
 * - CanvasRenderer: Handles the visual rendering of canvases
 * - CanvasEventHandler: Manages touch event listeners 
 * - useCanvas: Owns the state-driven canvas runtime and interactions
 */
export const CanvasDisplay: React.FC = () => {
    const state = useAppSelector((state) => state.shibori);
    const dispatch = useAppDispatch();
    const {
        unfoldedCanvasRef,
        foldedCanvasRef,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleMouseLeave,
        handleKeyDown,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
        handleTouchCancel,
        downloadUnfoldedCanvas,
        deleteSelection,
    } = useCanvas();

    logger.canvas.operation('CanvasDisplay rendering with focused components');

    const handleClearCanvas = () => {
        if (state.history.length > 0) {
            dispatch({
                type: ActionType.ADD_HISTORY_ITEM,
                payload: { action: HistoryAction.Clear, points: [] }
            });
        }
    };

    const handleUndo = () => {
        if (state.history.length > 0) dispatch({ type: ActionType.UNDO });
    };

    return (
        <>
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
                history={state.history}
                selectedHistoryItemId={state.selectedHistoryItemId}
                selectionDragDelta={state.selectionDragDelta}
                selectionRotationPreview={state.selectionRotationPreview}
                lineThickness={state.lineThickness}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onKeyDown={handleKeyDown}
                onClear={handleClearCanvas}
                onDeleteSelection={deleteSelection}
                onUndo={handleUndo}
                onDownload={downloadUnfoldedCanvas}
            />
        </>
    );
}; 
