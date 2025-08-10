import { useCallback } from "react";
import { DrawingModeFactory } from "../drawingModes/DrawingModeFactory";
import { useAppDispatch } from "./useReduxHooks";
import { useCanvasRefs } from "./useCanvasRefs";
import {
  Point,
  UndoableHistoryItem,
} from "../types/DrawingMode";
import { debounce } from "lodash-es";
import { ActionType } from "../store/shiboriCanvasState";
import { useStore } from "react-redux";
import { RootState } from "../store";
import { CanvasService } from "../services/CanvasService";
import { logger } from "../utils/logger";


export function useCanvas() {
  const dispatch = useAppDispatch();

  //slightly cursed, no real need for the `shibori` namespace tbh but I don't feel like refactoring
  const { getState: _getState } = useStore<RootState>() as {
    getState: () => RootState;
  };
  const getState = useCallback(() => _getState().shibori, [_getState]);

  // Use the canvas refs hook
  const {
    unfoldedCanvasRef,
    foldedCanvasRef,
    foldedCtxRef,
    unfoldedCtxRef,
    getCanvasContext,
    getFoldedCanvasDimensions,
    getUnfoldedCanvasDimensions,
    assertCanvasRef,
  } = useCanvasRefs();

  // Function to clear both canvases
  const clearCanvases = useCallback((backgroundColor?: string) => {
    const context = getCanvasContext();
    if (!context) return;
    CanvasService.clearCanvases(context, backgroundColor);
  }, [getCanvasContext]);

  // Function to draw fold lines on the unfolded canvas
  const drawFoldLines = useCallback(() => {
    const context = getCanvasContext();
    if (!context) return;
    CanvasService.drawFoldLines(context, getState().folds);
  }, [getState, getCanvasContext]);

  // Function to update folded canvas dimensions
  const updateFoldedCanvasDimensions = useCallback(() => {
    const context = getCanvasContext();
    if (!context) return;
    const newCtx = CanvasService.updateFoldedCanvasDimensions(context, getState().folds);
    if (newCtx) {
      foldedCtxRef.current = newCtx;
    }
  }, [getState, getCanvasContext]);

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
    [getState]
  );

  // Helper function to get canvas coordinates from mouse/touch event
  const getCanvasCoordinates = useCallback(
    (clientX: number, clientY: number, foldedCanvas: HTMLCanvasElement) => {
      return CanvasService.getCanvasCoordinates(clientX, clientY, foldedCanvas);
    },
    []
  );


  // Common start drawing function
  const startDrawing = useCallback(
    (x: number, y: number) => {
      const mode = DrawingModeFactory.getTool(getState().currentTool);
      if (!foldedCtxRef.current || !unfoldedCtxRef.current) return;
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
      getFoldedCanvasDimensions,
      getUnfoldedCanvasDimensions,
      updateUnfoldedCanvas,
      drawDiagonalFoldLinesOnFolded,
      isInValidDrawingArea,
    ]
  );

  // Handle mouse events for the folded canvas
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const foldedCanvas = assertCanvasRef(foldedCanvasRef);
      const coords = getCanvasCoordinates(e.clientX, e.clientY, foldedCanvas);

      startDrawing(coords.x, coords.y);
    },
    [getCanvasCoordinates, startDrawing]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const foldedCanvas = assertCanvasRef(foldedCanvasRef);
      const coords = getCanvasCoordinates(e.clientX, e.clientY, foldedCanvas);

      continueDrawing(coords.x, coords.y);
    },
    [getCanvasCoordinates, continueDrawing]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const foldedCanvas = assertCanvasRef(foldedCanvasRef);
      const coords = getCanvasCoordinates(e.clientX, e.clientY, foldedCanvas);

      endDrawing(coords);
    },
    [getCanvasCoordinates, endDrawing]
  );

  const handleMouseLeave = useCallback(() => {
    if (getState().isDrawing) {
      if (!foldedCtxRef.current || !unfoldedCtxRef.current) return;
      endDrawing(null);
    }
  }, [
    getState,
    dispatch,
    getFoldedCanvasDimensions,
    getUnfoldedCanvasDimensions,
    updateUnfoldedCanvas,
    drawDiagonalFoldLinesOnFolded,
    isInValidDrawingArea,
  ]);

  // Handle touch events for mobile devices
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault(); // Prevent scrolling
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const foldedCanvas = assertCanvasRef(foldedCanvasRef);
        const coords = getCanvasCoordinates(
          touch.clientX,
          touch.clientY,
          foldedCanvas
        );
        if (!coords) return;

        startDrawing(coords.x, coords.y);
      }
    },
    [getCanvasCoordinates, startDrawing]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault(); // Prevent scrolling
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const foldedCanvas = assertCanvasRef(foldedCanvasRef);
        const coords = getCanvasCoordinates(
          touch.clientX,
          touch.clientY,
          foldedCanvas
        );
        if (!coords) return;

        continueDrawing(coords.x, coords.y);
      }
    },
    [getCanvasCoordinates, continueDrawing]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault(); // Prevent scrolling
      if (
        getState().isDrawing &&
        e.changedTouches &&
        e.changedTouches.length > 0
      ) {
        const touch = e.changedTouches[0];
        const foldedCanvas = assertCanvasRef(foldedCanvasRef);
        const coords = getCanvasCoordinates(
          touch.clientX,
          touch.clientY,
          foldedCanvas
        );
        if (coords) {
          endDrawing(coords);
        }
      }
    },
    [getState, getCanvasCoordinates, endDrawing]
  );

  const handleTouchCancel = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault(); // Prevent scrolling
      if (!foldedCtxRef.current || !unfoldedCtxRef.current) return;
      endDrawing(null)
    },
    [
      getState,
      dispatch,
      getFoldedCanvasDimensions,
      getUnfoldedCanvasDimensions,
      updateUnfoldedCanvas,
      drawDiagonalFoldLinesOnFolded,
      isInValidDrawingArea,
    ]
  );

  // Function called when initializing or resetting the drawing canvas
  const resetCanvases = useCallback(() => {
    logger.canvas.operation('resetCanvases called');
    const context = getCanvasContext();
    if (!context) return;
    CanvasService.resetCanvases(context, getState().folds);
  }, [getCanvasContext, getState]);

  // Function to download the unfolded canvas as an image
  const downloadUnfoldedCanvas = useCallback(() => {
    const unfoldedCanvas = unfoldedCanvasRef.current;
    if (!unfoldedCanvas) return;
    CanvasService.downloadCanvas(unfoldedCanvas);
  }, []);

  const drawFromHistory = useCallback(
    (historyItems: UndoableHistoryItem[]) => {
      const unfoldedCanvas = unfoldedCanvasRef.current;
      const unfoldedCtx = unfoldedCtxRef.current;
      const foldedCtx = foldedCtxRef.current;

      if (!unfoldedCanvas || !unfoldedCtx || !foldedCtx) return;

      logger.history.replay(historyItems.length);

      for (const historyItem of historyItems) {
        const { action, points } = historyItem;
        logger.canvas.operation(`processing ${action}`, { pointCount: points.length });
        const mode = DrawingModeFactory.getTool(action);
        const args = {
          getState,
          dispatch,
          foldedCtx,
          unfoldedCtx,
          getFoldedCanvasDimensions,
          getUnfoldedCanvasDimensions,
          updateUnfoldedCanvas,
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
        const endPoint = points.length > 0 ? points[points.length - 1] : null;
        logger.canvas.event('mode.end', endPoint);
        const result = mode.end(endPoint, args);
        logger.canvas.operation('mode.end result', result);
      }
    },
    [
      dispatch,
      drawDiagonalFoldLinesOnFolded,
      getFoldedCanvasDimensions,
      getUnfoldedCanvasDimensions,
      isInValidDrawingArea,
      getState,
      updateUnfoldedCanvas,
    ]
  );

  const undo = useCallback(() => {
    const historyLength = getState().history.length;
    if (historyLength > 0) {
      logger.history.undo(historyLength);
      dispatch({ type: ActionType.UNDO });
      const historyItems = getState().history;
      resetCanvases();
      drawFromHistory(historyItems);
      updateUnfoldedCanvasUnthrottled();
    }
  }, [
    getState,
    dispatch,
    resetCanvases,
    drawFromHistory,
    updateUnfoldedCanvasUnthrottled,
  ]);

  return {
    unfoldedCanvasRef,
    foldedCanvasRef,
    clearCanvases,
    updateFoldedCanvasDimensions,
    drawFoldLines,
    updateUnfoldedCanvas,
    resetCanvases,
    downloadUnfoldedCanvas,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
    undo,
    drawFromHistory,
  };
}

