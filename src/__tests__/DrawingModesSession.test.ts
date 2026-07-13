import { LineMode } from "../drawingModes/LineMode";
import { PaintbrushMode } from "../drawingModes/PaintbrushMode";
import { RectangleMode } from "../drawingModes/RectangleMode";
import { initialState } from "../store/shiboriCanvasState";
import { DrawingTool, ShapeFillMode } from "../types";
import { DrawingModeContext } from "../types/DrawingMode";

function modeContext() {
  const snapshot = {} as ImageData;
  const foldedCtx = {
    getImageData: jest.fn(() => snapshot),
    putImageData: jest.fn(),
    save: jest.fn(), restore: jest.fn(), beginPath: jest.fn(), closePath: jest.fn(),
    moveTo: jest.fn(), lineTo: jest.fn(), fill: jest.fn(), stroke: jest.fn(),
    rect: jest.fn(), arc: jest.fn(), strokeRect: jest.fn(), fillRect: jest.fn(),
    fillStyle: "", strokeStyle: "", lineWidth: 0, globalAlpha: 1,
    lineCap: "butt", lineJoin: "miter",
  } as unknown as CanvasRenderingContext2D;
  const context: DrawingModeContext = {
    getState: () => ({
      ...initialState,
      lineThickness: 12,
      shapeFillMode: ShapeFillMode.Outline,
      config: { ...initialState.config, lineColor: "magenta" },
    }),
    foldedCtx,
    getFoldedCanvasDimensions: () => ({ width: 200, height: 100 }),
  };
  return { context, foldedCtx, snapshot };
}

describe("local drawing mode sessions", () => {
  test("paintbrush owns points/style and cancel restores and resets", () => {
    const mode = new PaintbrushMode();
    const first = modeContext();
    mode.start({ x: 1, y: 2 }, first.context);
    expect(mode.continue({ x: 3, y: 4 }, first.context)).toBe(true);
    expect(mode.end({ x: 3, y: 4 }, first.context)).toEqual({
      action: DrawingTool.Paintbrush,
      points: [{ x: 1, y: 2 }, { x: 3, y: 4 }],
      style: { lineThickness: 12, color: "magenta" },
    });

    const second = modeContext();
    mode.start({ x: 8, y: 9 }, second.context);
    mode.cancel(second.context);
    expect(second.foldedCtx.putImageData).toHaveBeenCalledWith(second.snapshot, 0, 0);
    expect(mode.continue({ x: 10, y: 11 }, second.context)).toBe(false);
    expect(mode.end(null, second.context)).toBeNull();
  });

  test("line captures start locally and cancel resets", () => {
    const mode = new LineMode();
    const first = modeContext();
    mode.start({ x: 10, y: 20 }, first.context);
    mode.continue({ x: 30, y: 40 }, first.context);
    expect(mode.end({ x: 50, y: 60 }, first.context)).toEqual({
      action: DrawingTool.Line,
      points: [{ x: 10, y: 20 }, { x: 50, y: 60 }],
      style: { lineThickness: 12, color: "magenta" },
    });

    const second = modeContext();
    mode.start({ x: 1, y: 1 }, second.context);
    mode.cancel(second.context);
    expect(mode.end(null, second.context)).toBeNull();
  });

  test("drag shape captures local endpoints, fill mode, and style", () => {
    const mode = new RectangleMode();
    const { context } = modeContext();
    mode.start({ x: 5, y: 6 }, context);
    mode.continue({ x: 25, y: 36 }, context);
    expect(mode.end({ x: 45, y: 56 }, context)).toEqual({
      action: DrawingTool.Rectangle,
      points: [{ x: 5, y: 6 }, { x: 45, y: 56 }],
      shapeFillMode: ShapeFillMode.Outline,
      style: {
        lineThickness: 12,
        color: "magenta",
        shapeFillMode: ShapeFillMode.Outline,
      },
    });
  });
});
