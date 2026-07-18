import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "react-redux";
import { DrawingModeFactory } from "../drawingModes/DrawingModeFactory";
import { BezierMode } from "../drawingModes/BezierMode";
import { RootState } from "../store";
import { ActionType, State } from "../store/shiboriCanvasState";
import { DrawingTool } from "../types";
import {
  BezierPath,
  Bounds,
  DrawableDrawingTool,
  DrawingMode,
  DrawingModeContext,
  DrawingGuidance,
  Point,
  UndoableHistoryItem,
} from "../types/DrawingMode";
import {
  cloneBezierPath,
  convertBezierAnchor,
  findNearestBezierLocation,
  moveBezierAnchors,
  moveBezierHandle,
  splitBezierPathSegment,
} from "../utils/bezierPath";
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
  createUpdatePathHistoryItem,
  DrawableHistoryItem,
  getTranslatedHistoryItemPreview,
} from "../utils/historyOperations";
import { logger } from "../utils/logger";
import { CanvasRefs } from "./useCanvasRefs";
import { CanvasRuntime } from "./useCanvasRuntime";
import { useAppDispatch, useAppSelector } from "./useReduxHooks";

const ROTATION_HANDLE_HIT_TOLERANCE = 34;

type GestureSession =
  | { kind: "draw"; tool: DrawableDrawingTool; mode: DrawingMode; context: DrawingModeContext; phase: "active-pointer" | "awaiting-next-gesture" }
  | { kind: "move"; itemId: string; startPoint: Point; fromItem: DrawableHistoryItem }
  | { kind: "rotate"; itemId: string; center: Point; startAngle: number; fromItem: DrawableHistoryItem }
  | { kind: "path-anchor"; itemId: string; startPoint: Point; fromPath: BezierPath; anchorIds: string[] }
  | { kind: "path-handle"; itemId: string; anchorId: string; side: "in" | "out"; fromPath: BezierPath; breakPair: boolean };

export interface PointerModifiers {
  shiftKey?: boolean;
  altKey?: boolean;
}

export interface DrawingOperations {
  startDrawing: (x: number, y: number, modifiers?: PointerModifiers) => void;
  continueDrawing: (x: number, y: number, modifiers?: PointerModifiers) => void;
  endDrawing: (point: Point | null) => void;
  cancelDrawing: () => void;
  nudgeSelection: (delta: Point) => void;
  deleteSelection: () => void;
  clearSelection: () => void;
  drawingGuidance: DrawingGuidance | null;
  hoverDrawing: (x: number, y: number) => void;
  finishDrawing: () => void;
  hasPendingDrawing: boolean;
  convertPathSelection: () => void;
}

