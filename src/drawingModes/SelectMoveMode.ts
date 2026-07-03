import {
  DrawingMode,
  DrawingModeContext,
  Point,
  UndoableHistoryItem,
} from "../types/DrawingMode";
import { ActionType } from "../store/shiboriCanvasState";

export class SelectMoveMode implements DrawingMode {
  start(_point: Point, context: DrawingModeContext): void {
    context.dispatch({ type: ActionType.SET_IS_DRAWING, payload: false });
  }

  continue(_point: Point, _context: DrawingModeContext): boolean {
    return false;
  }

  end(_point: Point | null, _context: DrawingModeContext): UndoableHistoryItem | null {
    return null;
  }

  cancel(context: DrawingModeContext): void {
    context.dispatch({ type: ActionType.SET_IS_DRAWING, payload: false });
  }
}
