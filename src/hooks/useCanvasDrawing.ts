import { useCallback, useEffect, useRef } from "react";
import { DrawingModeFactory } from "../drawingModes/DrawingModeFactory";
import { useAppDispatch } from "./useReduxHooks";
import { CanvasRefs } from "./useCanvasRefs";
import {
  Point,
  UndoableHistoryItem,
} from "../types/DrawingMode";
import { ActionType } from "../store/shiboriCanvasState";
import { DrawingTool } from "../types";
import { useStore } from "react-redux";
import { RootState } from "../store";
import { CanvasService } from "../services/CanvasService";
import { WebGLCanvasService } from "../services/WebGLCanvasService";
import { logger } from "../utils/logger";
import { buildDrawableHistory, createMoveHistoryItem, DrawableHistoryItem } from "../utils/historyOperations";
import { translatePoints } from "../utils/geometryMath";

export interface DrawingOperations {
  startDrawing: (x: number, y: number) => void;
  continueDrawing: (x: number, y: number) => void;
  endDrawing: (point: Point | null) => void;
  isDrawing: () => boolean;
  updateUnfoldedCanvas: () => void;
  isInValidDrawingArea: (x: number, y: number) => boolean;
  isUsingWebGL: () => boolean;
  getWebGLInfo: () => string | null;
  nudgeSelection: (delta: Point) => void;
  clearSelection: () => void;
}

/**
 * Hook for managing drawing operations
 * Handles the drawing lifecycle (start, continue, end) and canvas updates
 */
