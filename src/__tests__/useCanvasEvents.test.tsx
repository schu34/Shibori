import { fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import {
  DrawingCallbacks,
  getPointerCanvasCoordinates,
  isSupportedPointerStart,
  useCanvasEvents,
} from "../hooks/useCanvasEvents";
import { CanvasRefs } from "../hooks/useCanvasRefs";

function callbacks(): jest.Mocked<DrawingCallbacks> {
  return {
    startDrawing: jest.fn(),
    continueDrawing: jest.fn(),
    endDrawing: jest.fn(),
    cancelDrawing: jest.fn(),
    nudgeSelection: jest.fn(),
    deleteSelection: jest.fn(),
    clearSelection: jest.fn(),
  };
}

function Harness({ operations }: { operations: DrawingCallbacks }) {
  const foldedCanvasRef = useRef<HTMLCanvasElement>(null);
  const refs = {
    foldedCanvasRef,
    unfoldedCanvasRef: { current: null },
    foldedCtxRef: { current: null },
    unfoldedCtxRef: { current: null },
    getFoldedCanvasDimensions: () => null,
    assertCanvasRef: (ref: React.RefObject<HTMLCanvasElement | null>) => {
      if (!ref.current) throw new Error("missing canvas");
      return ref.current;
    },
  } satisfies CanvasRefs;
  const handlers = useCanvasEvents(refs, operations);
  return <canvas ref={foldedCanvasRef} width={200} height={100} tabIndex={0} {...{
    onPointerDown: handlers.handlePointerDown,
    onPointerMove: handlers.handlePointerMove,
    onPointerUp: handlers.handlePointerUp,
    onPointerCancel: handlers.handlePointerCancel,
    onLostPointerCapture: handlers.handleLostPointerCapture,
    onKeyDown: handlers.handleKeyDown,
  }} />;
}

function prepareCanvas(canvas: HTMLCanvasElement) {
  const captured = new Set<number>();
  canvas.getBoundingClientRect = jest.fn(() => ({
    left: 10, top: 20, width: 100, height: 50, right: 110, bottom: 70,
    x: 10, y: 20, toJSON: () => undefined,
  }));
  canvas.setPointerCapture = jest.fn((id: number) => captured.add(id));
  canvas.hasPointerCapture = jest.fn((id: number) => captured.has(id));
  canvas.releasePointerCapture = jest.fn((id: number) => captured.delete(id));
}

const primary = { pointerId: 7, pointerType: "mouse", isPrimary: true, button: 0 };

function pointerEvent(type: string, init: Record<string, unknown>) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  for (const [key, value] of Object.entries(init)) {
    Object.defineProperty(event, key, { configurable: true, value });
  }
  return event;
}

describe("pointer canvas input", () => {
  test("converts client coordinates into backing-store coordinates", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 100;
    prepareCanvas(canvas);
    expect(getPointerCanvasCoordinates(60, 45, canvas)).toEqual({ x: 100, y: 50 });
  });

  test("accepts only primary pointers and the primary mouse button", () => {
    expect(isSupportedPointerStart({ pointerType: "mouse", button: 0, isPrimary: true })).toBe(true);
    expect(isSupportedPointerStart({ pointerType: "mouse", button: 2, isPrimary: true })).toBe(false);
    expect(isSupportedPointerStart({ pointerType: "touch", button: 0, isPrimary: false })).toBe(false);
  });

  test("captures one pointer, ignores secondary input, and releases on commit", () => {
    const operations = callbacks();
    const { container } = render(<Harness operations={operations} />);
    const canvas = container.querySelector("canvas")!;
    prepareCanvas(canvas);

    fireEvent(canvas, pointerEvent("pointerdown", { ...primary, clientX: 60, clientY: 45 }));
    fireEvent(canvas, pointerEvent("pointerdown", { ...primary, pointerId: 8, clientX: 70, clientY: 50 }));
    fireEvent(canvas, pointerEvent("pointermove", { ...primary, pointerId: 8, clientX: 70, clientY: 50 }));
    fireEvent(canvas, pointerEvent("pointermove", { ...primary, clientX: 70, clientY: 50 }));
    fireEvent(canvas, pointerEvent("pointerup", { ...primary, clientX: 80, clientY: 55 }));
    fireEvent(canvas, pointerEvent("lostpointercapture", primary));

    expect(document.activeElement).toBe(canvas);
    expect(canvas.setPointerCapture).toHaveBeenCalledWith(7);
    expect(operations.startDrawing).toHaveBeenCalledTimes(1);
    expect(operations.startDrawing).toHaveBeenCalledWith(100, 50);
    expect(operations.continueDrawing).toHaveBeenCalledTimes(1);
    expect(operations.endDrawing).toHaveBeenCalledWith({ x: 140, y: 70 });
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(7);
    expect(operations.cancelDrawing).not.toHaveBeenCalled();
  });

  test("pointer cancel releases capture and cancels without committing", () => {
    const operations = callbacks();
    const { container } = render(<Harness operations={operations} />);
    const canvas = container.querySelector("canvas")!;
    prepareCanvas(canvas);

    fireEvent(canvas, pointerEvent("pointerdown", { ...primary, clientX: 60, clientY: 45 }));
    fireEvent(canvas, pointerEvent("pointercancel", primary));

    expect(operations.cancelDrawing).toHaveBeenCalledTimes(1);
    expect(operations.endDrawing).not.toHaveBeenCalled();
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(7);
  });

  test("keyboard selection actions remain available", () => {
    const operations = callbacks();
    const { container } = render(<Harness operations={operations} />);
    const canvas = container.querySelector("canvas")!;
    fireEvent.keyDown(canvas, { key: "ArrowRight", shiftKey: true });
    fireEvent.keyDown(canvas, { key: "Delete" });
    fireEvent.keyDown(canvas, { key: "Escape" });
    expect(operations.nudgeSelection).toHaveBeenCalledWith({ x: 10, y: 0 });
    expect(operations.deleteSelection).toHaveBeenCalledTimes(1);
    expect(operations.clearSelection).toHaveBeenCalledTimes(1);
  });
});
