import React, { useState } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { ActionType } from '../../store/shiboriCanvasState';
import { HistoryAction } from '../../types';
import { CanvasRenderer } from './CanvasRenderer';
import { logger } from '../../utils/logger';

/**
 * Main canvas display component:
 * - CanvasRenderer: Handles the visual rendering of canvases
 * - useCanvas: Owns the state-driven canvas runtime and interactions
 */
export const CanvasDisplay: React.FC = () => {
    const state = useAppSelector((state) => state.shibori);
    const dispatch = useAppDispatch();
    const [showFoldGuides, setShowFoldGuides] = useState(true);
    const {
        unfoldedCanvasRef,
        foldedCanvasRef,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        handlePointerCancel,
        handleLostPointerCapture,
        handleKeyDown,
        downloadUnfoldedCanvas,
        deleteSelection,
        cancelDrawing,
        drawingGuidance,
    } = useCanvas();

    logger.canvas.operation('CanvasDisplay rendering with focused components');

    const handleClearCanvas = () => {
        cancelDrawing();
        if (state.history.length > 0) {
            dispatch({
                type: ActionType.ADD_HISTORY_ITEM,
                payload: { action: HistoryAction.Clear, points: [] }
            });
        }
    };

    const handleUndo = () => {
        cancelDrawing();
        if (state.history.length > 0) dispatch({ type: ActionType.UNDO });
    };

    return (
        <>
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
                drawingGuidance={drawingGuidance}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onLostPointerCapture={handleLostPointerCapture}
                onKeyDown={handleKeyDown}
                onClear={handleClearCanvas}
                onDeleteSelection={deleteSelection}
                onUndo={handleUndo}
                onDownload={downloadUnfoldedCanvas}
                showFoldGuides={showFoldGuides}
                onToggleFoldGuides={() => setShowFoldGuides((visible) => !visible)}
            />
        </>
    );
}; 
