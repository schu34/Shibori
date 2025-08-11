import { useCallback } from "react";
import { DrawingModeFactory } from "../drawingModes/DrawingModeFactory";
import { useAppDispatch } from "./useReduxHooks";
import { CanvasRefs } from "./useCanvasRefs";
import {
  Point,
} from "../types/DrawingMode";
import { ActionType } from "../store/shiboriCanvasState";
import { useStore } from "react-redux";
import { RootState } from "../store";
import { CanvasService } from "../services/CanvasService";
import { logger } from "../utils/logger";
import { debounce } from "lodash-es";

export interface DrawingOperations {
  startDrawing: (x: number, y: number) => void;
  continueDrawing: (x: number, y: number) => void;
  endDrawing: (point: Point | null) => void;
  isDrawing: () => boolean;
  updateUnfoldedCanvas: () => void;
  isInValidDrawingArea: (x: number, y: number) => boolean;
}

/**
 * Hook for managing drawing operations
 * Handles the drawing lifecycle (start, continue, end) and canvas updates
 */
export function useCanvasDrawing(canvasRefs: CanvasRefs): DrawingOperations {
  const dispatch = useAppDispatch();
  
  const { getState: _getState } = useStore<RootState>() as {
    getState: () => RootState;
  };
  const getState = useCallback(() => _getState().shibori, [_getState]);

  const {
    foldedCanvasRef,
    foldedCtxRef,
    unfoldedCtxRef,
    getCanvasContext,
    getFoldedCanvasDimensions,
    getUnfoldedCanvasDimensions,
  } = canvasRefs;

  // Function to draw diagonal fold lines on the folded canvas
  const drawDiagonalFoldLinesOnFolded = useCallback(() => {
    const context = getCanvasContext();
    if (!context) return;
    CanvasService.drawDiagonalFoldLinesOnFolded(context, getState().folds);
  }, [getState, getCanvasContext]);

  // Function to update the unfolded canvas by mirroring the folded canvas
  const updateUnfoldedCanvasUnthrottled = useCallback(() => {
    const context = getCanvasContext();
    if (!context) return;
    CanvasService.updateUnfoldedCanvas(context, getState().folds);
  }, [getState, getCanvasContext]);

  // Debounced version for performance
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const updateUnfoldedCanvas = useCallback(
    debounce(updateUnfoldedCanvasUnthrottled, 100),
    [updateUnfoldedCanvasUnthrottled]
  );

  // Function to check if a point is in the valid drawing area based on diagonal fold
  const isInValidDrawingArea = useCallback(
    (x: number, y: number): boolean => {
      const foldedCanvas = foldedCanvasRef.current;
      if (!foldedCanvas) return true;
      return CanvasService.isInValidDrawingArea(x, y, getState().folds, foldedCanvas);
    },
    [getState, foldedCanvasRef]
  );

  // Helper to check if currently drawing
  const isDrawing = useCallback(() => getState().isDrawing, [getState]);

  // Common start drawing function
  const startDrawing = useCallback(
    (x: number, y: number) => {
      const mode = DrawingModeFactory.getTool(getState().currentTool);
      if (!foldedCtxRef.current || !unfoldedCtxRef.current) return;
      
      logger.canvas.operation("startDrawing", { x, y, tool: getState().currentTool });
      
      mode.start(
        { x, y },
        {
          getState,
          dispatch,
          foldedCtx: foldedCtxRef.current,
          unfoldedCtx: unfoldedCtxRef.current,
          getFoldedCanvasDimensions,
          getUnfoldedCanvasDimensions,
          updateUnfoldedCanvas,
          drawDiagonalFoldLinesOnFolded,
          isInValidDrawingArea,
        }
      );
    },
    [
      getState,
      dispatch,
      foldedCtxRef,
      unfoldedCtxRef,
      getFoldedCanvasDimensions,
      getUnfoldedCanvasDimensions,
      updateUnfoldedCanvas,
      drawDiagonalFoldLinesOnFolded,
      isInValidDrawingArea,
    ]
  );

  // Common continue drawing function
  const continueDrawing = useCallback(
    (x: number, y: number) => {
      const mode = DrawingModeFactory.getTool(getState().currentTool);
      if (!foldedCtxRef.current || !unfoldedCtxRef.current) return;
      
      logger.canvas.operation("continueDrawing", { x, y });
      
      const result = mode.continue(
        { x, y },
        {
          getState,
          dispatch,
          foldedCtx: foldedCtxRef.current,
          unfoldedCtx: unfoldedCtxRef.current,
          getFoldedCanvasDimensions,
          getUnfoldedCanvasDimensions,
          updateUnfoldedCanvas,
          drawDiagonalFoldLinesOnFolded,
          isInValidDrawingArea,
        }
      );
      // Update the unfolded canvas after each drawing operation
      if (result) updateUnfoldedCanvas();
    },
    [
      getState,
      dispatch,
      foldedCtxRef,
      unfoldedCtxRef,
      getFoldedCanvasDimensions,
      getUnfoldedCanvasDimensions,
      updateUnfoldedCanvas,
      drawDiagonalFoldLinesOnFolded,
      isInValidDrawingArea,
    ]
  );

  // Common end drawing function
  const endDrawing = useCallback(
    (point: Point | null) => {
      const mode = DrawingModeFactory.getTool(getState().currentTool);
      if (!foldedCtxRef.current || !unfoldedCtxRef.current) return;
      
      logger.canvas.operation("endDrawing", { point });
      
      const result = mode.end(point, {
        getState,
        dispatch,
        foldedCtx: foldedCtxRef.current,
        unfoldedCtx: unfoldedCtxRef.current,
        getFoldedCanvasDimensions,
        getUnfoldedCanvasDimensions,
        updateUnfoldedCanvas,
        drawDiagonalFoldLinesOnFolded,
        isInValidDrawingArea,
      });
      
      if (result) {
        dispatch({ type: ActionType.ADD_HISTORY_ITEM, payload: result });
        logger.history.add(result);
      }
      // Update the unfolded canvas after the final drawing operation
      updateUnfoldedCanvas();
    },
    [
      getState,
      dispatch,
      foldedCtxRef,
      unfoldedCtxRef,
      getFoldedCanvasDimensions,
      getUnfoldedCanvasDimensions,
      updateUnfoldedCanvas,
      drawDiagonalFoldLinesOnFolded,
      isInValidDrawingArea,
    ]
  );

  return {
    startDrawing,
    continueDrawing,
    endDrawing,
    isDrawing,
    updateUnfoldedCanvas,
    isInValidDrawingArea,
  };
}