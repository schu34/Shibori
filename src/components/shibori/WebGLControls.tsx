/**
 * WebGL Controls Component
 * Provides controls for WebGL settings and rendering mode selection
 */

import React, { useState } from 'react';
import { DrawingModeFactory, RenderingMode } from '../../drawingModes/DrawingModeFactory';
import { WebGLCanvasService } from '../../services/WebGLCanvasService';
import { WebGLStatus } from './WebGLStatus';
import { PerformanceMonitor } from './PerformanceMonitor';
import { reportRequestedRenderingMode } from '../../utils/renderingBackend';
import './WebGLControls.css';

export const WebGLControls: React.FC = () => {
  const [showDetails, setShowDetails] = useState(false);
  const [showPerformance, setShowPerformance] = useState(false);
  const [currentMode, setCurrentMode] = useState<RenderingMode>(() => {
    return DrawingModeFactory.getConfig().renderingMode || 'auto';
  });

  const handleModeChange = (mode: RenderingMode) => {
    setCurrentMode(mode);
    DrawingModeFactory.configure({ renderingMode: mode });
    reportRequestedRenderingMode(mode);
    
    // Force a WebGL context recreation if needed
    if (mode === 'webgl' || mode === 'canvas2d') {
      WebGLCanvasService.forceWebGLMode(mode === 'webgl');
    }
  };

  const toggleDetails = () => {
    setShowDetails(!showDetails);
  };

  const togglePerformance = () => {
    setShowPerformance(!showPerformance);
  };

  const isWebGLAvailable = WebGLCanvasService.isWebGLAvailable();
  const webglInfo = WebGLCanvasService.getWebGLInfo();

  return (
    <div className="webgl-controls">
      <div className="control-header">
        <h3>Rendering</h3>
        <div className="header-buttons">
          <button 
            className="details-toggle"
            onClick={togglePerformance}
            title={showPerformance ? "Hide performance" : "Show performance"}
          >
            Perf
          </button>
          <button 
            className="details-toggle"
            onClick={toggleDetails}
            title={showDetails ? "Hide details" : "Show details"}
          >
            {showDetails ? "Less" : "Info"}
          </button>
        </div>
      </div>

      <WebGLStatus compact={true} />

      <div className="rendering-mode-selector">
        <div className="mode-buttons">
          <button
            className={`mode-button ${currentMode === 'auto' ? 'active' : ''}`}
            onClick={() => handleModeChange('auto')}
            title="Automatically choose the best rendering mode"
          >
            Auto
          </button>
          <button
            className={`mode-button ${currentMode === 'webgl' ? 'active' : ''}`}
            onClick={() => handleModeChange('webgl')}
            disabled={!isWebGLAvailable}
            title={isWebGLAvailable ? "Force WebGL rendering" : "WebGL not available"}
          >
            WebGL
          </button>
          <button
            className={`mode-button ${currentMode === 'canvas2d' ? 'active' : ''}`}
            onClick={() => handleModeChange('canvas2d')}
            title="Force Canvas 2D rendering"
          >
            Canvas 2D
          </button>
        </div>
      </div>

      {showDetails && (
        <div className="webgl-details">
          <WebGLStatus showDetails={true} />
          
          {isWebGLAvailable && (
            <div className="performance-info">
              <h4>Performance Benefits</h4>
              <ul>
                <li>GPU-accelerated drawing</li>
                <li>Real-time mirroring</li>
                <li>Better performance with complex patterns</li>
                <li>Smooth stroke rendering</li>
              </ul>
            </div>
          )}

          {!isWebGLAvailable && (
            <div className="compatibility-info">
              <h4>WebGL Requirements</h4>
              <p>WebGL is not available. This could be due to:</p>
              <ul>
                <li>Browser doesn't support WebGL</li>
                <li>Graphics drivers are outdated</li>
                <li>Hardware acceleration is disabled</li>
                <li>WebGL is blacklisted for your GPU</li>
              </ul>
              <p>
                <small>
                  The app will continue to work using Canvas 2D rendering.
                </small>
              </p>
            </div>
          )}

          <div className="debug-info">
            <h4>Debug Information</h4>
            <div className="debug-item">
              <span>Current Factory Config:</span>
              <code>{JSON.stringify(DrawingModeFactory.getConfig(), null, 2)}</code>
            </div>
            {webglInfo && (
              <div className="debug-item">
                <span>WebGL Info:</span>
                <code>{webglInfo}</code>
              </div>
            )}
          </div>
        </div>
      )}

      {showPerformance && (
        <PerformanceMonitor />
      )}
    </div>
  );
};
