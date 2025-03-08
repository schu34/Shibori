import React from 'react';
import { State, Action } from '../../store/shiboriCanvasState';
import { DrawingTool } from '../../types';

interface ToolControlsProps {
    state: State;
    dispatch: React.Dispatch<Action>;
}

export const ToolControls: React.FC<ToolControlsProps> = ({ state, dispatch }) => {
    return (
        <div className="controls">
            <div className="tool-selector">
                <label>Drawing Tool:</label>
                <div className="radio-group">
                    <label>
                        <input
                            type="radio"
                            name="drawingTool"
                            value={DrawingTool.Circle}
                            checked={state.currentTool === DrawingTool.Circle}
                            onChange={() => dispatch({ type: 'SET_CURRENT_TOOL', payload: DrawingTool.Circle })}
                        />
                        Circle Brush
                    </label>
                    <label>
                        <input
                            type="radio"
                            name="drawingTool"
                            value={DrawingTool.Line}
                            checked={state.currentTool === DrawingTool.Line}
                            onChange={() => dispatch({ type: 'SET_CURRENT_TOOL', payload: DrawingTool.Line })}
                        />
                        Line Tool
                    </label>
                </div>
            </div>

            {state.currentTool === DrawingTool.Circle ? (
                <div className="slider-container" id="circleControls">
                    <label htmlFor="sizeSlider">Circle Size:</label>
                    <input
                        type="range"
                        id="sizeSlider"
                        min="5"
                        max="50"
                        value={state.circleRadius}
                        onChange={(e) => dispatch({
                            type: 'SET_CIRCLE_RADIUS',
                            payload: parseInt(e.target.value)
                        })}
                    />
                    <span>{state.circleRadius}</span>px
                </div>
            ) : (
                <div className="slider-container" id="lineControls">
                    <label htmlFor="lineThicknessSlider">Line Thickness:</label>
                    <input
                        type="range"
                        id="lineThicknessSlider"
                        min="1"
                        max="20"
                        value={state.lineThickness}
                        onChange={(e) => dispatch({
                            type: 'SET_LINE_THICKNESS',
                            payload: parseInt(e.target.value)
                        })}
                    />
                    <span>{state.lineThickness}</span>px
                </div>
            )}
        </div>
    );
}; 