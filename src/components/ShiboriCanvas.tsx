import { FoldControls } from './shibori/FoldControls';
import { DimensionControls } from './shibori/DimensionControls';
import { CanvasDisplay } from './shibori/CanvasDisplay';
import { ToolControls } from './shibori/ToolControls';
import './ShiboriCanvas.css';

const ShiboriCanvas = () => {
    return (
        <div className="shibori-app">
            <h1>Folded Paper Drawing</h1>
            <p className="description">
                Draw on the right canvas and see the mirrored result on the left canvas.
                Use the fold buttons to create different symmetry patterns.
            </p>

            {/* Controls container for fold and tool controls */}
            <div className="controls-container">
                {/* Component for fold buttons */}
                <div className="controls-section">
                    <FoldControls />
                </div>

                {/* Component for drawing tool controls */}
                <div className="controls-section">
                    <ToolControls />
                </div>
            </div>

            {/* Component for dimension controls */}
            <DimensionControls />

            {/* Component for canvas display */}
            <CanvasDisplay />
        </div>
    );
};

export default ShiboriCanvas; 