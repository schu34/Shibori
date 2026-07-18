import React, { useCallback } from 'react';
import { DrawingTool } from '../../types';
import { ActionType } from '../../store/shiboriCanvasState';
import { useAppDispatch } from '../../hooks/useReduxHooks';
import { WorkspaceIcon, WorkspaceIconName } from './WorkspaceIcon';

interface ToolSelectorProps {
    currentTool: DrawingTool;
}

export const ToolSelector: React.FC<ToolSelectorProps> = ({ currentTool }) => {
    const dispatch = useAppDispatch();

    const handleToolChange = useCallback((tool: DrawingTool) => {
        dispatch({ type: ActionType.SET_CURRENT_TOOL, payload: tool });
    }, [dispatch]);

    const tools: Array<{ tool: DrawingTool; label: string; icon: WorkspaceIconName }> = [
        { tool: DrawingTool.SelectMove, label: 'Select/Move', icon: 'select' },
        { tool: DrawingTool.DirectSelect, label: 'Direct Selection', icon: 'directSelect' },
        { tool: DrawingTool.Line, label: 'Line Tool', icon: 'line' },
        { tool: DrawingTool.Paintbrush, label: 'Paintbrush', icon: 'paintbrush' },
        { tool: DrawingTool.Rectangle, label: 'Rectangle', icon: 'rectangle' },
        { tool: DrawingTool.Square, label: 'Square', icon: 'square' },
        { tool: DrawingTool.Circle, label: 'Circle', icon: 'circle' },
        { tool: DrawingTool.Bezier, label: 'Bézier Curve', icon: 'bezier' },
    ];

    return (
        <fieldset className="tool-selector" aria-label="Drawing tools">
            <legend className="visually-hidden">Drawing Tool:</legend>
            <div className="tool-rail-items">
                {tools.map(({ tool, label, icon }) => (
                    <label className="tool-button" data-tooltip={label} key={tool}>
                        <input
                            type="radio"
                            name="drawingTool"
                            value={tool}
                            checked={currentTool === tool}
                            onChange={() => handleToolChange(tool)}
                        />
                        <span className="tool-button-face">
                            <WorkspaceIcon name={icon} />
                            <span className="visually-hidden">{label}</span>
                        </span>
                    </label>
                ))}
            </div>
        </fieldset>
    );
};
