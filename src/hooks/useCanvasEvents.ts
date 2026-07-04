import { useCallback } from "react";
import { CanvasService } from "../services/CanvasService";
import { logger } from "../utils/logger";
import { CanvasRefs } from "./useCanvasRefs";

export interface CanvasEventHandlers {
  handleMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  handleMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  handleMouseUp: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  handleMouseLeave: () => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLCanvasElement>) => void;
  handleTouchStart: (e: React.TouchEvent<HTMLCanvasElement>) => void;
  handleTouchMove: (e: React.TouchEvent<HTMLCanvasElement>) => void;
  handleTouchEnd: (e: React.TouchEvent<HTMLCanvasElement>) => void;
  handleTouchCancel: (e: React.TouchEvent<HTMLCanvasElement>) => void;
}

export interface DrawingCallbacks {
  startDrawing: (x: number, y: number) => void;
  continueDrawing: (x: number, y: number) => void;
  endDrawing: (point: { x: number; y: number } | null) => void;
  isDrawing: () => boolean;
  nudgeSelection: (delta: { x: number; y: number }) => void;
  deleteSelection: () => void;
  clearSelection: () => void;
}

/**
 * Hook for handling mouse and touch events on canvas
 * Converts browser events to drawing coordinates and delegates to drawing callbacks
 */
export function useCanvasEvents(
  canvasRefs: CanvasRefs,
  drawingCallbacks: DrawingCallbacks
): CanvasEventHandlers {
  const { foldedCanvasRef, assertCanvasRef } = canvasRefs;
  const {
    startDrawing,
    continueDrawing,
    endDrawing,
    isDrawing,
    nudgeSelection,
    deleteSelection,
    clearSelection
  } = drawingCallbacks;

  // Helper function to get canvas coordinates from mouse/touch event
  const getCanvasCoordinates = useCallback(
    (clientX: number, clientY: number, foldedCanvas: HTMLCanvasElement) => {
      const coords = CanvasService.getCanvasCoordinates(clientX, clientY, foldedCanvas);
      logger.canvas.event("coordinate conversion", coords);
      return coords;
    },
    []
  );

  // Handle mouse events for the folded canvas
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.currentTarget.focus();
      const foldedCanvas = assertCanvasRef(foldedCanvasRef);
      const coords = getCanvasCoordinates(e.clientX, e.clientY, foldedCanvas);
      logger.canvas.event("mouseDown", coords);
      startDrawing(coords.x, coords.y);
    },
    [getCanvasCoordinates, startDrawing, assertCanvasRef, foldedCanvasRef]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const foldedCanvas = assertCanvasRef(foldedCanvasRef);
      const coords = getCanvasCoordinates(e.clientX, e.clientY, foldedCanvas);
      logger.canvas.event("mouseMove", coords);
      continueDrawing(coords.x, coords.y);
    },
    [getCanvasCoordinates, continueDrawing, assertCanvasRef, foldedCanvasRef]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const foldedCanvas = assertCanvasRef(foldedCanvasRef);
      const coords = getCanvasCoordinates(e.clientX, e.clientY, foldedCanvas);
      logger.canvas.event("mouseUp", coords);
      endDrawing(coords);
    },
    [getCanvasCoordinates, endDrawing, assertCanvasRef, foldedCanvasRef]
  );

  const handleMouseLeave = useCallback(() => {
    if (isDrawing()) {
      logger.canvas.event("mouseLeave", { x: 0, y: 0 });
      endDrawing(null);
    }
  }, [isDrawing, endDrawing]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLCanvasElement>) => {
      const step = e.shiftKey ? 10 : 1;
      const keyDeltas: Record<string, { x: number; y: number }> = {
        ArrowUp: { x: 0, y: -step },
        ArrowDown: { x: 0, y: step },
        ArrowLeft: { x: -step, y: 0 },
        ArrowRight: { x: step, y: 0 },
      };

      if (e.key === "Escape") {
        e.preventDefault();
        clearSelection();
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelection();
        return;
      }

      const delta = keyDeltas[e.key];
      if (!delta) return;

      e.preventDefault();
      nudgeSelection(delta);
    },
    [clearSelection, deleteSelection, nudgeSelection]
  );

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
        logger.canvas.event("touchStart", coords);
        startDrawing(coords.x, coords.y);
      }
    },
    [getCanvasCoordinates, startDrawing, assertCanvasRef, foldedCanvasRef]
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
        logger.canvas.event("touchMove", coords);
        continueDrawing(coords.x, coords.y);
      }
    },
    [getCanvasCoordinates, continueDrawing, assertCanvasRef, foldedCanvasRef]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault(); // Prevent scrolling
      if (isDrawing() && e.changedTouches && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        const foldedCanvas = assertCanvasRef(foldedCanvasRef);
        const coords = getCanvasCoordinates(
          touch.clientX,
          touch.clientY,
          foldedCanvas
        );
        logger.canvas.event("touchEnd", coords);
        endDrawing(coords);
      }
    },
    [isDrawing, getCanvasCoordinates, endDrawing, assertCanvasRef, foldedCanvasRef]
  );

  const handleTouchCancel = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault(); // Prevent scrolling
      logger.canvas.event("touchCancel");
      endDrawing(null);
    },
    [endDrawing]
  );

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleKeyDown,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
  };
}
