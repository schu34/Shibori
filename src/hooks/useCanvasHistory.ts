import { useCallback } from "react";
import { DrawingModeFactory } from "../drawingModes/DrawingModeFactory";
import { useAppDispatch } from "./useReduxHooks";
import { CanvasRefs } from "./useCanvasRefs";
import {
  UndoableHistoryItem,
} from "../types/DrawingMode";
import { ActionType } from "../store/shiboriCanvasState";
import { useStore } from "react-redux";
import { RootState } from "../store";
import { CanvasService } from "../services/CanvasService";
import { logger } from "../utils/logger";
import { HistoryAction } from "../types";
import { buildDrawableHistory } from "../utils/historyOperations";

export interface HistoryOperations {
  undo: () => void;
  drawFromHistory: (historyItems: UndoableHistoryItem[]) => void;
  resetCanvases: () => void;
}

/**
 * Hook for managing canvas history and undo operations
 * Handles history replay, undo functionality, and canvas reset
 */
export function useCanvasHistory(
  canvasRefs: CanvasRefs,
  updateUnfoldedCanvas: () => void
): HistoryOperations {
  const dispatch = useAppDispatch();
  
  const { getState: _getState } = useStore<RootState>() as {
    getState: () => RootState;
  };
  const getState = useCallback(() => _getState().shibori, [_getState]);

  const {
    unfoldedCanvasRef,
    foldedCanvasRef,
    foldedCtxRef,
    unfoldedCtxRef,
    getCanvasContext,
    getFoldedCanvasDimensions,
    getUnfoldedCanvasDimensions,
  } = canvasRefs;


  // Function to draw fold lines on the unfolded canvas  
  // const drawFoldLines = useCallback(() => {
  //   const context = getCanvasContext();
  //   if (!context.unfoldedCtx || !context.foldedCtx) return;
  //   CanvasService.drawFoldLines(context, getState().folds);
  // }, [getState, getCanvasContext]);

  // Function called when initializing or resetting the drawing canvas
  const resetCanvases = useCallback(() => {
    const currentState = getState();
    logger.canvas.operation('resetCanvases called', {
      historyLength: currentState.history.length,
      isLoadingFromUrl: currentState.isLoadingFromUrl,
      redrawTrigger: currentState.redrawTrigger
    });
    const context = getCanvasContext();
    if (!context) return;
    CanvasService.resetCanvases(context, currentState.folds);
  }, [getCanvasContext, getState]);

  // Function to check if a point is in the valid drawing area (for history replay)
  const isInValidDrawingArea = useCallback(
    (x: number, y: number): boolean => {
      const foldedCanvas = canvasRefs.foldedCanvasRef.current;
      if (!foldedCanvas) return true;
      return CanvasService.isInValidDrawingArea(x, y, getState().folds, foldedCanvas);
    },
    [getState, canvasRefs]
  );

  // Function to draw diagonal fold lines (for history replay)
  const drawDiagonalFoldLinesOnFolded = useCallback(() => {
    const context = getCanvasContext();
    if (!context) return;
    CanvasService.drawDiagonalFoldLinesOnFolded(context, getState().folds);
  }, [getState, getCanvasContext]);

  // Function to replay drawing operations from history
  const drawFromHistory = useCallback(
    (historyItems: UndoableHistoryItem[]) => {
      const unfoldedCanvas = unfoldedCanvasRef.current;
      const unfoldedCtx = unfoldedCtxRef.current;
      const foldedCtx = foldedCtxRef.current;

      if (!unfoldedCanvas || !unfoldedCtx || !foldedCtx) return;

      const drawableItems = buildDrawableHistory(historyItems);
      logger.history.replay(drawableItems.length);

      for (const historyItem of drawableItems) {
        const { action, points } = historyItem;

        logger.canvas.operation(`processing ${action}`, { pointCount: points.length });
        const mode = DrawingModeFactory.getTool(action);
        const args = {
          getState,
          dispatch,
          foldedCtx,
          unfoldedCtx,
          foldedCanvas: foldedCanvasRef.current || undefined,
          historyItem,
          getFoldedCanvasDimensions,
          getUnfoldedCanvasDimensions,
          updateUnfoldedCanvas: () => {},
          drawDiagonalFoldLinesOnFolded,
          isInValidDrawingArea,
        };
        
        logger.canvas.event('mode.start', points[0]);
        mode.start(points[0], args);

        // Call continue for all points from 1 to n-1 (this ensures drawing happens)
        for (let i = 1; i < points.length; i++) {
          logger.canvas.event('mode.continue', points[i]);
          mode.continue(points[i], args);
        }
        
        // Always call end with the last point (or first point if only 1 point)
        const endPoint = points.length > 0 ? points[points.length - 1] : { x: 0, y: 0 };
        logger.canvas.event('mode.end', endPoint);
        const result = mode.end(endPoint, args);
        logger.canvas.operation('mode.end result', result);
      }
    },
    [
      dispatch,
      getState,
      unfoldedCanvasRef,
      unfoldedCtxRef,
      foldedCtxRef,
      foldedCanvasRef,
      getCanvasContext,
      getFoldedCanvasDimensions,
      getUnfoldedCanvasDimensions,
      drawDiagonalFoldLinesOnFolded,
      isInValidDrawingArea,
    ]
  );

  // Undo function
  const undo = useCallback(() => {
    const historyLength = getState().history.length;
    if (historyLength > 0) {
      logger.history.undo(historyLength);
      dispatch({ type: ActionType.UNDO });
      const historyItems = getState().history;
      resetCanvases();
      drawFromHistory(historyItems);
      const latestHistoryItem = historyItems[historyItems.length - 1];
      if (latestHistoryItem && latestHistoryItem.action !== HistoryAction.Clear) {
        updateUnfoldedCanvas();
      }
    }
  }, [
    getState,
    dispatch,
    resetCanvases,
    drawFromHistory,
    updateUnfoldedCanvas,
  ]);

  return {
    undo,
    drawFromHistory,
    resetCanvases,
  };
}
