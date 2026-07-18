import { act, renderHook } from "@testing-library/react";
import { PropsWithChildren } from "react";
import { Provider } from "react-redux";
import { DrawingModeFactory } from "../drawingModes/DrawingModeFactory";
import { CanvasRefs } from "../hooks/useCanvasRefs";
import { CanvasRuntime } from "../hooks/useCanvasRuntime";
import { useCanvasDrawing } from "../hooks/useCanvasDrawing";
import { createAppStore } from "../store";
import { ActionType } from "../store/shiboriCanvasState";
import { DrawingTool } from "../types";
import { DrawingMode, DrawingModeContext, Point } from "../types/DrawingMode";

function harness() {
  const store = createAppStore();
  const foldedCanvas = document.createElement("canvas");
  foldedCanvas.width = 100;
  foldedCanvas.height = 100;
  const foldedCtx = {} as CanvasRenderingContext2D;
  const refs: CanvasRefs = {
    foldedCanvasRef: { current: foldedCanvas },
    unfoldedCanvasRef: { current: document.createElement("canvas") },
    foldedCtxRef: { current: foldedCtx },
    unfoldedCtxRef: { current: null },
    getFoldedCanvasDimensions: () => ({ width: 100, height: 100 }),
    assertCanvasRef: (ref) => {
      if (!ref.current) throw new Error("missing canvas");
      return ref.current;
    },
  };
  const runtime: CanvasRuntime = {
    scheduleUnfoldedUpdate: jest.fn(),
  };
  const wrapper = ({ children }: PropsWithChildren) => <Provider store={store}>{children}</Provider>;
  return { store, refs, runtime, wrapper };
}

function drawingMode(): jest.Mocked<DrawingMode> {
  return {
    start: jest.fn(),
    continue: jest.fn((point: Point, context: DrawingModeContext) => {
      void point;
      void context;
      return true;
    }),
    end: jest.fn((point: Point | null, context: DrawingModeContext) => {
      void point;
      void context;
      return { status: "discard" };
    }),
    cancel: jest.fn(),
  };
}

