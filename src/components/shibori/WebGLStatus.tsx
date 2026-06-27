/**
 * WebGL Status Component
 * Displays WebGL availability and performance information
 */

import React from 'react';
import { WebGLCanvasService } from '../../services/WebGLCanvasService';
import './WebGLStatus.css';

export interface WebGLStatusProps {
  /** Whether to show detailed information */
  showDetails?: boolean;
  /** Compact display mode */
  compact?: boolean;
}

export const WebGLStatus: React.FC<WebGLStatusProps> = ({ 
  showDetails = false, 
  compact = false 
}) => {
  const webglAvailable = WebGLCanvasService.isWebGLAvailable();
  const webglInfo = WebGLCanvasService.getWebGLInfo();
  const initializationFailed = WebGLCanvasService.hasWebGLInitializationFailed();
  const isInitialized = WebGLCanvasService.isWebGLInitialized();

  let statusText: string;
  let statusClass: string;
  
  if (webglAvailable && isInitialized) {
    statusText = 'WebGL Active';
    statusClass = 'webgl-enabled';
  } else if (webglAvailable && initializationFailed) {
    statusText = 'WebGL Failed';
    statusClass = 'webgl-warning';
  } else if (webglAvailable) {
    statusText = 'WebGL Available';
    statusClass = 'webgl-enabled';
  } else {
    statusText = 'Canvas 2D Only';
    statusClass = 'webgl-disabled';
  }

  if (compact) {
    return (
      <div className={`webgl-status compact ${statusClass}`}>
        <span className="status-indicator" title={webglInfo || 'WebGL not available'}>
          {webglAvailable ? (initializationFailed ? '⚠️' : '🚀') : '🎨'} {statusText}
        </span>
      </div>
    );
  }

  return (
    <div className={`webgl-status ${statusClass}`}>
      <div className="status-header">
        <span className="status-indicator">
          {webglAvailable ? (initializationFailed ? '⚠️' : '🚀') : '🎨'}
        </span>
        <span className="status-text">{statusText}</span>
      </div>
      
      {showDetails && (
        <div className="status-details">
          {webglAvailable ? (
            <>
              <div className="detail-item">
                <span className="detail-label">Renderer:</span>
                <span className="detail-value">{webglInfo || 'Unknown'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Acceleration:</span>
                <span className="detail-value">GPU Accelerated</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Status:</span>
                <span className="detail-value">
                  {isInitialized ? 'Active' : (initializationFailed ? 'Failed to Initialize' : 'Available')}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="detail-item">
                <span className="detail-label">Renderer:</span>
                <span className="detail-value">Canvas 2D</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Acceleration:</span>
                <span className="detail-value">CPU Only</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Status:</span>
                <span className="detail-value">Not Available</span>
              </div>
            </>
          )}
        </div>
      )}
      
      {!webglAvailable && (
        <div className="status-message">
          <small>For better performance, use a WebGL-compatible browser</small>
        </div>
      )}
    </div>
  );
};
