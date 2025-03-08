import React from 'react';
import { State, Action } from '../../store/shiboriCanvasState';

interface DimensionControlsProps {
    state: State;
    dispatch: React.Dispatch<Action>;
}

export const DimensionControls: React.FC<DimensionControlsProps> = ({ state, dispatch }) => {
    // Handle input changes
    const handleWidthChange = (width: number) => {
        const validWidth = width || 100;
        dispatch({
            type: 'UPDATE_CANVAS_WIDTH',
            payload: validWidth
        });
        dispatch({
            type: 'SET_CANVAS_DIMENSIONS',
            payload: {
                width: validWidth,
                height: state.canvasDimensions.height
            }
        });
    };

    const handleHeightChange = (height: number) => {
        const validHeight = height || 100;
        dispatch({
            type: 'UPDATE_CANVAS_HEIGHT',
            payload: validHeight
        });
        dispatch({
            type: 'SET_CANVAS_DIMENSIONS',
            payload: {
                width: state.canvasDimensions.width,
                height: validHeight
            }
        });
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
                onChange={(e) => handleWidthChange(parseInt(e.target.value))}
            />
            <label htmlFor="canvasHeight">Height:</label>
            <input
                type="number"
                id="canvasHeight"
                className="dimension-input"
                min="100"
                max="1000"
                value={state.canvasDimensions.height}
                onChange={(e) => handleHeightChange(parseInt(e.target.value))}
            />
        </div>
    );
}; 