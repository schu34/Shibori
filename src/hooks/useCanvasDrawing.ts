import { useCallback, useRef } from "react";
import { useStore } from "react-redux";
import { DrawingModeFactory } from "../drawingModes/DrawingModeFactory";
import { RootState } from "../store";
import { ActionType } from "../store/shiboriCanvasState";
import { DrawingTool } from "../types";
import {
  Bounds,
  DrawableDrawingTool,
  DrawingMode,
  DrawingModeContext,
  Point,
  UndoableHistoryItem,
} from "../types/DrawingMode";
import {
  expandBounds,
  getBoundsCenter,
  getBoundsCorners,
  getRectBounds,
  getSquareEndPoint,
  rotatePoints,
} from "../utils/geometryMath";
import {
  buildDrawableHistory,
  createDeleteHistoryItem,
  createMoveHistoryItem,
  createRotateHistoryItem,
  DrawableHistoryItem,
  getTranslatedHistoryItemPreview,
} from "../utils/historyOperations";
import { logger } from "../utils/logger";
import { CanvasRefs } from "./useCanvasRefs";
import { CanvasRuntime } from "./useCanvasRuntime";
import { useAppDispatch } from "./useReduxHooks";

const ROTATION_HANDLE_HIT_TOLERANCE = 34;

type GestureSession =
  | { kind: "draw"; tool: DrawableDrawingTool; mode: DrawingMode; context: DrawingModeContext }
  | { kind: "move"; itemId: string; startPoint: Point; fromItem: DrawableHistoryItem }
  | { kind: "rotate"; itemId: string; center: Point; startAngle: number; fromItem: DrawableHistoryItem };

export interface DrawingOperations {
  startDrawing: (x: number, y: number) => void;
  continueDrawing: (x: number, y: number) => void;
  endDrawing: (point: Point | null) => void;
  cancelDrawing: () => void;
  nudgeSelection: (delta: Point) => void;
  deleteSelection: () => void;
  clearSelection: () => void;
}

