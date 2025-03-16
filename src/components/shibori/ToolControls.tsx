import React, { useCallback } from 'react';
import { State, Action, ActionType } from '../../store/shiboriCanvasState';
import { DrawingTool } from '../../types';

interface ToolControlsProps {
    state: State;
    dispatch: React.Dispatch<Action>;
}

export const ToolControls: React.FC<ToolControlsProps> = ({ state, dispatch }) => {
    // Handle tool change
    const handleToolChange = useCallback((tool: DrawingTool) => {
        dispatch({ type: ActionType.SET_CURRENT_TOOL, payload: tool });
    }, [dispatch]);

    // Handle circle radius change
    const handleCircleRadiusChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        dispatch({
            type: ActionType.SET_CIRCLE_RADIUS,
            payload: parseInt(e.target.value)
        });
    }, [dispatch]);

    // Handle line thickness change
    const handleLineThicknessChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        dispatch({
            type: ActionType.SET_LINE_THICKNESS,
            payload: parseInt(e.target.value)
        });
    }, [dispatch]);

    return (
        <div className="button-container">
            <div className="tool-controls-group">
                <h3>Drawing Tool:</h3>
                <div className="radio-group">
                    <label>
                        <input
                            type="radio"
                            name="drawingTool"
                            value={DrawingTool.Circle}
                            checked={state.currentTool === DrawingTool.Circle}
                            onChange={() => handleToolChange(DrawingTool.Circle)}
                        />
                        Circle Brush
                    </label>
                    <label>
                        <input
                            type="radio"
                            name="drawingTool"
                            value={DrawingTool.Line}
                            checked={state.currentTool === DrawingTool.Line}
                            onChange={() => handleToolChange(DrawingTool.Line)}
                        />
                        Line Tool
                    </label>
                </div>
            </div>

            {state.currentTool === DrawingTool.Circle ? (
                <div className="tool-controls-group">
                    <h3>
                        <label htmlFor="sizeSlider">Circle Size:</label>
                    </h3>
                    <div className="slider-container">
                        <input
                            type="range"
                            id="sizeSlider"
                            min="5"
                            max="50"
                            value={state.circleRadius}
                            onChange={handleCircleRadiusChange}
                        />
                        <span>{state.circleRadius}</span>px
                    </div>
                </div>
            ) : (
                <div className="tool-controls-group">
                    <h3>
                        <label htmlFor="lineThicknessSlider">Line Thickness:</label>
                    </h3>
                    <div className="slider-container">
                        <input
                            type="range"
                            id="lineThicknessSlider"
                            min="1"
                            max="20"
                            value={state.lineThickness}
                            onChange={handleLineThicknessChange}
                        />
                        <span>{state.lineThickness}</span>px
                    </div>
                </div>
            )}
        </div>
    );
}; 