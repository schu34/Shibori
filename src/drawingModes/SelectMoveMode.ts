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

  continue(): boolean {
    return false;
  }

  end(): UndoableHistoryItem | null {
    return null;
  }

  cancel(context: DrawingModeContext): void {
    context.dispatch({ type: ActionType.SET_IS_DRAWING, payload: false });
  }
}
