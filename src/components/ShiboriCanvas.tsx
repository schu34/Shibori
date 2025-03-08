import { useReducer } from 'react';
import { initialState, reducer } from '../store/shiboriCanvasState';
import { FoldControls } from './shibori/FoldControls';
import { DimensionControls } from './shibori/DimensionControls';
import { CanvasDisplay } from './shibori/CanvasDisplay';
import { ToolControls } from './shibori/ToolControls';
import './ShiboriCanvas.css';

const ShiboriCanvas = () => {
    // Use reducer for state management
    const [state, dispatch] = useReducer(reducer, initialState);

    return (
        <div className="shibori-app">
            <h1>Folded Paper Drawing</h1>
            <p className="description">
                Draw on the right canvas and see the mirrored result on the left canvas.
                Use the fold buttons to create different symmetry patterns.
            </p>

            {/* Component for fold buttons */}
            <FoldControls state={state} dispatch={dispatch} />

            {/* Component for dimension controls */}
            <DimensionControls state={state} dispatch={dispatch} />

            {/* Component for canvas display */}
            <CanvasDisplay state={state} dispatch={dispatch} />

            {/* Component for drawing tool controls */}
            <ToolControls state={state} dispatch={dispatch} />
        </div>
    );
};

export default ShiboriCanvas; 