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
                        value={DrawingTool.Circle}
                        checked={currentTool === DrawingTool.Circle}
                        onChange={() => handleToolChange(DrawingTool.Circle)}
                    />
                    Circle Brush
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
            </div>
        </div>
    );
}; 