import { useCallback, useEffect, useRef } from "react";
import { CanvasService } from "../services/CanvasService";
import { Point } from "../types/DrawingMode";
import { logger } from "../utils/logger";
import { CanvasRefs } from "./useCanvasRefs";

export interface CanvasEventHandlers {
  handlePointerDown: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  handlePointerMove: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  handlePointerUp: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  handlePointerCancel: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  handleLostPointerCapture: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  handleKeyDown: (event: React.KeyboardEvent<HTMLCanvasElement>) => void;
}

export interface DrawingCallbacks {
  startDrawing: (x: number, y: number) => void;
  continueDrawing: (x: number, y: number) => void;
  endDrawing: (point: Point | null) => void;
  cancelDrawing: () => void;
  nudgeSelection: (delta: Point) => void;
  deleteSelection: () => void;
  clearSelection: () => void;
}

export interface PointerStartLike {
  pointerType: string;
  button: number;
  isPrimary: boolean;
}

export function isSupportedPointerStart(event: PointerStartLike): boolean {
  return event.isPrimary && (event.pointerType !== "mouse" || event.button === 0);
}

export function getPointerCanvasCoordinates(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement
): Point {
  return CanvasService.getCanvasCoordinates(clientX, clientY, canvas);
}

/** Converts one captured primary pointer into canvas drawing operations. */
export function useCanvasEvents(
  canvasRefs: CanvasRefs,
  drawingCallbacks: DrawingCallbacks
): CanvasEventHandlers {
  const activePointerIdRef = useRef<number | null>(null);
  const { foldedCanvasRef, assertCanvasRef } = canvasRefs;
  const {
    startDrawing,
    continueDrawing,
    endDrawing,
    cancelDrawing,
    nudgeSelection,
    deleteSelection,
    clearSelection,
  } = drawingCallbacks;

  const coordinatesFor = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = assertCanvasRef(foldedCanvasRef);
    const coordinates = getPointerCanvasCoordinates(event.clientX, event.clientY, canvas);
    logger.canvas.event("pointer coordinate conversion", coordinates);
    return coordinates;
  }, [assertCanvasRef, foldedCanvasRef]);

  const releasePointer = useCallback((canvas: HTMLCanvasElement, pointerId: number) => {
    if (typeof canvas.hasPointerCapture === "function" && canvas.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId);
    }
  }, []);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== null || !isSupportedPointerStart(event)) return;
    event.preventDefault();
    event.currentTarget.focus();
    activePointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = coordinatesFor(event);
    logger.canvas.event("pointerDown", point);
    startDrawing(point.x, point.y);
  }, [coordinatesFor, startDrawing]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    const point = coordinatesFor(event);
    logger.canvas.event("pointerMove", point);
    continueDrawing(point.x, point.y);
  }, [continueDrawing, coordinatesFor]);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    const point = coordinatesFor(event);
    activePointerIdRef.current = null;
    releasePointer(event.currentTarget, event.pointerId);
    logger.canvas.event("pointerUp", point);
    endDrawing(point);
  }, [coordinatesFor, endDrawing, releasePointer]);

  const cancelPointer = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    activePointerIdRef.current = null;
    releasePointer(event.currentTarget, event.pointerId);
    logger.canvas.event("pointerCancel");
    cancelDrawing();
  }, [cancelDrawing, releasePointer]);

  const handleLostPointerCapture = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return;
    activePointerIdRef.current = null;
    logger.canvas.event("lostPointerCapture");
    cancelDrawing();
  }, [cancelDrawing]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLCanvasElement>) => {
    const step = event.shiftKey ? 10 : 1;
    const keyDeltas: Record<string, Point> = {
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
    };

    if (event.key === "Escape") {
      event.preventDefault();
      clearSelection();
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteSelection();
      return;
    }
    const delta = keyDeltas[event.key];
    if (!delta) return;
    event.preventDefault();
    nudgeSelection(delta);
  }, [clearSelection, deleteSelection, nudgeSelection]);

  useEffect(() => () => {
    activePointerIdRef.current = null;
    cancelDrawing();
  }, [cancelDrawing]);

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel: cancelPointer,
    handleLostPointerCapture,
    handleKeyDown,
  };
}
