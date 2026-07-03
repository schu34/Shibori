import { useCallback } from "react";
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
import { renderDrawableHistoryItems } from "../utils/historyRenderer";

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

  // Function to replay drawing operations from history
  const drawFromHistory = useCallback(
    (historyItems: UndoableHistoryItem[]) => {
      const unfoldedCanvas = unfoldedCanvasRef.current;
      const unfoldedCtx = unfoldedCtxRef.current;
      const foldedCanvas = foldedCanvasRef.current;
      const foldedCtx = foldedCtxRef.current;

      if (!unfoldedCanvas || !unfoldedCtx || !foldedCanvas || !foldedCtx) return;

      const currentState = getState();
      const drawableItems = buildDrawableHistory(historyItems);
      logger.history.replay(drawableItems.length);

      renderDrawableHistoryItems(foldedCtx, foldedCanvas, drawableItems, {
        config: currentState.config,
        folds: currentState.folds,
        lineThickness: currentState.lineThickness,
        shapeFillMode: currentState.shapeFillMode
      });
      CanvasService.drawDiagonalFoldLinesOnFolded({
        foldedCanvas,
        unfoldedCanvas,
        foldedCtx,
        unfoldedCtx
      }, currentState.folds);
    },
    [
      getState,
      unfoldedCanvasRef,
      unfoldedCtxRef,
      foldedCtxRef,
      foldedCanvasRef,
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
