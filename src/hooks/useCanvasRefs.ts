import { useRef, useCallback, RefObject } from "react";
import { CanvasContext } from "../services/CanvasService";

export interface CanvasRefs {
  unfoldedCanvasRef: RefObject<HTMLCanvasElement | null>;
  foldedCanvasRef: RefObject<HTMLCanvasElement | null>;
  foldedCtxRef: RefObject<CanvasRenderingContext2D | null>;
  unfoldedCtxRef: RefObject<CanvasRenderingContext2D | null>;
  getCanvasContext: () => CanvasContext | null;
  getFoldedCanvasDimensions: () => CanvasDimensions | null;
  getUnfoldedCanvasDimensions: () => CanvasDimensions | null;
  assertCanvasRef: (canvasRef: RefObject<HTMLCanvasElement | null>) => HTMLCanvasElement;
}

export interface CanvasDimensions {
  width: number;
  height: number;
}

/**
 * Hook for managing canvas references and contexts
 * Handles canvas element refs and their 2D rendering contexts
 */
export function useCanvasRefs() {
  // Canvas element references
  const unfoldedCanvasRef = useRef<HTMLCanvasElement>(null);
  const foldedCanvasRef = useRef<HTMLCanvasElement>(null);

  // Canvas context references - shared across the app
  const foldedCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const unfoldedCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Helper to get complete canvas context - used by CanvasService
  const getCanvasContext = useCallback((): CanvasContext | null => {
    const unfoldedCanvas = unfoldedCanvasRef.current;
    const foldedCanvas = foldedCanvasRef.current;
    const unfoldedCtx = unfoldedCtxRef.current;
    const foldedCtx = foldedCtxRef.current;

    if (!unfoldedCanvas || !foldedCanvas || !unfoldedCtx || !foldedCtx) {
      return null;
    }

    return {
      unfoldedCanvas,
      foldedCanvas,
      unfoldedCtx,
      foldedCtx
    };
  }, []);

  // Canvas dimension getters
  const getFoldedCanvasDimensions = useCallback((): CanvasDimensions | null => {
    const canvas = foldedCanvasRef.current;
    if (!canvas) return null;

    return {
      width: canvas.width,
      height: canvas.height,
    };
  }, []);

  const getUnfoldedCanvasDimensions = useCallback((): CanvasDimensions | null => {
    const canvas = unfoldedCanvasRef.current;
    if (!canvas) return null;

    return {
      width: canvas.width,
      height: canvas.height,
    };
  }, []);

  // Helper to assert canvas ref exists (throws if not)
  const assertCanvasRef = useCallback((canvasRef: RefObject<HTMLCanvasElement | null>) => {
    if (!canvasRef.current) {
      throw new Error("Canvas ref is not set");
    }
    return canvasRef.current;
  }, []);

  return {
    // Canvas refs
    unfoldedCanvasRef,
    foldedCanvasRef,
    foldedCtxRef,
    unfoldedCtxRef,
    
    // Context helpers
    getCanvasContext,
    
    // Dimension helpers
    getFoldedCanvasDimensions,
    getUnfoldedCanvasDimensions,
    
    // Utility helpers
    assertCanvasRef,
  };
}