export function useCanvasDrawing(canvasRefs: CanvasRefs): DrawingOperations {
  const dispatch = useAppDispatch();
  const updateFrameRef = useRef<number | null>(null);
  const selectionDragRef = useRef<{
    itemId: string;
    startPoint: Point;
    fromPoints: Point[];
  } | null>(null);
  
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

  useEffect(() => {
    return () => {
      if (updateFrameRef.current !== null) {
        cancelAnimationFrame(updateFrameRef.current);
      }
    };
  }, []);

  // Function to draw diagonal fold lines on the folded canvas
  const drawDiagonalFoldLinesOnFolded = useCallback(() => {
    if (!foldedCtxRef.current || !unfoldedCtxRef.current || !foldedCanvasRef.current) return;
    
    // Create proper CanvasContext for CanvasService
    const canvasContext = {
      foldedCtx: foldedCtxRef.current,
      unfoldedCtx: unfoldedCtxRef.current,
      foldedCanvas: foldedCanvasRef.current,
      unfoldedCanvas: unfoldedCtxRef.current.canvas
    };
    
    CanvasService.drawDiagonalFoldLinesOnFolded(canvasContext, getState().folds);
  }, [getState, foldedCtxRef, unfoldedCtxRef, foldedCanvasRef]);

  // Function to update the unfolded canvas by mirroring the folded canvas
  const updateUnfoldedCanvasUnthrottled = useCallback(() => {
    const foldedContext = getCanvasContext();
    if (!foldedContext || !foldedCtxRef.current || !unfoldedCtxRef.current || !foldedCanvasRef.current) return;

    // Check if WebGL should be used based on user selection and browser support
    const config = DrawingModeFactory.getConfig();
    const shouldUseWebGL = (
      WebGLCanvasService.isWebGLAvailable() && 
      !WebGLCanvasService.hasWebGLInitializationFailed() &&
      (config.renderingMode === 'webgl' || 
       (config.renderingMode === 'auto' && config.useWebGL))
    );
    
    if (!shouldUseWebGL) {
      logger.canvas.operation('Using Canvas 2D (WebGL not available or failed)');
      
      // Create proper CanvasContext for CanvasService
      const canvasContext = {
        foldedCtx: foldedCtxRef.current,
        unfoldedCtx: unfoldedCtxRef.current,
        foldedCanvas: foldedCanvasRef.current,
        unfoldedCanvas: unfoldedCtxRef.current.canvas
      };
      
      CanvasService.updateUnfoldedCanvas(canvasContext, getState().folds);
      return;
    }

    // Try WebGL first, fall back to Canvas 2D if needed
    logger.canvas.render('Attempting WebGL update');
    const webglSuccess = WebGLCanvasService.updateUnfoldedCanvasWebGL(foldedContext, getState().folds);
    
    if (!webglSuccess) {
      // Fallback to Canvas 2D
      logger.canvas.operation('WebGL update failed, using Canvas 2D fallback');
      
      // Create proper CanvasContext for CanvasService
      const canvasContext = {
        foldedCtx: foldedCtxRef.current,
        unfoldedCtx: unfoldedCtxRef.current,
        foldedCanvas: foldedCanvasRef.current,
        unfoldedCanvas: unfoldedCtxRef.current.canvas
      };
      
      CanvasService.updateUnfoldedCanvas(canvasContext, getState().folds);
    } else {
      logger.canvas.operation('WebGL update successful');
    }
  }, [getState, getCanvasContext, foldedCtxRef, unfoldedCtxRef, foldedCanvasRef]);

  const updateUnfoldedCanvas = useCallback(() => {
    if (updateFrameRef.current !== null) {
      return;
    }

    updateFrameRef.current = requestAnimationFrame(() => {
      updateFrameRef.current = null;
      updateUnfoldedCanvasUnthrottled();
    });
  }, [updateUnfoldedCanvasUnthrottled]);

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
  const isDrawing = useCallback(
    () => getState().isDrawing || selectionDragRef.current !== null,
    [getState]
  );

  // Helper to check if using WebGL
  const isUsingWebGL = useCallback(() => {
    return WebGLCanvasService.isWebGLAvailable();
  }, []);

  // Helper to get WebGL info
  const getWebGLInfo = useCallback(() => {
    return WebGLCanvasService.getWebGLInfo();
  }, []);

  const nudgeSelection = useCallback(
    (delta: Point) => {
      const currentState = getState();
      const selectedId = currentState.selectedHistoryItemId;
      if (!selectedId) return;

      const selectedItem = buildDrawableHistory(currentState.history)
        .find((item) => item.id === selectedId);
      if (!selectedItem) return;

      dispatch({
        type: ActionType.ADD_HISTORY_ITEM,
        payload: createMoveHistoryItem(
          selectedId,
          selectedItem.points,
          translatePoints(selectedItem.points, delta)
        ),
      });
    },
    [dispatch, getState]
  );

  const clearSelection = useCallback(() => {
    selectionDragRef.current = null;
    dispatch({ type: ActionType.CLEAR_SELECTION });
  }, [dispatch]);

  // Common start drawing function
  const startDrawing = useCallback(
    (x: number, y: number) => {
      const currentState = getState();
      if (currentState.currentTool === DrawingTool.SelectMove) {
        const point = { x, y };
        const selectedItem = findTopmostDrawable(point, currentState.history, currentState.lineThickness);

        if (!selectedItem) {
          selectionDragRef.current = null;
          dispatch({ type: ActionType.CLEAR_SELECTION });
          dispatch({ type: ActionType.SET_IS_DRAWING, payload: false });
          return;
        }

        selectionDragRef.current = {
          itemId: selectedItem.id,
          startPoint: point,
          fromPoints: selectedItem.points,
        };
        dispatch({ type: ActionType.SET_SELECTED_HISTORY_ITEM_ID, payload: selectedItem.id });
        dispatch({ type: ActionType.SET_SELECTION_DRAG_DELTA, payload: { x: 0, y: 0 } });
        dispatch({ type: ActionType.SET_IS_DRAWING, payload: true });
        return;
      }

      const mode = DrawingModeFactory.getTool(getState().currentTool);
      if (!foldedCtxRef.current || !unfoldedCtxRef.current) return;
      
      logger.canvas.operation("startDrawing", { 
        x, y, 
        tool: getState().currentTool,
        webgl: isUsingWebGL()
      });
      
      mode.start(
        { x, y },
        {
          getState,
          dispatch,
          foldedCtx: foldedCtxRef.current,
          unfoldedCtx: unfoldedCtxRef.current,
          foldedCanvas: foldedCanvasRef.current || undefined,
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
      foldedCanvasRef,
      getFoldedCanvasDimensions,
      getUnfoldedCanvasDimensions,
      updateUnfoldedCanvas,
      drawDiagonalFoldLinesOnFolded,
      isInValidDrawingArea,
      isUsingWebGL,
    ]
  );

  // Common continue drawing function
  const continueDrawing = useCallback(
    (x: number, y: number) => {
      const currentState = getState();
      if (currentState.currentTool === DrawingTool.SelectMove) {
        if (!selectionDragRef.current) return;

        const delta = {
          x: x - selectionDragRef.current.startPoint.x,
          y: y - selectionDragRef.current.startPoint.y,
        };
        dispatch({ type: ActionType.SET_SELECTION_DRAG_DELTA, payload: delta });
        return;
      }

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
          foldedCanvas: foldedCanvasRef.current || undefined,
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
      foldedCanvasRef,
      getFoldedCanvasDimensions,
      getUnfoldedCanvasDimensions,
      updateUnfoldedCanvas,
      drawDiagonalFoldLinesOnFolded,
      isInValidDrawingArea,
      isUsingWebGL,
    ]
  );

  // Common end drawing function
  const endDrawing = useCallback(
    (point: Point | null) => {
      const currentState = getState();
      if (currentState.currentTool === DrawingTool.SelectMove) {
        const drag = selectionDragRef.current;
        if (!drag) {
          dispatch({ type: ActionType.SET_IS_DRAWING, payload: false });
          dispatch({ type: ActionType.SET_SELECTION_DRAG_DELTA, payload: null });
          return;
        }

        const delta = point
          ? { x: point.x - drag.startPoint.x, y: point.y - drag.startPoint.y }
          : currentState.selectionDragDelta ?? { x: 0, y: 0 };

        if (delta.x !== 0 || delta.y !== 0) {
          dispatch({
            type: ActionType.ADD_HISTORY_ITEM,
            payload: createMoveHistoryItem(
              drag.itemId,
              drag.fromPoints,
              translatePoints(drag.fromPoints, delta)
            ),
          });
        } else {
          dispatch({ type: ActionType.SET_SELECTION_DRAG_DELTA, payload: null });
        }

        dispatch({ type: ActionType.SET_IS_DRAWING, payload: false });
        selectionDragRef.current = null;
        return;
      }

      const mode = DrawingModeFactory.getTool(getState().currentTool);
      if (!foldedCtxRef.current || !unfoldedCtxRef.current) return;
      
      logger.canvas.operation("endDrawing", { point });
      
      const result = mode.end(point, {
        getState,
        dispatch,
        foldedCtx: foldedCtxRef.current,
        unfoldedCtx: unfoldedCtxRef.current,
        foldedCanvas: foldedCanvasRef.current || undefined,
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
      foldedCanvasRef,
      getFoldedCanvasDimensions,
      getUnfoldedCanvasDimensions,
      updateUnfoldedCanvas,
      drawDiagonalFoldLinesOnFolded,
      isInValidDrawingArea,
      isUsingWebGL,
    ]
  );

  return {
    startDrawing,
    continueDrawing,
    endDrawing,
    isDrawing,
    updateUnfoldedCanvas,
    isInValidDrawingArea,
    isUsingWebGL,
    getWebGLInfo,
    nudgeSelection,
    clearSelection,
  };
}

function findTopmostDrawable(
  point: Point,
  history: UndoableHistoryItem[],
  lineThickness: number
): DrawableHistoryItem | null {
  const drawables = buildDrawableHistory(history);

  for (let i = drawables.length - 1; i >= 0; i--) {
    const item = drawables[i];
    const geometry = DrawingModeFactory.getGeometry(item.action);
    if (geometry.hitTest(item, point, { lineThickness, hitTolerance: 8 })) {
      return item;
    }
  }

  return null;
}
