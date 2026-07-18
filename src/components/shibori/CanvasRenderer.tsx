import React from 'react';
import { logger } from '../../utils/logger';
import { DiagonalDirection, DrawingTool, FoldState } from '../../types';
import { DrawingModeFactory } from '../../drawingModes/DrawingModeFactory';
import { Bounds, DrawingGuidance, Point, UndoableHistoryItem } from '../../types/DrawingMode';
import {
    DrawableHistoryItem,
    buildDrawableHistory,
    getRotatedHistoryItemPreview,
    getTranslatedHistoryItemPreview
} from '../../utils/historyOperations';
import { expandBounds, getBoundsCenter, getRectBounds, getSquareEndPoint } from '../../utils/geometryMath';
import { getFoldedCanvasDimensions } from '../../utils/foldedCanvasDimensions';
import { FoldGuideOverlay } from './FoldGuideOverlay';
import { BezierGuideOverlay } from './BezierGuideOverlay';

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
    drawingGuidance: DrawingGuidance | null;
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
    showFoldGuides: boolean;
    onToggleFoldGuides: () => void;
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
    drawingGuidance,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onLostPointerCapture,
    onKeyDown,
    onClear,
    onDeleteSelection,
    onUndo,
    onDownload,
    showFoldGuides,
    onToggleFoldGuides,
}) => {
    logger.canvas.operation('CanvasRenderer rendering', {
        canvasDimensions,
        folds: { vertical: folds.vertical, horizontal: folds.horizontal }
    });

    const foldedCanvasDimensions = getFoldedCanvasDimensions(canvasDimensions, folds);
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
            left: `${(selectionFrame.bounds.minX / foldedCanvasDimensions.width) * 100}%`,
            top: `${(selectionFrame.bounds.minY / foldedCanvasDimensions.height) * 100}%`,
            width: `${((selectionFrame.bounds.maxX - selectionFrame.bounds.minX) / foldedCanvasDimensions.width) * 100}%`,
            height: `${((selectionFrame.bounds.maxY - selectionFrame.bounds.minY) / foldedCanvasDimensions.height) * 100}%`,
            transform: selectionFrame.rotation ? `rotate(${selectionFrame.rotation}rad)` : undefined,
            transformOrigin: `${selectionFrame.origin.x}% ${selectionFrame.origin.y}%`,
        }
        : undefined;
    const foldedGuideStyle = getCanvasOverlayStyle(canvasDimensions, foldedCanvasDimensions);

    return (
        <div className="canvas-container">
            <div className="canvas-wrapper">
                <h3>Folded Version</h3>
                <div
                    className="folded-canvas-frame"
                    style={{ aspectRatio: `${canvasDimensions.width} / ${canvasDimensions.height}` }}
                >
                    <canvas
                        ref={foldedCanvasRef}
                        width={foldedCanvasDimensions.width}
                        height={foldedCanvasDimensions.height}
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
                    {showDiagonalMask && (
                        <div
                            className={`diagonal-invalid-region ${invalidMaskClass}`}
                            aria-hidden="true"
                        />
                    )}
                    {showFoldGuides && (
                        <FoldGuideOverlay
                            canvasDimensions={foldedCanvasDimensions}
                            folds={folds}
                            style={foldedGuideStyle}
                        />
                    )}
                    {drawingGuidance?.kind === 'bezier' && (
                        <BezierGuideOverlay
                            guidance={drawingGuidance}
                            canvasDimensions={foldedCanvasDimensions}
                            style={foldedGuideStyle}
                        />
                    )}
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
                        <button
                            className="download-button"
                            type="button"
                            onClick={onToggleFoldGuides}
                            aria-pressed={showFoldGuides}
                            aria-label={showFoldGuides ? 'Hide fold guides' : 'Show fold guides'}
                        >
                            {showFoldGuides ? 'Hide guides' : 'Show guides'}
                        </button>
                    </div>
                </div>
                <div
                    className="unfolded-canvas-frame"
                    style={{ aspectRatio: `${canvasDimensions.width} / ${canvasDimensions.height}` }}
                >
                    <canvas
                        ref={unfoldedCanvasRef}
                        width={canvasDimensions.width}
                        height={canvasDimensions.height}
                    />
                    {showFoldGuides && (
                        <FoldGuideOverlay
                            canvasDimensions={canvasDimensions}
                            folds={folds}
                            showGrid
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

function getCanvasOverlayStyle(
    frameDimensions: { width: number; height: number },
    canvasDimensions: { width: number; height: number }
): React.CSSProperties {
    const frameRatio = frameDimensions.width / frameDimensions.height;
    const canvasRatio = canvasDimensions.width / canvasDimensions.height;

    if (canvasRatio >= frameRatio) {
        const height = (frameRatio / canvasRatio) * 100;
        return { width: '100%', height: `${height}%`, left: 0, top: `${(100 - height) / 2}%` };
    }

    const width = (canvasRatio / frameRatio) * 100;
    return { width: `${width}%`, height: '100%', left: `${(100 - width) / 2}%`, top: 0 };
}

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
