import React from 'react';
import { logger } from '../../utils/logger';
import { DiagonalDirection, DrawingTool, FoldState } from '../../types';
import { DrawingModeFactory } from '../../drawingModes/DrawingModeFactory';
import { Bounds, Point, UndoableHistoryItem } from '../../types/DrawingMode';
import {
    DrawableHistoryItem,
    buildDrawableHistory,
    getRotatedHistoryItemPreview,
    getTranslatedHistoryItemPreview
} from '../../utils/historyOperations';
import { expandBounds, getBoundsCenter, getRectBounds, getSquareEndPoint } from '../../utils/geometryMath';

interface CanvasRendererProps {
    foldedCanvasRef: React.RefObject<HTMLCanvasElement | null>;
    unfoldedCanvasRef: React.RefObject<HTMLCanvasElement | null>;
    canvasDimensions: { width: number; height: number };
    folds: FoldState;
    history: UndoableHistoryItem[];
    selectedHistoryItemId: string | null;
    selectionDragDelta: Point | null;
    selectionRotationPreview: { angle: number; center: Point } | null;
    lineThickness: number;
    onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
    onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
    onPointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => void;
    onPointerCancel: (e: React.PointerEvent<HTMLCanvasElement>) => void;
    onLostPointerCapture: (e: React.PointerEvent<HTMLCanvasElement>) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLCanvasElement>) => void;
    onClear: () => void;
    onDeleteSelection: () => void;
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
    selectionRotationPreview,
    lineThickness,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onLostPointerCapture,
    onKeyDown,
    onClear,
    onDeleteSelection,
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
    const selectedPreviewDrawable = selectedDrawable && selectionRotationPreview
        ? getRotatedHistoryItemPreview(
            selectedDrawable,
            selectionRotationPreview.angle,
            selectionRotationPreview.center
        )
        : selectedDrawable && selectionDragDelta
            ? getTranslatedHistoryItemPreview(selectedDrawable, selectionDragDelta)
            : selectedDrawable;
    const selectedGeometry = selectedDrawable
        ? DrawingModeFactory.getGeometry(selectedDrawable.action)
        : null;
    const selectionFrame = selectedGeometry && selectedPreviewDrawable
        ? getSelectionFrame(selectedPreviewDrawable, lineThickness)
        : null;
    const selectionOverlayStyle = selectionFrame
        ? {
            left: `${(selectionFrame.bounds.minX / canvasDimensions.width) * 100}%`,
            top: `${(selectionFrame.bounds.minY / canvasDimensions.height) * 100}%`,
            width: `${((selectionFrame.bounds.maxX - selectionFrame.bounds.minX) / canvasDimensions.width) * 100}%`,
            height: `${((selectionFrame.bounds.maxY - selectionFrame.bounds.minY) / canvasDimensions.height) * 100}%`,
            transform: selectionFrame.rotation ? `rotate(${selectionFrame.rotation}rad)` : undefined,
            transformOrigin: `${selectionFrame.origin.x}% ${selectionFrame.origin.y}%`,
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
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onPointerCancel={onPointerCancel}
                        onLostPointerCapture={onLostPointerCapture}
                        onKeyDown={onKeyDown}
                        tabIndex={0}
                        aria-label="Folded drawing canvas"
                        className={selectedHistoryItemId ? 'folded-canvas folded-canvas-selecting' : 'folded-canvas'}
                    />
                    {selectionOverlayStyle && (
                        <div
                            className="selection-overlay"
                            style={selectionOverlayStyle}
                        >
                            <span className="selection-rotate-handle selection-rotate-handle-nw" aria-hidden="true" />
                            <span className="selection-rotate-handle selection-rotate-handle-ne" aria-hidden="true" />
                            <span className="selection-rotate-handle selection-rotate-handle-se" aria-hidden="true" />
                            <span className="selection-rotate-handle selection-rotate-handle-sw" aria-hidden="true" />
                            <button
                                type="button"
                                className="selection-delete-button"
                                onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    onDeleteSelection();
                                }}
                                aria-label="Delete selected drawing"
                                title="Delete selected drawing"
                            >
                                X
                            </button>
                        </div>
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

function getSelectionFrame(
    item: DrawableHistoryItem,
    lineThickness: number
): { bounds: Bounds; rotation: number; origin: Point } | null {
    const localBounds = getUnrotatedShapeBounds(item, lineThickness);
    if (localBounds) {
        const rotationCenter = item.rotationCenter ?? getBoundsCenter(localBounds);
        const width = localBounds.maxX - localBounds.minX;
        const height = localBounds.maxY - localBounds.minY;

        return {
            bounds: localBounds,
            rotation: item.rotation ?? 0,
            origin: {
                x: width === 0 ? 50 : ((rotationCenter.x - localBounds.minX) / width) * 100,
                y: height === 0 ? 50 : ((rotationCenter.y - localBounds.minY) / height) * 100,
            }
        };
    }

    const geometry = DrawingModeFactory.getGeometry(item.action);
    const bounds = geometry.getBounds(item, { lineThickness });
    if (!bounds) return null;

    return {
        bounds,
        rotation: 0,
        origin: { x: 50, y: 50 }
    };
}

function getUnrotatedShapeBounds(
    item: DrawableHistoryItem,
    lineThickness: number
): Bounds | null {
    if (item.points.length < 2) return null;

    if (item.action === DrawingTool.Rectangle) {
        return expandBounds(getRectBounds(item.points[0], item.points[1]), lineThickness / 2);
    }

    if (item.action === DrawingTool.Square) {
        return expandBounds(
            getRectBounds(item.points[0], getSquareEndPoint(item.points[0], item.points[1])),
            lineThickness / 2
        );
    }

    if (item.action === DrawingTool.Circle) {
        return DrawingModeFactory
            .getGeometry(item.action)
            .getBounds(item, { lineThickness });
    }

    return null;
}
