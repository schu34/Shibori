import React, { useState } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { ActionType } from '../../store/shiboriCanvasState';
import { HistoryAction } from '../../types';
import { CanvasRenderer } from './CanvasRenderer';
import { logger } from '../../utils/logger';

type CanvasView = 'folded' | 'unfolded';

interface CanvasDisplayProps {
    activeCanvas?: CanvasView;
    isInspectorOpen?: boolean;
    onActiveCanvasChange?: (canvas: CanvasView) => void;
    onOpenShare?: () => void;
    onToggleInspector?: () => void;
}

/**
 * Main canvas display component:
 * - CanvasRenderer: Handles the visual rendering of canvases
 * - useCanvas: Owns the state-driven canvas runtime and interactions
 */
export const CanvasDisplay: React.FC<CanvasDisplayProps> = ({
    activeCanvas = 'folded',
    isInspectorOpen = true,
    onActiveCanvasChange = () => undefined,
    onOpenShare = () => undefined,
    onToggleInspector = () => undefined,
}) => {
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
        finishDrawing,
        hasPendingDrawing,
        convertPathSelection,
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
                currentTool={state.currentTool}
                selectedPathAnchorIds={state.selectedPathAnchorIds ?? []}
                pathEditPreview={state.pathEditPreview ?? null}
                drawingGuidance={drawingGuidance}
                hasPendingDrawing={hasPendingDrawing}
                onFinishDrawing={finishDrawing}
                onCancelDrawing={cancelDrawing}
                onConvertPathSelection={convertPathSelection}
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
                activeCanvas={activeCanvas}
                isInspectorOpen={isInspectorOpen}
                onActiveCanvasChange={onActiveCanvasChange}
                onOpenShare={onOpenShare}
                onToggleInspector={onToggleInspector}
            />
        </>
    );
}; 