describe("drawing gesture session", () => {
  afterEach(() => jest.restoreAllMocks());

  test("continue and end use the mode captured at pointer down", () => {
    const setup = harness();
    const capturedMode = drawingMode();
    const factory = jest.spyOn(DrawingModeFactory, "getTool").mockReturnValue(capturedMode);
    const { result } = renderHook(() => useCanvasDrawing(setup.refs, setup.runtime), {
      wrapper: setup.wrapper,
    });

    act(() => result.current.startDrawing(1, 2));
    act(() => setup.store.dispatch({ type: ActionType.SET_CURRENT_TOOL, payload: DrawingTool.Line }));
    act(() => result.current.continueDrawing(3, 4));
    act(() => result.current.endDrawing({ x: 5, y: 6 }));

    expect(factory).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledWith(DrawingTool.Paintbrush);
    expect(capturedMode.start).toHaveBeenCalledWith({ x: 1, y: 2 }, expect.any(Object));
    expect(capturedMode.continue).toHaveBeenCalledWith({ x: 3, y: 4 }, expect.any(Object));
    expect(capturedMode.end).toHaveBeenCalledWith({ x: 5, y: 6 }, expect.any(Object));
  });

  test("cancel invokes mode cancellation and never commits history", () => {
    const setup = harness();
    const capturedMode = drawingMode();
    jest.spyOn(DrawingModeFactory, "getTool").mockReturnValue(capturedMode);
    const { result } = renderHook(() => useCanvasDrawing(setup.refs, setup.runtime), {
      wrapper: setup.wrapper,
    });

    act(() => result.current.startDrawing(1, 2));
    act(() => result.current.cancelDrawing());

    expect(capturedMode.cancel).toHaveBeenCalledTimes(1);
    expect(capturedMode.end).not.toHaveBeenCalled();
    expect(setup.store.getState().shibori.history).toEqual([]);
    expect(setup.runtime.scheduleUnfoldedUpdate).toHaveBeenCalledTimes(1);
  });

  test("retains a continuing mode across gestures and commits only once", () => {
    const setup = harness();
    const capturedMode = drawingMode();
    capturedMode.end
      .mockReturnValueOnce({ status: "continue" })
      .mockReturnValueOnce({
        status: "commit",
        item: {
          action: DrawingTool.Line,
          points: [{ x: 1, y: 2 }, { x: 7, y: 8 }],
        },
      });
    const factory = jest.spyOn(DrawingModeFactory, "getTool").mockReturnValue(capturedMode);
    const { result } = renderHook(() => useCanvasDrawing(setup.refs, setup.runtime), {
      wrapper: setup.wrapper,
    });

    act(() => result.current.startDrawing(1, 2));
    act(() => result.current.endDrawing({ x: 3, y: 4 }));
    expect(setup.store.getState().shibori.history).toEqual([]);

    act(() => result.current.startDrawing(5, 6));
    act(() => result.current.endDrawing({ x: 7, y: 8 }));

    expect(factory).toHaveBeenCalledTimes(1);
    expect(capturedMode.start).toHaveBeenCalledTimes(2);
    expect(setup.store.getState().shibori.history).toHaveLength(1);
  });

  test("direct selection commits one UpdatePath command for an anchor drag", () => {
    const setup = harness();
    setup.store.dispatch({
      type: ActionType.ADD_HISTORY_ITEM,
      payload: {
        id: 'curve',
        action: DrawingTool.Bezier,
        points: [],
        path: {
          closed: false,
          anchors: [
            { id: 'a', point: { x: 10, y: 20 }, inHandle: null, outHandle: { x: 30, y: 20 }, kind: 'corner' },
            { id: 'b', point: { x: 80, y: 20 }, inHandle: { x: 60, y: 20 }, outHandle: null, kind: 'corner' },
          ],
        },
      },
    });
    setup.store.dispatch({ type: ActionType.SET_CURRENT_TOOL, payload: DrawingTool.DirectSelect });
    const { result } = renderHook(() => useCanvasDrawing(setup.refs, setup.runtime), {
      wrapper: setup.wrapper,
    });

    act(() => result.current.startDrawing(10, 20));
    act(() => result.current.continueDrawing(20, 30));
    act(() => result.current.endDrawing({ x: 20, y: 30 }));

    const history = setup.store.getState().shibori.history;
    expect(history).toHaveLength(2);
    expect(history[1]).toEqual(expect.objectContaining({
      action: 'updatePath',
      itemId: 'curve',
      toPath: expect.objectContaining({
        anchors: expect.arrayContaining([expect.objectContaining({ point: { x: 20, y: 30 } })]),
      }),
    }));
  });

  test("the pen inserts an anchor on an existing segment with one UpdatePath command", () => {
    const setup = harness();
    setup.store.dispatch({
      type: ActionType.ADD_HISTORY_ITEM,
      payload: {
        id: 'curve',
        action: DrawingTool.Bezier,
        points: [],
        path: {
          closed: false,
          anchors: [
            { id: 'a', point: { x: 10, y: 20 }, inHandle: null, outHandle: { x: 30, y: 20 }, kind: 'corner' },
            { id: 'b', point: { x: 80, y: 20 }, inHandle: { x: 60, y: 20 }, outHandle: null, kind: 'corner' },
          ],
        },
      },
    });
    setup.store.dispatch({ type: ActionType.SET_CURRENT_TOOL, payload: DrawingTool.Bezier });
    const { result } = renderHook(() => useCanvasDrawing(setup.refs, setup.runtime), {
      wrapper: setup.wrapper,
    });

    act(() => result.current.startDrawing(45, 20));

    const history = setup.store.getState().shibori.history;
    expect(history).toHaveLength(2);
    expect(history[1]).toEqual(expect.objectContaining({
      action: 'updatePath',
      itemId: 'curve',
      toPath: expect.objectContaining({ anchors: expect.any(Array) }),
    }));
    if (history[1].action !== 'updatePath') throw new Error('Expected path update');
    expect(history[1].toPath.anchors).toHaveLength(3);
  });
});
