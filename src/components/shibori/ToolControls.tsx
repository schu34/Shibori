import React from 'react';
import { State, Action } from '../../store/shiboriCanvasState';
import { ToolSelector } from './ToolSelector';
import { SizeControl } from './SizeControl';
import { DrawingTool } from '../../types';

interface ToolControlsProps {
    state: State;
    dispatch: React.Dispatch<Action>;
}

export const ToolControls: React.FC<ToolControlsProps> = ({ state, dispatch }) => {
    return (
        <div className="button-container">
            <ToolSelector
                currentTool={state.currentTool}
                dispatch={dispatch}
            />
            <SizeControl
                tool={state.currentTool}
                value={state.currentTool === DrawingTool.Circle ? state.circleRadius : state.lineThickness}
                dispatch={dispatch}
            />
        </div>
    );
}; 