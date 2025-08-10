import { useCallback } from "react";
import { useAppDispatch } from "./useReduxHooks";
import { useCanvasRefs } from "./useCanvasRefs";
import { useCanvasEvents } from "./useCanvasEvents";
import { useCanvasDrawing } from "./useCanvasDrawing";
import { useCanvasHistory } from "./useCanvasHistory";
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
  const canvasRefs = useCanvasRefs();
  const {
    unfoldedCanvasRef,
    foldedCanvasRef,
    foldedCtxRef,
    unfoldedCtxRef,
    getCanvasContext,
  } = canvasRefs;

  // Use the canvas drawing hook
  const drawingOps = useCanvasDrawing(canvasRefs);
  const {
    startDrawing,
    continueDrawing,
    endDrawing,
    isDrawing,
    updateUnfoldedCanvas,
  } = drawingOps;

  // Use the canvas history hook
  const historyOps = useCanvasHistory(canvasRefs);
  const {
    undo,
    drawFromHistory,
    resetCanvases,
  } = historyOps;

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
  }, [getState, getCanvasContext, foldedCtxRef]);




  // Canvas event handlers
  const eventHandlers = useCanvasEvents(canvasRefs, drawingOps);


  // Function to download the unfolded canvas as an image
  const downloadUnfoldedCanvas = useCallback(() => {
    const unfoldedCanvas = unfoldedCanvasRef.current;
    if (!unfoldedCanvas) return;
    CanvasService.downloadCanvas(unfoldedCanvas);
  }, [unfoldedCanvasRef]);

  return {
    unfoldedCanvasRef,
    foldedCanvasRef,
    clearCanvases,
    updateFoldedCanvasDimensions,
    drawFoldLines,
    updateUnfoldedCanvas,
    resetCanvases,
    downloadUnfoldedCanvas,
    ...eventHandlers,
    undo,
    drawFromHistory,
  };
}

