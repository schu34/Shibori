import React from 'react';
import { logger } from '../../utils/logger';
import { DiagonalDirection, FoldState } from '../../types';
import { DrawingModeFactory } from '../../drawingModes/DrawingModeFactory';
import { Point, UndoableHistoryItem } from '../../types/DrawingMode';
import { buildDrawableHistory } from '../../utils/historyOperations';

interface CanvasRendererProps {
    foldedCanvasRef: React.RefObject<HTMLCanvasElement | null>;
    unfoldedCanvasRef: React.RefObject<HTMLCanvasElement | null>;
    canvasDimensions: { width: number; height: number };
    folds: FoldState;
    history: UndoableHistoryItem[];
    selectedHistoryItemId: string | null;
    selectionDragDelta: Point | null;
    lineThickness: number;
    onMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
    onMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
    onMouseUp: (e: React.MouseEvent<HTMLCanvasElement>) => void;
    onMouseLeave: (e: React.MouseEvent<HTMLCanvasElement>) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLCanvasElement>) => void;
    onClear: () => void;
    onUndo: () => void;
    onDownload: () => void;
}

export const CanvasRenderer: React.FC<CanvasRendererProps> = ({
    foldedCanvasRef,
    unfoldedCanvasRef,
    canvasDimensions,
    folds,
    history,
    selectedHistoryItemId,
    selectionDragDelta,
    lineThickness,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    onKeyDown,
    onClear,
    onUndo,
    onDownload
}) => {
    logger.canvas.operation('CanvasRenderer rendering', {
        canvasDimensions,
        folds: { vertical: folds.vertical, horizontal: folds.horizontal }
    });

    const showDiagonalMask = folds.diagonal.enabled && folds.diagonal.count === 1 && folds.vertical === folds.horizontal;
    const invalidMaskClass = folds.diagonal.direction === DiagonalDirection.TopRightToBottomLeft
        ? 'invalid-region-top-left'
        : 'invalid-region-bottom-left';
    const selectedDrawable = selectedHistoryItemId
        ? buildDrawableHistory(history).find((item) => item.id === selectedHistoryItemId)
        : null;
    const selectedBounds = selectedDrawable
        ? DrawingModeFactory
            .getGeometry(selectedDrawable.action)
            .getBounds(
                selectionDragDelta
                    ? DrawingModeFactory.getGeometry(selectedDrawable.action).translate(selectedDrawable, selectionDragDelta)
                    : selectedDrawable,
                { lineThickness }
            )
        : null;
    const selectionOverlayStyle = selectedBounds
        ? {
            left: `${(selectedBounds.minX / canvasDimensions.width) * 100}%`,
            top: `${(selectedBounds.minY / canvasDimensions.height) * 100}%`,
            width: `${((selectedBounds.maxX - selectedBounds.minX) / canvasDimensions.width) * 100}%`,
            height: `${((selectedBounds.maxY - selectedBounds.minY) / canvasDimensions.height) * 100}%`,
        }
        : undefined;

    return (
        <div className="canvas-container">
            <div className="canvas-wrapper">
                <h3>Folded Version</h3>
                <div className="folded-canvas-frame">
                    <canvas
                        ref={foldedCanvasRef}
                        width={canvasDimensions.width}
                        height={canvasDimensions.height}
                        onMouseDown={onMouseDown}
                        onMouseMove={onMouseMove}
                        onMouseUp={onMouseUp}
                        onMouseLeave={onMouseLeave}
                        onKeyDown={onKeyDown}
                        tabIndex={0}
                        aria-label="Folded drawing canvas"
                        className={selectedHistoryItemId ? 'folded-canvas folded-canvas-selecting' : 'folded-canvas'}
                    />
                    {selectionOverlayStyle && (
                        <div
                            className="selection-overlay"
                            style={selectionOverlayStyle}
                            aria-hidden="true"
                        />
                    )}
                    {showDiagonalMask && (
                        <div
                            className={`diagonal-invalid-region ${invalidMaskClass}`}
                            aria-hidden="true"
                        />
                    )}
                </div>
            </div>
            <div className="canvas-wrapper">
                <div className="canvas-header">
                    <h3>Unfolded Version</h3>
                    <div className="canvas-actions">
                        <button
                            className="download-button"
                            onClick={onClear}
                            title="Clear canvas"
                        >
                            Clear
                        </button>
                        <button
                            className="download-button"
                            onClick={onUndo}
                            title="Undo"
                        >
                            Undo
                        </button>
                        <button
                            className="download-button"
                            onClick={onDownload}
                            title="Download as PNG image"
                        >
                            Download
                        </button>
                    </div>
                </div>
                <canvas 
                    ref={unfoldedCanvasRef}
                    width={canvasDimensions.width}
                    height={canvasDimensions.height}
                />
            </div>
        </div>
    );
};
