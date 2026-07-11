import { useCallback } from "react";
import { useCanvasRefs } from "./useCanvasRefs";
import { useCanvasEvents } from "./useCanvasEvents";
import { useCanvasDrawing } from "./useCanvasDrawing";
import { CanvasService } from "../services/CanvasService";
import { useCanvasRuntime } from "./useCanvasRuntime";
export function useCanvas() {
  // Use the canvas refs hook
  const canvasRefs = useCanvasRefs();
  const {
    unfoldedCanvasRef,
    foldedCanvasRef,
    foldedCtxRef,
    unfoldedCtxRef,
  } = canvasRefs;

  const runtime = useCanvasRuntime(canvasRefs);

  // Use the canvas drawing hook
  const drawingOps = useCanvasDrawing(canvasRefs, runtime);

  // Canvas event handlers - extract only the drawing callbacks needed  
  const drawingCallbacks = {
    startDrawing: drawingOps.startDrawing,
    continueDrawing: drawingOps.continueDrawing,
    endDrawing: drawingOps.endDrawing,
    isDrawing: drawingOps.isDrawing,
    nudgeSelection: drawingOps.nudgeSelection,
    deleteSelection: drawingOps.deleteSelection,
    clearSelection: drawingOps.clearSelection,
  };
  const eventHandlers = useCanvasEvents(canvasRefs, drawingCallbacks);


  // Function to download the unfolded canvas as an image
  const downloadUnfoldedCanvas = useCallback(() => {
    const unfoldedCanvas = unfoldedCanvasRef.current;
    if (!unfoldedCanvas) return;
    CanvasService.downloadCanvas(unfoldedCanvas);
  }, [unfoldedCanvasRef]);

  return {
    unfoldedCanvasRef,
    foldedCanvasRef,
    foldedCtxRef,
    unfoldedCtxRef,
    downloadUnfoldedCanvas,
    isUsingWebGL: drawingOps.isUsingWebGL,
    getWebGLInfo: drawingOps.getWebGLInfo,
    ...eventHandlers,
    deleteSelection: drawingOps.deleteSelection,
  };
}