/** Owns one local drawing, move, or rotate session at a time. */
export function useCanvasDrawing(
  canvasRefs: CanvasRefs,
  runtime: CanvasRuntime
): DrawingOperations {
  const dispatch = useAppDispatch();
  const sessionRef = useRef<GestureSession | null>(null);
  const store = useStore<RootState>();
  const getState = useCallback(() => store.getState().shibori, [store]);
  const {
    foldedCanvasRef,
    foldedCtxRef,
    getFoldedCanvasDimensions,
  } = canvasRefs;
  const { drawDiagonalFoldedGuidance, scheduleUnfoldedUpdate } = runtime;

  const createModeContext = useCallback((): DrawingModeContext | null => {
    const foldedCtx = foldedCtxRef.current;
    if (!foldedCtx) return null;
    return {
      getState,
      foldedCtx,
      foldedCanvas: foldedCanvasRef.current ?? undefined,
      getFoldedCanvasDimensions,
      drawDiagonalFoldLinesOnFolded: drawDiagonalFoldedGuidance,
    };
  }, [drawDiagonalFoldedGuidance, foldedCanvasRef, foldedCtxRef, getFoldedCanvasDimensions, getState]);

  const cancelDrawing = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    sessionRef.current = null;

    if (session.kind === "draw") {
      session.mode.cancel(session.context);
      scheduleUnfoldedUpdate();
      return;
    }

    dispatch({
      type: session.kind === "move"
        ? ActionType.SET_SELECTION_DRAG_DELTA
        : ActionType.SET_SELECTION_ROTATION_PREVIEW,
      payload: null,
    });
  }, [dispatch, scheduleUnfoldedUpdate]);

  const nudgeSelection = useCallback((delta: Point) => {
    const currentState = getState();
    const selectedId = currentState.selectedHistoryItemId;
    if (!selectedId) return;
    const selectedItem = findDrawableById(selectedId, currentState.history);
    if (!selectedItem) return;
    const movedItem = getTranslatedHistoryItemPreview(selectedItem, delta);
    dispatch({
      type: ActionType.ADD_HISTORY_ITEM,
      payload: createMoveHistoryItem(
        selectedId,
        selectedItem.points,
        movedItem.points,
        selectedItem.rotation,
        movedItem.rotation,
        selectedItem.rotationCenter,
        movedItem.rotationCenter
      ),
    });
  }, [dispatch, getState]);

  const deleteSelection = useCallback(() => {
    const currentState = getState();
    const selectedId = currentState.selectedHistoryItemId;
    if (!selectedId || !findDrawableById(selectedId, currentState.history)) return;
    cancelDrawing();
    dispatch({ type: ActionType.ADD_HISTORY_ITEM, payload: createDeleteHistoryItem(selectedId) });
  }, [cancelDrawing, dispatch, getState]);

  const clearSelection = useCallback(() => {
    cancelDrawing();
    dispatch({ type: ActionType.CLEAR_SELECTION });
  }, [cancelDrawing, dispatch]);

  const startDrawing = useCallback((x: number, y: number) => {
    if (sessionRef.current) return;
    const state = getState();
    const point = { x, y };

    if (state.currentTool === DrawingTool.SelectMove) {
      const selectedItem = state.selectedHistoryItemId
        ? findDrawableById(state.selectedHistoryItemId, state.history)
        : null;
      const handle = selectedItem
        ? findRotationHandleHit(selectedItem, point, state.lineThickness)
        : null;

      if (selectedItem && handle) {
        sessionRef.current = {
          kind: "rotate",
          itemId: selectedItem.id!,
          center: handle.center,
          startAngle: Math.atan2(point.y - handle.center.y, point.x - handle.center.x),
          fromItem: selectedItem,
        };
        dispatch({ type: ActionType.SET_SELECTED_HISTORY_ITEM_ID, payload: selectedItem.id! });
        dispatch({ type: ActionType.SET_SELECTION_ROTATION_PREVIEW, payload: { angle: 0, center: handle.center } });
        return;
      }

      const hitItem = findTopmostDrawable(point, state.history, state.lineThickness);
      if (!hitItem) {
        dispatch({ type: ActionType.CLEAR_SELECTION });
        return;
      }

      sessionRef.current = {
        kind: "move",
        itemId: hitItem.id!,
        startPoint: point,
        fromItem: hitItem,
      };
      dispatch({ type: ActionType.SET_SELECTED_HISTORY_ITEM_ID, payload: hitItem.id! });
      dispatch({ type: ActionType.SET_SELECTION_DRAG_DELTA, payload: { x: 0, y: 0 } });
      return;
    }

    const context = createModeContext();
    if (!context) return;
    const tool = state.currentTool;
    const mode = DrawingModeFactory.getTool(tool);
    sessionRef.current = { kind: "draw", tool, mode, context };
    logger.canvas.operation("startDrawing", { x, y, tool });
    mode.start(point, context);
  }, [createModeContext, dispatch, getState]);

  const continueDrawing = useCallback((x: number, y: number) => {
    const session = sessionRef.current;
    if (!session) return;

    if (session.kind === "rotate") {
      const angle = Math.atan2(y - session.center.y, x - session.center.x) - session.startAngle;
      dispatch({ type: ActionType.SET_SELECTION_ROTATION_PREVIEW, payload: { angle, center: session.center } });
      return;
    }

    if (session.kind === "move") {
      dispatch({
        type: ActionType.SET_SELECTION_DRAG_DELTA,
        payload: { x: x - session.startPoint.x, y: y - session.startPoint.y },
      });
      return;
    }

    logger.canvas.operation("continueDrawing", { x, y, tool: session.tool });
    if (session.mode.continue({ x, y }, session.context)) scheduleUnfoldedUpdate();
  }, [dispatch, scheduleUnfoldedUpdate]);

  const endDrawing = useCallback((point: Point | null) => {
    const session = sessionRef.current;
    if (!session) return;
    sessionRef.current = null;

    if (session.kind === "rotate") {
      const previewAngle = getState().selectionRotationPreview?.angle ?? 0;
      const angle = point
        ? Math.atan2(point.y - session.center.y, point.x - session.center.x) - session.startAngle
        : previewAngle;
      if (Math.abs(angle) > 0.0001) {
        dispatch({ type: ActionType.ADD_HISTORY_ITEM, payload: createRotateHistoryItem(session.fromItem, angle, session.center) });
      } else {
        dispatch({ type: ActionType.SET_SELECTION_ROTATION_PREVIEW, payload: null });
      }
      return;
    }

    if (session.kind === "move") {
      const delta = point
        ? { x: point.x - session.startPoint.x, y: point.y - session.startPoint.y }
        : getState().selectionDragDelta ?? { x: 0, y: 0 };
      if (delta.x !== 0 || delta.y !== 0) {
        const movedItem = getTranslatedHistoryItemPreview(session.fromItem, delta);
        dispatch({
          type: ActionType.ADD_HISTORY_ITEM,
          payload: createMoveHistoryItem(
            session.itemId,
            session.fromItem.points,
            movedItem.points,
            session.fromItem.rotation,
            movedItem.rotation,
            session.fromItem.rotationCenter,
            movedItem.rotationCenter
          ),
        });
      } else {
        dispatch({ type: ActionType.SET_SELECTION_DRAG_DELTA, payload: null });
      }
      return;
    }

    logger.canvas.operation("endDrawing", { point, tool: session.tool });
    const result = session.mode.end(point, session.context);
    if (result) {
      dispatch({ type: ActionType.ADD_HISTORY_ITEM, payload: result });
      logger.history.add(result);
    }
  }, [dispatch, getState]);

  return {
    startDrawing,
    continueDrawing,
    endDrawing,
    cancelDrawing,
    nudgeSelection,
    deleteSelection,
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
    if (DrawingModeFactory.getGeometry(item.action).hitTest(item, point, { lineThickness, hitTolerance: 8 })) {
      return item;
    }
  }
  return null;
}