/** Owns one local drawing, move, or rotate session at a time. */
export function useCanvasDrawing(
  canvasRefs: CanvasRefs,
  runtime: CanvasRuntime
): DrawingOperations {
  const dispatch = useAppDispatch();
  const sessionRef = useRef<GestureSession | null>(null);
  const [drawingGuidance, setDrawingGuidance] = useState<DrawingGuidance | null>(null);
  const [hasPendingDrawing, setHasPendingDrawing] = useState(false);
  const store = useStore<RootState>();
  const currentTool = useAppSelector((state) => state.shibori.currentTool);
  const structuralKey = useAppSelector((state) => {
    const { canvasDimensions, folds } = state.shibori;
    return `${canvasDimensions.width}:${canvasDimensions.height}:${folds.vertical}:${folds.horizontal}:${folds.diagonal.enabled}:${folds.diagonal.count}:${folds.diagonal.direction}`;
  });
  const previousStructuralKeyRef = useRef(structuralKey);
  const getState = useCallback(() => store.getState().shibori, [store]);
  const {
    foldedCanvasRef,
    foldedCtxRef,
    getFoldedCanvasDimensions,
  } = canvasRefs;
  const { scheduleUnfoldedUpdate } = runtime;

  const createModeContext = useCallback((): DrawingModeContext | null => {
    const foldedCtx = foldedCtxRef.current;
    if (!foldedCtx) return null;
    return {
      getState,
      foldedCtx,
      foldedCanvas: foldedCanvasRef.current ?? undefined,
      getFoldedCanvasDimensions,
      setDrawingGuidance,
    };
  }, [foldedCanvasRef, foldedCtxRef, getFoldedCanvasDimensions, getState]);

  const cancelDrawing = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    sessionRef.current = null;

    if (session.kind === "draw") {
      session.mode.cancel(session.context);
      setDrawingGuidance(null);
      setHasPendingDrawing(false);
      scheduleUnfoldedUpdate();
      return;
    }

    if (session.kind === "path-anchor" || session.kind === "path-handle") {
      dispatch({ type: ActionType.SET_PATH_EDIT_PREVIEW, payload: null });
      return;
    }

    dispatch({
      type: session.kind === "move"
        ? ActionType.SET_SELECTION_DRAG_DELTA
        : ActionType.SET_SELECTION_ROTATION_PREVIEW,
      payload: null,
    });
  }, [dispatch, scheduleUnfoldedUpdate]);

  useEffect(() => {
    const session = sessionRef.current;
    if (session?.kind === "draw" &&
        session.phase === "awaiting-next-gesture" &&
        session.tool !== currentTool) {
      cancelDrawing();
    }
  }, [cancelDrawing, currentTool]);

  useEffect(() => {
    if (previousStructuralKeyRef.current !== structuralKey) {
      previousStructuralKeyRef.current = structuralKey;
      cancelDrawing();
    }
  }, [cancelDrawing, structuralKey]);

  const nudgeSelection = useCallback((delta: Point) => {
    const currentState = getState();
    const selectedId = currentState.selectedHistoryItemId;
    if (!selectedId) return;
    const selectedItem = findDrawableById(selectedId, currentState.history);
    if (!selectedItem) return;
    if (currentState.currentTool === DrawingTool.DirectSelect &&
        selectedItem.action === DrawingTool.Bezier && selectedItem.path &&
        (currentState.selectedPathAnchorIds?.length ?? 0) > 0) {
      const movedPath = moveBezierAnchors(
        selectedItem.path,
        new Set(currentState.selectedPathAnchorIds),
        delta
      );
      dispatch({
        type: ActionType.ADD_HISTORY_ITEM,
        payload: createUpdatePathHistoryItem(selectedId, selectedItem.path, movedPath),
      });
      return;
    }
    const movedItem = getTranslatedHistoryItemPreview(selectedItem, delta);
    if (selectedItem.action === DrawingTool.Bezier && movedItem.action === DrawingTool.Bezier && selectedItem.path && movedItem.path) {
      dispatch({
        type: ActionType.ADD_HISTORY_ITEM,
        payload: createUpdatePathHistoryItem(selectedId, selectedItem.path, movedItem.path),
      });
      return;
    }
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
    const selectedItem = selectedId ? findDrawableById(selectedId, currentState.history) : null;
    if (!selectedId || !selectedItem) return;
    cancelDrawing();
    if (currentState.currentTool === DrawingTool.DirectSelect &&
        selectedItem.action === DrawingTool.Bezier && selectedItem.path &&
        (currentState.selectedPathAnchorIds?.length ?? 0) > 0) {
      const selectedIds = new Set(currentState.selectedPathAnchorIds);
      const nextPath = cloneBezierPath(selectedItem.path);
      nextPath.anchors = nextPath.anchors.filter((anchor) => !selectedIds.has(anchor.id));
      if (nextPath.anchors.length < 2) {
        dispatch({ type: ActionType.ADD_HISTORY_ITEM, payload: createDeleteHistoryItem(selectedId) });
      } else {
        if (nextPath.closed && nextPath.anchors.length < 3) nextPath.closed = false;
        dispatch({
          type: ActionType.ADD_HISTORY_ITEM,
          payload: createUpdatePathHistoryItem(selectedId, selectedItem.path, nextPath),
        });
      }
      dispatch({ type: ActionType.SET_SELECTED_PATH_ANCHOR_IDS, payload: [] });
      return;
    }
    dispatch({ type: ActionType.ADD_HISTORY_ITEM, payload: createDeleteHistoryItem(selectedId) });
  }, [cancelDrawing, dispatch, getState]);

  const clearSelection = useCallback(() => {
    cancelDrawing();
    dispatch({ type: ActionType.CLEAR_SELECTION });
  }, [cancelDrawing, dispatch]);

  const startDrawing = useCallback((x: number, y: number, modifiers: PointerModifiers = {}) => {
    const existingSession = sessionRef.current;
    if (existingSession) {
      if (existingSession.kind === "draw" && existingSession.phase === "awaiting-next-gesture") {
        existingSession.phase = "active-pointer";
        existingSession.mode.start({ x, y }, existingSession.context);
      }
      return;
    }
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

    if (state.currentTool === DrawingTool.DirectSelect) {
      const directSession = createDirectSelectionSession(state, point, modifiers);
      if (!directSession) {
        dispatch({ type: ActionType.CLEAR_SELECTION });
        return;
      }
      if (modifiers.altKey && directSession.session.kind === "path-anchor" && directSession.anchorIds.length > 0) {
        let nextPath = cloneBezierPath(directSession.session.fromPath);
        for (const anchorId of directSession.anchorIds) nextPath = convertBezierAnchor(nextPath, anchorId);
        dispatch({ type: ActionType.SET_SELECTED_HISTORY_ITEM_ID, payload: directSession.itemId });
        dispatch({ type: ActionType.SET_SELECTED_PATH_ANCHOR_IDS, payload: directSession.anchorIds });
        dispatch({
          type: ActionType.ADD_HISTORY_ITEM,
          payload: createUpdatePathHistoryItem(directSession.itemId, directSession.session.fromPath, nextPath),
        });
        return;
      }
      sessionRef.current = directSession.session;
      dispatch({ type: ActionType.SET_SELECTED_HISTORY_ITEM_ID, payload: directSession.itemId });
      dispatch({ type: ActionType.SET_SELECTED_PATH_ANCHOR_IDS, payload: directSession.anchorIds });
      if (directSession.handle) {
        dispatch({ type: ActionType.SET_SELECTED_PATH_HANDLE, payload: directSession.handle });
      }
      return;
    }

    if (state.currentTool === DrawingTool.Bezier) {
      const endpoint = findBezierEndpointHit(point, state.history);
      if (endpoint) {
        const context = createModeContext();
        if (!context) return;
        const mode = DrawingModeFactory.getTool(DrawingTool.Bezier) as BezierMode;
        mode.resumePath(endpoint.item.id, endpoint.item.path!, endpoint.fromStart, point, context);
        sessionRef.current = {
          kind: "draw",
          tool: DrawingTool.Bezier,
          mode,
          context,
          phase: "active-pointer",
        };
        return;
      }
      const insertion = findBezierSegmentHit(point, state.history, state.lineThickness);
      if (insertion && insertion.location.distance <= 10 + (state.lineThickness / 2)) {
        const anchorId = createNextAnchorId(insertion.item);
        const nextPath = splitBezierPathSegment(
          insertion.item.path!, insertion.location.segmentIndex, insertion.location.t, anchorId
        );
        dispatch({
          type: ActionType.ADD_HISTORY_ITEM,
          payload: createUpdatePathHistoryItem(insertion.item.id, insertion.item.path!, nextPath),
        });
        return;
      }
    }

    const context = createModeContext();
    if (!context) return;
    const tool = state.currentTool;
    const mode = DrawingModeFactory.getTool(tool);
    sessionRef.current = { kind: "draw", tool, mode, context, phase: "active-pointer" };
    logger.canvas.operation("startDrawing", { x, y, tool });
    mode.start(point, context);
  }, [createModeContext, dispatch, getState]);

  const continueDrawing = useCallback((x: number, y: number, modifiers: PointerModifiers = {}) => {
    const session = sessionRef.current;
    if (!session) return;

    if (session.kind === "path-anchor") {
      const path = moveBezierAnchors(
        session.fromPath,
        new Set(session.anchorIds),
        { x: x - session.startPoint.x, y: y - session.startPoint.y }
      );
      dispatch({ type: ActionType.SET_PATH_EDIT_PREVIEW, payload: { itemId: session.itemId, path } });
      return;
    }

    if (session.kind === "path-handle") {
      const anchor = session.fromPath.anchors.find((candidate) => candidate.id === session.anchorId);
      const point = modifiers.shiftKey && anchor ? constrainHandlePoint(anchor.point, { x, y }) : { x, y };
      const path = moveBezierHandle(
        session.fromPath,
        session.anchorId,
        session.side,
        point,
        session.breakPair || !!modifiers.altKey
      );
      dispatch({ type: ActionType.SET_PATH_EDIT_PREVIEW, payload: { itemId: session.itemId, path } });
      return;
    }

    if (session.kind === "draw" && session.phase !== "active-pointer") return;

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
    if (session.kind === "path-anchor" || session.kind === "path-handle") {
      sessionRef.current = null;
      const preview = getState().pathEditPreview;
      if (preview?.itemId === session.itemId) {
        dispatch({
          type: ActionType.ADD_HISTORY_ITEM,
          payload: createUpdatePathHistoryItem(session.itemId, session.fromPath, preview.path),
        });
      } else {
        dispatch({ type: ActionType.SET_PATH_EDIT_PREVIEW, payload: null });
      }
      return;
    }

    if (session.kind === "rotate") {
      sessionRef.current = null;
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
      sessionRef.current = null;
      const delta = point
        ? { x: point.x - session.startPoint.x, y: point.y - session.startPoint.y }
        : getState().selectionDragDelta ?? { x: 0, y: 0 };
      if (delta.x !== 0 || delta.y !== 0) {
        const movedItem = getTranslatedHistoryItemPreview(session.fromItem, delta);
        if (session.fromItem.action === DrawingTool.Bezier &&
            movedItem.action === DrawingTool.Bezier &&
            session.fromItem.path && movedItem.path) {
          dispatch({
            type: ActionType.ADD_HISTORY_ITEM,
            payload: createUpdatePathHistoryItem(session.itemId, session.fromItem.path, movedItem.path),
          });
          return;
        }
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
    if (result.status === "continue") {
      if (getState().currentTool !== session.tool) {
        sessionRef.current = null;
        session.mode.cancel(session.context);
        setDrawingGuidance(null);
        scheduleUnfoldedUpdate();
        return;
      }
      session.phase = "awaiting-next-gesture";
      setHasPendingDrawing(true);
      return;
    }

    sessionRef.current = null;
    setDrawingGuidance(null);
    setHasPendingDrawing(false);
    if (result.status === "commit") {
      dispatch({ type: ActionType.ADD_HISTORY_ITEM, payload: result.item });
      logger.history.add(result.item);
    }
  }, [dispatch, getState, scheduleUnfoldedUpdate]);

  const hoverDrawing = useCallback((x: number, y: number) => {
    const session = sessionRef.current;
    if (session?.kind !== "draw" || session.phase !== "awaiting-next-gesture" || !session.mode.hover) return;
    if (session.mode.hover({ x, y }, session.context)) scheduleUnfoldedUpdate();
  }, [scheduleUnfoldedUpdate]);

  const finishDrawing = useCallback(() => {
    const session = sessionRef.current;
    if (session?.kind !== "draw" || !session.mode.finish) return;
    const result = session.mode.finish(session.context);
    sessionRef.current = null;
    setDrawingGuidance(null);
    setHasPendingDrawing(false);
    if (result.status === "commit") {
      dispatch({ type: ActionType.ADD_HISTORY_ITEM, payload: result.item });
      logger.history.add(result.item);
    } else {
      scheduleUnfoldedUpdate();
    }
  }, [dispatch, scheduleUnfoldedUpdate]);

  const convertPathSelection = useCallback(() => {
    const state = getState();
    const item = state.selectedHistoryItemId
      ? findDrawableById(state.selectedHistoryItemId, state.history)
      : null;
    if (!item || item.action !== DrawingTool.Bezier || !item.path || !state.selectedPathAnchorIds?.length) return;
    let nextPath = cloneBezierPath(item.path);
    for (const anchorId of state.selectedPathAnchorIds) {
      nextPath = convertBezierAnchor(nextPath, anchorId);
    }
    dispatch({
      type: ActionType.ADD_HISTORY_ITEM,
      payload: createUpdatePathHistoryItem(item.id, item.path, nextPath),
    });
  }, [dispatch, getState]);

  return {
    startDrawing,
    continueDrawing,
    endDrawing,
    cancelDrawing,
    nudgeSelection,
    deleteSelection,
    clearSelection,
    drawingGuidance,
    hoverDrawing,
    finishDrawing,
    hasPendingDrawing,
    convertPathSelection,
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

function createDirectSelectionSession(
  state: State,
  point: Point,
  modifiers: PointerModifiers
): {
  session: Extract<GestureSession, { kind: "path-anchor" | "path-handle" }>;
  itemId: string;
  anchorIds: string[];
  handle?: { anchorId: string; side: "in" | "out" };
} | null {
  const drawables = buildDrawableHistory(state.history);
  const selected = state.selectedHistoryItemId
    ? drawables.find((item) => item.id === state.selectedHistoryItemId)
    : null;
  if (selected?.action === DrawingTool.Bezier && selected.path) {
    for (const anchorId of state.selectedPathAnchorIds ?? []) {
      const anchor = selected.path.anchors.find((candidate) => candidate.id === anchorId);
      if (!anchor) continue;
      for (const side of ["in", "out"] as const) {
        const handle = side === "in" ? anchor.inHandle : anchor.outHandle;
        if (handle && pointDistance(handle, point) <= 14) {
          return {
            session: {
              kind: "path-handle",
              itemId: selected.id,
              anchorId,
              side,
              fromPath: selected.path,
              breakPair: !!modifiers.altKey,
            },
            itemId: selected.id,
            anchorIds: state.selectedPathAnchorIds ?? [],
            handle: { anchorId, side },
          };
        }
      }
    }
  }

  for (let itemIndex = drawables.length - 1; itemIndex >= 0; itemIndex--) {
    const item = drawables[itemIndex];
    if (item.action !== DrawingTool.Bezier || !item.path) continue;
    const anchor = item.path.anchors.find((candidate) => pointDistance(candidate.point, point) <= 16);
    if (anchor) {
      const existing = item.id === state.selectedHistoryItemId ? state.selectedPathAnchorIds ?? [] : [];
      const anchorIds = modifiers.shiftKey
        ? existing.includes(anchor.id)
          ? existing.filter((id) => id !== anchor.id)
          : [...existing, anchor.id]
        : [anchor.id];
      return {
        session: {
          kind: "path-anchor",
          itemId: item.id,
          startPoint: point,
          fromPath: item.path,
          anchorIds,
        },
        itemId: item.id,
        anchorIds,
      };
    }
    const location = findNearestBezierLocation(item.path, point);
    if (location && location.distance <= 10 + (state.lineThickness / 2)) {
      return {
        session: {
          kind: "path-anchor",
          itemId: item.id,
          startPoint: point,
          fromPath: item.path,
          anchorIds: [],
        },
        itemId: item.id,
        anchorIds: [],
      };
    }
  }
  return null;
}

function findBezierSegmentHit(
  point: Point,
  history: UndoableHistoryItem[],
  lineThickness: number
): { item: DrawableHistoryItem & { action: DrawingTool.Bezier; path: BezierPath }; location: NonNullable<ReturnType<typeof findNearestBezierLocation>> } | null {
  const drawables = buildDrawableHistory(history);
  for (let index = drawables.length - 1; index >= 0; index--) {
    const item = drawables[index];
    if (item.action !== DrawingTool.Bezier || !item.path) continue;
    const location = findNearestBezierLocation(item.path, point);
    if (location && location.distance <= 10 + (lineThickness / 2)) {
      return { item: item as DrawableHistoryItem & { action: DrawingTool.Bezier; path: BezierPath }, location };
    }
  }
  return null;
}

function findBezierEndpointHit(
  point: Point,
  history: UndoableHistoryItem[]
): { item: DrawableHistoryItem & { action: DrawingTool.Bezier; path: BezierPath }; fromStart: boolean } | null {
  const drawables = buildDrawableHistory(history);
  for (let index = drawables.length - 1; index >= 0; index--) {
    const item = drawables[index];
    if (item.action !== DrawingTool.Bezier || !item.path || item.path.closed) continue;
    const first = item.path.anchors[0];
    const last = item.path.anchors[item.path.anchors.length - 1];
    if (first && pointDistance(first.point, point) <= 16) {
      return { item: item as DrawableHistoryItem & { action: DrawingTool.Bezier; path: BezierPath }, fromStart: true };
    }
    if (last && pointDistance(last.point, point) <= 16) {
      return { item: item as DrawableHistoryItem & { action: DrawingTool.Bezier; path: BezierPath }, fromStart: false };
    }
  }
  return null;
}

function createNextAnchorId(item: DrawableHistoryItem & { path?: BezierPath }): string {
  const used = new Set(item.path?.anchors.map((anchor) => anchor.id) ?? []);
  let index = 1;
  let id = `${item.id}:anchor:${index}`;
  while (used.has(id)) id = `${item.id}:anchor:${++index}`;
  return id;
}

function constrainHandlePoint(anchor: Point, point: Point): Point {
  const distance = pointDistance(anchor, point);
  const angle = Math.atan2(point.y - anchor.y, point.x - anchor.x);
  const constrained = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
  return {
    x: anchor.x + (Math.cos(constrained) * distance),
    y: anchor.y + (Math.sin(constrained) * distance),
  };
}

function pointDistance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
