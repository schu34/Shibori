import React, { useCallback } from 'react';
import { DrawingTool } from '../../types';
import { ActionType } from '../../store/shiboriCanvasState';
import { useAppDispatch } from '../../hooks/useReduxHooks';

interface ToolSelectorProps {
    currentTool: DrawingTool;
}

export const ToolSelector: React.FC<ToolSelectorProps> = ({ currentTool }) => {
    const dispatch = useAppDispatch();

    const handleToolChange = useCallback((tool: DrawingTool) => {
        dispatch({ type: ActionType.SET_CURRENT_TOOL, payload: tool });
    }, [dispatch]);

    return (
        <div className="tool-controls-group">
            <h3>Drawing Tool:</h3>
            <div className="radio-group">
                <label>
                    <input
                        type="radio"
                        name="drawingTool"
                        value={DrawingTool.SelectMove}
                        checked={currentTool === DrawingTool.SelectMove}
                        onChange={() => handleToolChange(DrawingTool.SelectMove)}
                    />
                    Select/Move
                </label>
                <label>
                    <input
                        type="radio"
                        name="drawingTool"
                        value={DrawingTool.DirectSelect}
                        checked={currentTool === DrawingTool.DirectSelect}
                        onChange={() => handleToolChange(DrawingTool.DirectSelect)}
                    />
                    Direct Selection
                </label>
                <label>
                    <input
                        type="radio"
                        name="drawingTool"
                        value={DrawingTool.Line}
                        checked={currentTool === DrawingTool.Line}
                        onChange={() => handleToolChange(DrawingTool.Line)}
                    />
                    Line Tool
                </label>
                <label>
                    <input
                        type="radio"
                        name="drawingTool"
                        value={DrawingTool.Paintbrush}
                        checked={currentTool === DrawingTool.Paintbrush}
                        onChange={() => handleToolChange(DrawingTool.Paintbrush)}
                    />
                    Paintbrush
                </label>
                <label>
                    <input
                        type="radio"
                        name="drawingTool"
                        value={DrawingTool.Rectangle}
                        checked={currentTool === DrawingTool.Rectangle}
                        onChange={() => handleToolChange(DrawingTool.Rectangle)}
                    />
                    Rectangle
                </label>
                <label>
                    <input
                        type="radio"
                        name="drawingTool"
                        value={DrawingTool.Square}
                        checked={currentTool === DrawingTool.Square}
                        onChange={() => handleToolChange(DrawingTool.Square)}
                    />
                    Square
                </label>
                <label>
                    <input
                        type="radio"
                        name="drawingTool"
                        value={DrawingTool.Circle}
                        checked={currentTool === DrawingTool.Circle}
                        onChange={() => handleToolChange(DrawingTool.Circle)}
                    />
                    Circle
                </label>
                <label>
                    <input
                        type="radio"
                        name="drawingTool"
                        value={DrawingTool.Bezier}
                        checked={currentTool === DrawingTool.Bezier}
                        onChange={() => handleToolChange(DrawingTool.Bezier)}
                    />
                    Bézier Curve
                </label>
            </div>
        </div>
    );
}; 