function findDrawableById(id: string, history: UndoableHistoryItem[]): DrawableHistoryItem | null {
  return buildDrawableHistory(history).find((item) => item.id === id) ?? null;
}

function findRotationHandleHit(
  item: DrawableHistoryItem,
  point: Point,
  lineThickness: number
): { center: Point; bounds: Bounds } | null {
  const shapeFrame = getRotatedShapeSelectionFrame(item, lineThickness);
  if (shapeFrame) {
    const tolerance = ROTATION_HANDLE_HIT_TOLERANCE + (lineThickness / 2);
    for (const corner of shapeFrame.corners) {
      if (Math.hypot(point.x - corner.x, point.y - corner.y) <= tolerance) {
        return { center: shapeFrame.center, bounds: shapeFrame.bounds };
      }
    }
    return null;
  }

  const bounds = DrawingModeFactory.getGeometry(item.action).getBounds(item, { lineThickness });
  if (!bounds) return null;
  const corners = getBoundsCorners(bounds);
  const tolerance = ROTATION_HANDLE_HIT_TOLERANCE + (lineThickness / 2);
  const center = getBoundsCenter(bounds);
  return corners.some((corner) => Math.hypot(point.x - corner.x, point.y - corner.y) <= tolerance)
    ? { center, bounds }
    : null;
}

function getRotatedShapeSelectionFrame(
  item: DrawableHistoryItem,
  lineThickness: number
): { bounds: Bounds; center: Point; corners: Point[] } | null {
  const bounds = getUnrotatedShapeSelectionBounds(item, lineThickness);
  if (!bounds) return null;
  const center = item.rotationCenter ?? getBoundsCenter(bounds);
  const corners = item.rotation
    ? rotatePoints(getBoundsCorners(bounds), center, item.rotation)
    : getBoundsCorners(bounds);
  return { bounds, center, corners };
}

function getUnrotatedShapeSelectionBounds(
  item: DrawableHistoryItem,
  lineThickness: number
): Bounds | null {
  if (item.points.length < 2) return null;
  if (item.action === DrawingTool.Rectangle) {
    return expandBounds(getRectBounds(item.points[0], item.points[1]), lineThickness / 2);
  }
  if (item.action === DrawingTool.Square) {
    return expandBounds(
      getRectBounds(item.points[0], getSquareEndPoint(item.points[0], item.points[1])),
      lineThickness / 2
    );
  }
  if (item.action === DrawingTool.Circle) {
    return DrawingModeFactory.getGeometry(item.action).getBounds(item, { lineThickness });
  }
  return null;
}
