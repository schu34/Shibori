import { useCallback, useEffect, useRef } from "react";
import { CanvasService } from "../services/CanvasService";
import { Point } from "../types/DrawingMode";
import { logger } from "../utils/logger";
import { CanvasRefs } from "./useCanvasRefs";
import type { PointerModifiers } from "./useCanvasDrawing";

export interface CanvasEventHandlers {
  handlePointerDown: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  handlePointerMove: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  handlePointerUp: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  handlePointerCancel: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  handleLostPointerCapture: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  handleKeyDown: (event: React.KeyboardEvent<HTMLCanvasElement>) => void;
}

export interface DrawingCallbacks {
  startDrawing: (x: number, y: number, modifiers?: PointerModifiers) => void;
  continueDrawing: (x: number, y: number, modifiers?: PointerModifiers) => void;
  endDrawing: (point: Point | null) => void;
  cancelDrawing: () => void;
  nudgeSelection: (delta: Point) => void;
  deleteSelection: () => void;
  clearSelection: () => void;
  hoverDrawing: (x: number, y: number) => void;
  finishDrawing: () => void;
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
    hoverDrawing,
    finishDrawing,
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
    startDrawing(point.x, point.y, { shiftKey: event.shiftKey, altKey: event.altKey });
  }, [coordinatesFor, startDrawing]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current === null) {
      const point = coordinatesFor(event);
      hoverDrawing(point.x, point.y);
      return;
    }
    if (activePointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    const point = coordinatesFor(event);
    logger.canvas.event("pointerMove", point);
    continueDrawing(point.x, point.y, { shiftKey: event.shiftKey, altKey: event.altKey });
  }, [continueDrawing, coordinatesFor, hoverDrawing]);

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

    // Browsers can drop capture after the pointer has already been released
    // without delivering the corresponding pointerup to this canvas (for
    // example, when the release happens outside the browser surface). Preserve
    // the preview in that case by committing its last known point. A capture
    // loss while a button is still held remains a cancellation.
    if (event.buttons === 0) {
      endDrawing(null);
      return;
    }
    cancelDrawing();
  }, [cancelDrawing, endDrawing]);

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
    if (event.key === "Enter") {
      event.preventDefault();
      finishDrawing();
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
  }, [clearSelection, deleteSelection, finishDrawing, nudgeSelection]);

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
