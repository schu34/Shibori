import React, { forwardRef } from 'react';
import { logger } from '../../utils/logger';

interface CanvasRendererProps {
    foldedCanvasRef: React.RefObject<HTMLCanvasElement>;
    unfoldedCanvasRef: React.RefObject<HTMLCanvasElement>;
    canvasDimensions: { width: number; height: number };
    folds: {
        vertical: number;
        horizontal: number;
        diagonal: { enabled: boolean; count: number; direction: any };
    };
    onMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
    onMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
    onMouseUp: (e: React.MouseEvent<HTMLCanvasElement>) => void;
    onMouseLeave: (e: React.MouseEvent<HTMLCanvasElement>) => void;
    onClear: () => void;
    onUndo: () => void;
    onDownload: () => void;
}

export const CanvasRenderer: React.FC<CanvasRendererProps> = ({
    foldedCanvasRef,
    unfoldedCanvasRef,
    canvasDimensions,
    folds,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    onClear,
    onUndo,
    onDownload
}) => {
    logger.canvas.operation('CanvasRenderer rendering', {
        canvasDimensions,
        folds: { vertical: folds.vertical, horizontal: folds.horizontal }
    });

    const foldedWidth = canvasDimensions.width / 2 ** folds.vertical;
    const foldedHeight = canvasDimensions.height / 2 ** folds.horizontal;

    return (
        <div className="canvas-container">
            <div className="canvas-wrapper">
                <h3>Folded Version</h3>
                <canvas
                    ref={foldedCanvasRef}
                    width={foldedWidth}
                    height={foldedHeight}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseLeave={onMouseLeave}
                />
            </div>
            <div className="canvas-wrapper">
                <div className="canvas-header">
                    <h3>Unfolded Version</h3>
                    <div className="canvas-actions">
                        <button
                            className="download-button"
                            onClick={onClear}
                            title="Clear canvas"
                        >
                            Clear
                        </button>
                        <button
                            className="download-button"
                            onClick={onUndo}
                            title="Undo"
                        >
                            Undo
                        </button>
                        <button
                            className="download-button"
                            onClick={onDownload}
                            title="Download as PNG image"
                        >
                            Download
                        </button>
                    </div>
                </div>
                <canvas 
                    ref={unfoldedCanvasRef}
                    width={canvasDimensions.width}
                    height={canvasDimensions.height}
                />
            </div>
        </div>
    );
};