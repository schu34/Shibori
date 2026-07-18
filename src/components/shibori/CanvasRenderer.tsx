import React from 'react';
import { logger } from '../../utils/logger';
import { DiagonalDirection, DrawingTool, FoldState } from '../../types';
import { DrawingModeFactory } from '../../drawingModes/DrawingModeFactory';
import { BezierPath, Bounds, DrawingGuidance, Point, UndoableHistoryItem } from '../../types/DrawingMode';
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
import { PathEditOverlay } from './PathEditOverlay';
import { WorkspaceIcon } from './WorkspaceIcon';

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
    currentTool: DrawingTool;
    selectedPathAnchorIds: string[];
    pathEditPreview: { itemId: string; path: BezierPath } | null;
    drawingGuidance: DrawingGuidance | null;
    hasPendingDrawing: boolean;
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
    onFinishDrawing: () => void;
    onCancelDrawing: () => void;
    onConvertPathSelection: () => void;
    activeCanvas: 'folded' | 'unfolded';
    isInspectorOpen: boolean;
    onActiveCanvasChange: (canvas: 'folded' | 'unfolded') => void;
    onOpenShare: () => void;
    onToggleInspector: () => void;
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
    currentTool,
    selectedPathAnchorIds,
    pathEditPreview,
    drawingGuidance,
    hasPendingDrawing,
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
    onFinishDrawing,
    onCancelDrawing,
    onConvertPathSelection,
    activeCanvas,
    isInspectorOpen,
    onActiveCanvasChange,
    onOpenShare,
    onToggleInspector,
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
    const selectedPreviewDrawable = selectedDrawable && pathEditPreview?.itemId === selectedDrawable.id && selectedDrawable.action === DrawingTool.Bezier
        ? { ...selectedDrawable, points: [], path: pathEditPreview.path }
        : selectedDrawable && selectionRotationPreview
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
    const selectionOverlayStyle = currentTool !== DrawingTool.DirectSelect && selectionFrame
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
    const canvasFrameStyle = {
        aspectRatio: `${canvasDimensions.width} / ${canvasDimensions.height}`,
        '--canvas-aspect': canvasDimensions.width / canvasDimensions.height,
    } as React.CSSProperties;

    return (
        <>
            <div className="workspace-toolbar" role="toolbar" aria-label="Canvas actions">
                <ToolbarButton label="Undo" icon="undo" onClick={onUndo} />
                <ToolbarButton label="Clear" title="Clear canvas" icon="clear" onClick={onClear} />
                <ToolbarButton
                    label={showFoldGuides ? 'Hide fold guides' : 'Show fold guides'}
                    icon="guides"
                    onClick={onToggleFoldGuides}
                    pressed={showFoldGuides}
                />
                <ToolbarButton label="Download" title="Download as PNG image" icon="download" onClick={onDownload} />
                <ToolbarButton label="Share pattern" icon="share" onClick={onOpenShare} />
                <ToolbarButton
                    label={isInspectorOpen ? 'Hide properties' : 'Show properties'}
                    icon="settings"
                    onClick={onToggleInspector}
                    pressed={isInspectorOpen}
                />
            </div>

            <div className="mobile-canvas-tabs" role="tablist" aria-label="Canvas view">
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeCanvas === 'folded'}
                    onClick={() => onActiveCanvasChange('folded')}
                >
                    Folded
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeCanvas === 'unfolded'}
                    onClick={() => onActiveCanvasChange('unfolded')}
                >
                    Unfolded
                </button>
            </div>

            <div className="canvas-container">
            <section className={`canvas-wrapper canvas-panel-folded${activeCanvas === 'folded' ? ' is-mobile-active' : ''}`}>
                <h3>Folded Version</h3>
                <div
                    className="folded-canvas-frame"
                    style={canvasFrameStyle}
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
                    {currentTool === DrawingTool.DirectSelect &&
                        selectedPreviewDrawable?.action === DrawingTool.Bezier &&
                        selectedPreviewDrawable.path && (
                            <PathEditOverlay
                                path={selectedPreviewDrawable.path}
                                selectedAnchorIds={selectedPathAnchorIds}
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
                    {hasPendingDrawing && (
                        <div className="path-construction-actions">
                            <button className="path-action-button path-action-primary" type="button" onClick={onFinishDrawing}>Finish Path</button>
                            <button className="path-action-button path-action-secondary" type="button" onClick={onCancelDrawing}>Cancel Path</button>
                        </div>
                    )}
                    {currentTool === DrawingTool.DirectSelect && selectedPathAnchorIds.length > 0 && (
                        <div className="path-edit-actions">
                            <button className="path-action-button path-action-primary" type="button" onClick={onConvertPathSelection}>Convert Point</button>
                            <button className="path-action-button path-action-danger" type="button" onClick={onDeleteSelection}>Delete Points</button>
                        </div>
                    )}
                </div>
            </section>
            <section className={`canvas-wrapper canvas-panel-unfolded${activeCanvas === 'unfolded' ? ' is-mobile-active' : ''}`}>
                <h3>Unfolded Version</h3>
                <div
                    className="unfolded-canvas-frame"
                    style={canvasFrameStyle}
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
            </section>
            </div>
        </>
    );
};

interface ToolbarButtonProps {
    label: string;
    title?: string;
    icon: 'undo' | 'clear' | 'guides' | 'download' | 'share' | 'settings';
    onClick: () => void;
    pressed?: boolean;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({ label, title, icon, onClick, pressed }) => (
    <button
        type="button"
        className="icon-button workspace-action"
        onClick={onClick}
        aria-label={label}
        aria-pressed={pressed}
        title={title ?? label}
        data-tooltip={label}
    >
        <WorkspaceIcon name={icon} />
    </button>
);

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
