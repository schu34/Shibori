import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { shallowEqual, useStore } from 'react-redux';
import { RootState } from '../store';
import {
  ensureCanvasContext,
  mirrorUnfoldedCanvas,
  renderCanvasTransaction,
} from '../rendering/canvasRuntime';
import { CanvasRefs } from './useCanvasRefs';
import { useAppSelector } from './useReduxHooks';

export interface CanvasRuntime {
  scheduleUnfoldedUpdate: () => void;
}

export function selectCanvasRuntimeState(root: RootState) {
  const state = root.shibori;
  return {
    canvasDimensions: state.canvasDimensions,
    config: state.config,
    folds: state.folds,
    history: state.history,
    lineThickness: state.lineThickness,
    shapeFillMode: state.shapeFillMode,
    selectedHistoryItemId: state.selectedHistoryItemId,
    selectionDragDelta: state.selectionDragDelta,
    selectionRotationPreview: state.selectionRotationPreview,
  };
}

/** One owner for canvas sizing, committed replay, previews, and mirroring. */
export function useCanvasRuntime(canvasRefs: CanvasRefs): CanvasRuntime {
  const state = useAppSelector(selectCanvasRuntimeState, shallowEqual);
  const store = useStore<RootState>();
  const updateFrameRef = useRef<number | null>(null);
  const {
    foldedCanvasRef,
    unfoldedCanvasRef,
    foldedCtxRef,
    unfoldedCtxRef,
  } = canvasRefs;

  const getContext = useCallback(() => {
    const foldedCanvas = foldedCanvasRef.current;
    const unfoldedCanvas = unfoldedCanvasRef.current;
    if (!foldedCanvas || !unfoldedCanvas) return null;
    return ensureCanvasContext(
      { foldedCanvas, unfoldedCanvas },
      { foldedCtxRef, unfoldedCtxRef },
      store.getState().shibori.canvasDimensions,
      store.getState().shibori.folds
    );
  }, [foldedCanvasRef, foldedCtxRef, store, unfoldedCanvasRef, unfoldedCtxRef]);

  const cancelScheduledUpdate = useCallback(() => {
    if (updateFrameRef.current === null) return;
    cancelAnimationFrame(updateFrameRef.current);
    updateFrameRef.current = null;
  }, []);

  useLayoutEffect(() => {
    cancelScheduledUpdate();
    const context = getContext();
    if (!context) return;

    renderCanvasTransaction(context, {
      history: state.history,
      folds: state.folds,
      config: state.config,
      lineThickness: state.lineThickness,
      shapeFillMode: state.shapeFillMode,
      preview: {
        selectedHistoryItemId: state.selectedHistoryItemId,
        selectionDragDelta: state.selectionDragDelta,
        selectionRotationPreview: state.selectionRotationPreview,
      },
    });
  }, [
    cancelScheduledUpdate,
    getContext,
    state.canvasDimensions.width,
    state.canvasDimensions.height,
    state.config,
    state.folds,
    state.history,
    state.lineThickness,
    state.shapeFillMode,
    state.selectedHistoryItemId,
    state.selectionDragDelta,
    state.selectionRotationPreview,
  ]);

  useEffect(() => cancelScheduledUpdate, [cancelScheduledUpdate]);

  const scheduleUnfoldedUpdate = useCallback(() => {
    if (updateFrameRef.current !== null) return;
    updateFrameRef.current = requestAnimationFrame(() => {
      updateFrameRef.current = null;
      const context = getContext();
      if (!context) return;
      mirrorUnfoldedCanvas(context, store.getState().shibori.folds);
    });
  }, [getContext, store]);

  return { scheduleUnfoldedUpdate };
}
