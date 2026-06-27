import { FoldControls } from './shibori/FoldControls';
import { DimensionControls } from './shibori/DimensionControls';
import { CanvasDisplay } from './shibori/CanvasDisplay';
import { ToolControls } from './shibori/ToolControls';
import { ShareControls } from './shibori/ShareControls';
import { useState, useCallback } from 'react';
import './ShiboriCanvas.css';

const ShiboriCanvas = () => {
    const [isControlsExpanded, setIsControlsExpanded] = useState(true);

    const toggleControls = useCallback(() => {
        setIsControlsExpanded(prev => !prev);
    }, []);

    return (
        <div className="shibori-app">
            <header className="app-header">
                <h1>Shibori Folding</h1>
                <p className="description">
                    Draw on the folded canvas and watch the unfolded shibori pattern update in real time.
                </p>
            </header>

            {/* Controls container for fold and tool controls */}
            <div className="controls-container">
                <button
                    className="controls-toggle"
                    onClick={toggleControls}
                    title={isControlsExpanded ? "Collapse controls" : "Expand controls"}
                >
                    {isControlsExpanded ? "▼" : "▲"} Controls
                </button>

                {isControlsExpanded && (
                    <>
                        {/* Component for fold buttons */}
                        <div className="controls-section">
                            <FoldControls />
                        </div>

                        {/* Component for drawing tool controls */}
                        <div className="controls-section">
                            <ToolControls />
                        </div>

                        {/* Component for sharing controls */}
                        <div className="controls-section">
                            <ShareControls />
                        </div>
                    </>
                )}
            </div>

            {/* Component for dimension controls */}
            <DimensionControls />

            {/* Component for canvas display */}
            <CanvasDisplay />
        </div>
    );
};

export default ShiboriCanvas; 
