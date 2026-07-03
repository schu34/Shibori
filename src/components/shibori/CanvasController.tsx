import React, { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { ActionType } from '../../store/shiboriCanvasState';
import { HistoryAction } from '../../types';
import { logger } from '../../utils/logger';
import { CanvasService } from '../../services/CanvasService';
import {
    buildDrawableHistory,
    DrawableHistoryItem,
    getRotatedHistoryItemPreview,
    getTranslatedHistoryItemPreview
} from '../../utils/historyOperations';
import {
    clearFoldedCanvas,
    HistoryRenderOptions,
    renderDrawableHistoryItem,
    renderDrawableHistoryItems
} from '../../utils/historyRenderer';
import { UndoableHistoryItem } from '../../types/DrawingMode';

interface CanvasControllerProps {
    unfoldedCanvasRef: React.RefObject<HTMLCanvasElement | null>;
    foldedCanvasRef: React.RefObject<HTMLCanvasElement | null>;
    foldedCtxRef: React.RefObject<CanvasRenderingContext2D | null>;
    unfoldedCtxRef: React.RefObject<CanvasRenderingContext2D | null>;
    resetCanvases: () => void;
    drawFromHistory: (history: any[]) => void;
    updateUnfoldedCanvas: () => void;
}

/**
 * Manages canvas lifecycle, URL loading, and state synchronization
 * This component handles the complex orchestration of canvas operations
 */
export const CanvasController: React.FC<CanvasControllerProps> = ({
    unfoldedCanvasRef,
    foldedCanvasRef,
    foldedCtxRef,
    unfoldedCtxRef,
    resetCanvases,
    drawFromHistory,
    updateUnfoldedCanvas
}) => {
    const state = useAppSelector((state) => state.shibori);
    const dispatch = useAppDispatch();
    const movePreviewCacheRef = useRef<MovePreviewCache | null>(null);

    // Initialize canvases when dimensions or folds change
    useEffect(() => {
        // Don't reset canvases during URL loading - let the redraw trigger handle it
        if (!state.isLoadingFromUrl && state.redrawTrigger === 0) {
            logger.canvas.operation('initializing canvases due to dimension/fold change', {
                historyLength: state.history.length,
                isLoadingFromUrl: state.isLoadingFromUrl,
                redrawTrigger: state.redrawTrigger
            });
            resetCanvases();
        } else {
            logger.canvas.operation('skipping canvas reset during URL loading/redraw', {
                isLoadingFromUrl: state.isLoadingFromUrl,
                redrawTrigger: state.redrawTrigger,
                historyLength: state.history.length
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.canvasDimensions, state.isLoadingFromUrl, state.redrawTrigger]);

    // Redraw canvas when redraw trigger changes (e.g., when loading from URL)
    useEffect(() => {
        if (state.redrawTrigger > 0 && state.history.length > 0) {
            logger.canvas.operation('redrawing from history due to redraw trigger', {
                redrawTrigger: state.redrawTrigger,
                historyLength: state.history.length
            });
            resetCanvases();
            drawFromHistory(state.history);
            if (state.history[state.history.length - 1]?.action !== HistoryAction.Clear) {
                updateUnfoldedCanvas();
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps  
    }, [state.redrawTrigger, state.history]);

    // Preview selected-item transforms while dragging without committing a history entry per frame.
    useEffect(() => {
        const delta = state.selectionDragDelta;
        const rotationPreview = state.selectionRotationPreview;
        const selectedId = state.selectedHistoryItemId;
        const hasMovePreview = delta && (delta.x !== 0 || delta.y !== 0);
        const hasRotationPreview = rotationPreview && rotationPreview.angle !== 0;

        if (!selectedId || (!hasMovePreview && !hasRotationPreview)) {
            movePreviewCacheRef.current = null;
            return;
        }

        const context = getCanvasContextFromRefs(
            foldedCanvasRef,
            unfoldedCanvasRef,
            foldedCtxRef,
            unfoldedCtxRef
        );
        if (!context) return;

        const cache = getMovePreviewCache({
            currentCache: movePreviewCacheRef.current,
            selectedId,
            history: state.history,
            foldedCanvas: context.foldedCanvas,
            renderOptions: {
                config: state.config,
                folds: state.folds,
                lineThickness: state.lineThickness,
                shapeFillMode: state.shapeFillMode
            }
        });
        movePreviewCacheRef.current = cache;
        if (!cache) return;

        const previewItem = rotationPreview && hasRotationPreview
            ? getRotatedHistoryItemPreview(
                cache.selectedItem,
                rotationPreview.angle,
                rotationPreview.center
            )
            : delta
                ? getTranslatedHistoryItemPreview(cache.selectedItem, delta)
                : cache.selectedItem;

        logger.canvas.operation('previewing selected item transform', {
            selectedId,
            delta,
            rotationPreview,
            cachedBase: true
        });
        context.foldedCtx.clearRect(0, 0, context.foldedCanvas.width, context.foldedCanvas.height);
        context.foldedCtx.drawImage(cache.baseFoldedCanvas, 0, 0);
        renderDrawableHistoryItem(
            context.foldedCtx,
            context.foldedCanvas,
            previewItem,
            cache.renderOptions
        );
        CanvasService.drawDiagonalFoldLinesOnFolded(context, state.folds);
        updateUnfoldedCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.selectionDragDelta, state.selectionRotationPreview, state.selectedHistoryItemId, state.history]);

    // Only reset canvases when actual structural changes occur (dimensions or folds)
    useEffect(() => {
        if (!unfoldedCanvasRef.current || !foldedCanvasRef.current) {
            return;
        }
        
        // Skip resets during active drawing to prevent clearing the canvas
        if (state.isDrawing) {
            logger.canvas.operation('CanvasController: skipping reset during active drawing');
            return;
        }
        
        // Skip resets during URL loading - the redraw trigger handles this
        if (state.isLoadingFromUrl) {
            logger.canvas.operation('CanvasController: skipping reset during URL loading', {
                historyLength: state.history.length,
                redrawTrigger: state.redrawTrigger
            });
            return;
        }
        
        logger.canvas.operation('CanvasController: structural change detected, resetting canvas');
        
        // Clear undo history for structural changes, but NOT during URL loading
        // URL loading should preserve its loaded history
        const shouldClearHistory = !state.isLoadingFromUrl && state.redrawTrigger === 0;
        logger.canvas.operation('history clearing decision', {
            shouldClearHistory,
            isLoadingFromUrl: state.isLoadingFromUrl,
            redrawTrigger: state.redrawTrigger,
            historyLength: state.history.length
        });
        
        if (shouldClearHistory) {
            logger.canvas.operation('clearing undo history for structural change');
            dispatch({ type: ActionType.CLEAR_UNDO_HISTORY });
        } else {
            logger.canvas.operation('preserving history during URL loading/redraw', {
                isLoadingFromUrl: state.isLoadingFromUrl,
                redrawTrigger: state.redrawTrigger,
                historyLength: state.history.length
            });
        }
        
        // Update canvas dimensions using CanvasService
        unfoldedCanvasRef.current.width = state.canvasDimensions.width;
        unfoldedCanvasRef.current.height = state.canvasDimensions.height;
        
        // Re-initialize unfolded context after dimension change
        if (unfoldedCanvasRef.current) {
            const ctx = unfoldedCanvasRef.current.getContext("2d", {
                willReadFrequently: true,
            });
            unfoldedCtxRef.current = ctx;
            logger.canvas.operation("re-initialized unfolded canvas context after dimension change");
        }

        // Use CanvasService to properly handle folded canvas dimensions and context
        if (foldedCanvasRef.current && unfoldedCanvasRef.current && unfoldedCtxRef.current) {
            // Create temporary context for the service call
            const tempFoldedCtx = foldedCanvasRef.current.getContext("2d", {
                willReadFrequently: true,
            });
            
            if (tempFoldedCtx) {
                const context = {
                    foldedCanvas: foldedCanvasRef.current,
                    unfoldedCanvas: unfoldedCanvasRef.current,
                    foldedCtx: tempFoldedCtx,
                    unfoldedCtx: unfoldedCtxRef.current
                };
                const newFoldedCtx = CanvasService.updateFoldedCanvasDimensions(context, state.folds);
                if (newFoldedCtx) {
                    foldedCtxRef.current = newFoldedCtx;
                    logger.canvas.operation("updated folded canvas dimensions via CanvasService");
                }
            }
        }

        // Reset canvases after structural changes, but not if we just loaded from URL
        // and have drawing history to preserve
        if (state.redrawTrigger === 0 || state.history.length === 0) {
            logger.canvas.operation('resetting canvases for structural change');
            resetCanvases();
        } else {
            logger.canvas.operation('skipping canvas reset to preserve loaded drawing', {
                redrawTrigger: state.redrawTrigger,
                historyLength: state.history.length
            });
        }
    }, [
        // Only include dependencies that represent actual structural changes
        state.canvasDimensions.width,
        state.canvasDimensions.height, 
        state.folds.vertical, 
        state.folds.horizontal, 
        state.folds.diagonal.count,
        state.folds.diagonal.enabled,
        state.folds.diagonal.direction,
        // Include isLoadingFromUrl so effect can react when URL loading finishes
        state.isLoadingFromUrl
        // Removed: unfoldedCanvasRef, foldedCanvasRef
        // These can change during normal operations and don't represent structural changes
    ]);

    // Finish URL loading after canvas setup is complete
    useEffect(() => {
        if (state.isLoadingFromUrl && unfoldedCanvasRef.current && foldedCanvasRef.current) {
            logger.url.load('finishing URL loading after canvas setup', { 
                historyLength: state.history.length 
            });
            // Give a brief delay for canvas to be properly initialized
            const timeout = setTimeout(() => {
                dispatch({ type: ActionType.FINISH_URL_LOADING });
                // Force one more redraw after URL loading completes to ensure drawing appears
                // This works around timing issues with the automatic redraw during loading
                if (state.history.length > 0) {
                    setTimeout(() => {
                        logger.url.load('triggering final redraw after URL loading completes');
                        dispatch({ type: ActionType.REDRAW_FROM_HISTORY });
                    }, 100);
                }
            }, 200); // Slightly longer delay to ensure canvas is ready
            return () => clearTimeout(timeout);
        }
    }, [state.isLoadingFromUrl, unfoldedCanvasRef, foldedCanvasRef, dispatch, state.history.length]);

    // This component renders nothing - it only manages canvas lifecycle
    return null;
};

interface MovePreviewCache {
    selectedId: string;
    selectedItem: DrawableHistoryItem;
    history: UndoableHistoryItem[];
    baseFoldedCanvas: HTMLCanvasElement;
    renderOptions: HistoryRenderOptions;
    cacheKey: string;
}

interface MovePreviewCacheParams {
    currentCache: MovePreviewCache | null;
    selectedId: string;
    history: UndoableHistoryItem[];
    foldedCanvas: HTMLCanvasElement;
    renderOptions: HistoryRenderOptions;
}

function getMovePreviewCache({
    currentCache,
    selectedId,
    history,
    foldedCanvas,
    renderOptions
}: MovePreviewCacheParams): MovePreviewCache | null {
    const cacheKey = createMovePreviewCacheKey(selectedId, foldedCanvas, renderOptions);
    if (currentCache &&
        currentCache.selectedId === selectedId &&
        currentCache.history === history &&
        currentCache.cacheKey === cacheKey) {
        return currentCache;
    }

    const drawables = buildDrawableHistory(history);
    const selectedItem = drawables.find((item) => item.id === selectedId);
    if (!selectedItem) return null;

    const baseFoldedCanvas = document.createElement('canvas');
    baseFoldedCanvas.width = foldedCanvas.width;
    baseFoldedCanvas.height = foldedCanvas.height;
    const baseCtx = baseFoldedCanvas.getContext('2d', {
        willReadFrequently: true
    });
    if (!baseCtx) return null;

    clearFoldedCanvas(baseCtx, baseFoldedCanvas);
    renderDrawableHistoryItems(
        baseCtx,
        baseFoldedCanvas,
        drawables.filter((item) => item.id !== selectedId),
        renderOptions
    );
    CanvasService.drawDiagonalFoldLinesOnFolded({
        foldedCanvas: baseFoldedCanvas,
        unfoldedCanvas: baseFoldedCanvas,
        foldedCtx: baseCtx,
        unfoldedCtx: baseCtx
    }, renderOptions.folds);

    return {
        selectedId,
        selectedItem,
        history,
        baseFoldedCanvas,
        renderOptions,
        cacheKey
    };
}

function createMovePreviewCacheKey(
    selectedId: string,
    foldedCanvas: HTMLCanvasElement,
    renderOptions: HistoryRenderOptions
): string {
    return JSON.stringify({
        selectedId,
        width: foldedCanvas.width,
        height: foldedCanvas.height,
        folds: renderOptions.folds,
        lineThickness: renderOptions.lineThickness,
        shapeFillMode: renderOptions.shapeFillMode,
        lineColor: renderOptions.config.lineColor
    });
}

function getCanvasContextFromRefs(
    foldedCanvasRef: React.RefObject<HTMLCanvasElement | null>,
    unfoldedCanvasRef: React.RefObject<HTMLCanvasElement | null>,
    foldedCtxRef: React.RefObject<CanvasRenderingContext2D | null>,
    unfoldedCtxRef: React.RefObject<CanvasRenderingContext2D | null>
) {
    if (!foldedCanvasRef.current ||
        !unfoldedCanvasRef.current ||
        !foldedCtxRef.current ||
        !unfoldedCtxRef.current) {
        return null;
    }

    return {
        foldedCanvas: foldedCanvasRef.current,
        unfoldedCanvas: unfoldedCanvasRef.current,
        foldedCtx: foldedCtxRef.current,
        unfoldedCtx: unfoldedCtxRef.current
    };
}
