import React from 'react';
import { State, Action } from '../../store/shiboriCanvasState';

interface DimensionControlsProps {
    state: State;
    dispatch: React.Dispatch<Action>;
}

export const DimensionControls: React.FC<DimensionControlsProps> = ({ state, dispatch }) => {
    // Handle canvas dimension changes
    const handleCanvasDimensionsChange = (width: number, height: number) => {
        dispatch({ type: 'SET_CANVAS_DIMENSIONS', payload: { width, height } });
    };

    return (
        <div className="dimension-controls">
            <label htmlFor="canvasWidth">Canvas Width:</label>
            <input
                type="number"
                id="canvasWidth"
                className="dimension-input"
                min="100"
                max="1000"
                value={state.canvasDimensions.width}
                onChange={(e) => dispatch({
                    type: 'UPDATE_CANVAS_WIDTH',
                    payload: parseInt(e.target.value) || 100
                })}
            />
            <label htmlFor="canvasHeight">Height:</label>
            <input
                type="number"
                id="canvasHeight"
                className="dimension-input"
                min="100"
                max="1000"
                value={state.canvasDimensions.height}
                onChange={(e) => dispatch({
                    type: 'UPDATE_CANVAS_HEIGHT',
                    payload: parseInt(e.target.value) || 100
                })}
            />
            <button onClick={() => handleCanvasDimensionsChange(state.canvasDimensions.width, state.canvasDimensions.height)}>
                Apply
            </button>
        </div>
    );
}; 