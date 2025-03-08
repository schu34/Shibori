import { useEffect, useRef, useState } from 'react';
import { ImageUtils } from '../utils/imageUtils';
import { debounce } from '../utils/debounce';
import { AppConfig, DrawingTool, FoldState } from '../types';
import './ShiboriCanvas.css';

// Default configuration values
const DEFAULT_CONFIG: AppConfig = {
    unfoldedCanvasWidth: 400,
    unfoldedCanvasHeight: 400,
    maxFolds: 3,
    defaultCircleRadius: 20,
    circleColor: 'white',
    defaultLineThickness: 2,
    lineColor: 'white',
    debounceDelay: 15
};

const ShiboriCanvas = () => {
    // Canvas references
    const unfoldedCanvasRef = useRef<HTMLCanvasElement>(null);
    const foldedCanvasRef = useRef<HTMLCanvasElement>(null);

    // State for configuration and drawing
    const [config] = useState<AppConfig>(DEFAULT_CONFIG);
    const [circleRadius, setCircleRadius] = useState(DEFAULT_CONFIG.defaultCircleRadius);
    const [lineThickness, setLineThickness] = useState(DEFAULT_CONFIG.defaultLineThickness);
    const [currentTool, setCurrentTool] = useState<DrawingTool>(DrawingTool.Circle);
    const [isDrawing, setIsDrawing] = useState(false);
    const [lineStartPoint, setLineStartPoint] = useState<{ x: number; y: number } | null>(null);
    const [folds, setFolds] = useState<FoldState>({
        vertical: 2,
        horizontal: 2
    });
    const [canvasDimensions, setCanvasDimensions] = useState({
        width: DEFAULT_CONFIG.unfoldedCanvasWidth,
        height: DEFAULT_CONFIG.unfoldedCanvasHeight
    });

    // Function to clear both canvases
    const clearCanvases = () => {
        const unfoldedCanvas = unfoldedCanvasRef.current;
        const foldedCanvas = foldedCanvasRef.current;

        if (!unfoldedCanvas || !foldedCanvas) return;

        const unfoldedCtx = unfoldedCanvas.getContext('2d', { willReadFrequently: true });
        const foldedCtx = foldedCanvas.getContext('2d', { willReadFrequently: true });

        if (!unfoldedCtx || !foldedCtx) return;

        unfoldedCtx.clearRect(0, 0, unfoldedCanvas.width, unfoldedCanvas.height);
        foldedCtx.clearRect(0, 0, foldedCanvas.width, foldedCanvas.height);
    };

    // Function to update folded canvas dimensions
    const updateFoldedCanvasDimensions = () => {
        const unfoldedCanvas = unfoldedCanvasRef.current;
        const foldedCanvas = foldedCanvasRef.current;

        if (!unfoldedCanvas || !foldedCanvas) return;

        const foldedWidth = unfoldedCanvas.width / Math.pow(2, folds.vertical);
        const foldedHeight = unfoldedCanvas.height / Math.pow(2, folds.horizontal);

        foldedCanvas.width = foldedWidth;
        foldedCanvas.height = foldedHeight;
    };

    // Function to draw fold lines on the unfolded canvas
    const drawFoldLines = () => {
        const unfoldedCanvas = unfoldedCanvasRef.current;
        if (!unfoldedCanvas) return;

        const unfoldedCtx = unfoldedCanvas.getContext('2d', { willReadFrequently: true });
        if (!unfoldedCtx) return;

        // Draw vertical fold lines
        drawFoldLinesForAxis(true);

        // Draw horizontal fold lines
        drawFoldLinesForAxis(false);
    };

    // Function to draw fold lines for a specific axis
    const drawFoldLinesForAxis = (isVertical: boolean) => {
        const unfoldedCanvas = unfoldedCanvasRef.current;
        if (!unfoldedCanvas) return;

        const unfoldedCtx = unfoldedCanvas.getContext('2d', { willReadFrequently: true });
        if (!unfoldedCtx) return;

        const foldCount = isVertical ? folds.vertical : folds.horizontal;
        const canvasSize = isVertical ? unfoldedCanvas.width : unfoldedCanvas.height;

        unfoldedCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        unfoldedCtx.lineWidth = 1;

        for (let i = 1; i <= foldCount; i++) {
            const position = (canvasSize / Math.pow(2, i));

            for (let j = 1; j < Math.pow(2, i); j += 2) {
                unfoldedCtx.beginPath();

                if (isVertical) {
                    const x = position * j;
                    unfoldedCtx.moveTo(x, 0);
                    unfoldedCtx.lineTo(x, unfoldedCanvas.height);
                } else {
                    const y = position * j;
                    unfoldedCtx.moveTo(0, y);
                    unfoldedCtx.lineTo(unfoldedCanvas.width, y);
                }

                unfoldedCtx.stroke();
            }
        }
    };

    // Function to draw a circle on the folded canvas
    const drawCircleOnFoldedCanvas = (x: number, y: number) => {
        const foldedCanvas = foldedCanvasRef.current;
        if (!foldedCanvas) return;

        const foldedCtx = foldedCanvas.getContext('2d', { willReadFrequently: true });
        if (!foldedCtx) return;

        foldedCtx.beginPath();
        foldedCtx.arc(x, y, circleRadius, 0, Math.PI * 2);
        foldedCtx.fillStyle = config.circleColor;
        foldedCtx.fill();

        debouncedUpdateUnfoldedCanvas();
    };

    // Function to draw a line on the folded canvas
    const drawLineOnFoldedCanvas = (startX: number, startY: number, endX: number, endY: number) => {
        const foldedCanvas = foldedCanvasRef.current;
        if (!foldedCanvas) return;

        const foldedCtx = foldedCanvas.getContext('2d', { willReadFrequently: true });
        if (!foldedCtx) return;

        foldedCtx.beginPath();
        foldedCtx.moveTo(startX, startY);
        foldedCtx.lineTo(endX, endY);
        foldedCtx.strokeStyle = config.lineColor;
        foldedCtx.lineWidth = lineThickness;
        foldedCtx.stroke();

        debouncedUpdateUnfoldedCanvas();
    };

    // Function to update the unfolded canvas by mirroring the folded canvas
    const updateUnfoldedCanvas = () => {
        const unfoldedCanvas = unfoldedCanvasRef.current;
        const foldedCanvas = foldedCanvasRef.current;

        if (!unfoldedCanvas || !foldedCanvas) return;

        const unfoldedCtx = unfoldedCanvas.getContext('2d', { willReadFrequently: true });
        const foldedCtx = foldedCanvas.getContext('2d', { willReadFrequently: true });

        if (!unfoldedCtx || !foldedCtx) return;

        unfoldedCtx.clearRect(0, 0, unfoldedCanvas.width, unfoldedCanvas.height);

        // Get the original image data from the folded canvas
        const originalImage = foldedCtx.getImageData(0, 0, foldedCanvas.width, foldedCanvas.height);

        // Create the other three pattern variations we'll need
        const horizontalFlipped = ImageUtils.flipHorizontal(originalImage);
        const verticalFlipped = ImageUtils.flipVertical(originalImage);
        const bothFlipped = ImageUtils.flipVertical(horizontalFlipped); // or flipHorizontal(verticalFlipped)

        // Calculate the total grid size based on folds
        const gridWidth = Math.pow(2, folds.vertical);
        const gridHeight = Math.pow(2, folds.horizontal);

        // Determine each cell's dimensions
        const cellWidth = originalImage.width;
        const cellHeight = originalImage.height;

        // For each cell in the grid, determine which of the 4 patterns to use
        for (let row = 0; row < gridHeight; row++) {
            for (let col = 0; col < gridWidth; col++) {
                // Determine which pattern to use based on row and column position
                let patternToUse: ImageData;

                const isRowEven = row % 2 === 0;
                const isColEven = col % 2 === 0;

                if (isRowEven && isColEven) {
                    patternToUse = originalImage;
                } else if (isRowEven && !isColEven) {
                    patternToUse = horizontalFlipped;
                } else if (!isRowEven && isColEven) {
                    patternToUse = verticalFlipped;
                } else {
                    patternToUse = bothFlipped;
                }

                // Calculate the position to place this pattern
                const x = col * cellWidth;
                const y = row * cellHeight;

                // Draw the pattern at this position
                unfoldedCtx.putImageData(patternToUse, x, y);
            }
        }

        // Draw fold lines
        drawFoldLines();
    };

    // Create a debounced version of updateUnfoldedCanvas
    const debouncedUpdateUnfoldedCanvas = debounce(updateUnfoldedCanvas, config.debounceDelay);

    // Handle fold button clicks
    const handleFoldButtonClick = (isVertical: boolean) => {
        const foldCount = isVertical ? folds.vertical : folds.horizontal;

        if (foldCount < config.maxFolds) {
            setFolds(prevFolds => ({
                ...prevFolds,
                [isVertical ? 'vertical' : 'horizontal']: foldCount + 1
            }));
        }
    };

    // Handle reset button click
    const handleResetButtonClick = () => {
        setFolds({ vertical: 1, horizontal: 1 });
    };

    // Handle canvas dimension changes
    const handleCanvasDimensionsChange = (width: number, height: number) => {
        setCanvasDimensions({ width, height });
    };

    // Handle mouse events for the folded canvas
    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const foldedCanvas = foldedCanvasRef.current;
        if (!foldedCanvas) return;

        const rect = foldedCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (currentTool === DrawingTool.Circle) {
            setIsDrawing(true);
            drawCircleOnFoldedCanvas(x, y);
        } else if (currentTool === DrawingTool.Line) {
            if (lineStartPoint === null) {
                // First click - set start point
                setLineStartPoint({ x, y });

                // Draw a temporary dot to show the start point
                const foldedCtx = foldedCanvas.getContext('2d', { willReadFrequently: true });
                if (!foldedCtx) return;

                foldedCtx.beginPath();
                foldedCtx.arc(x, y, 3, 0, Math.PI * 2);
                foldedCtx.fillStyle = config.lineColor;
                foldedCtx.fill();
            } else {
                // Second click - draw the line
                drawLineOnFoldedCanvas(lineStartPoint.x, lineStartPoint.y, x, y);
                setLineStartPoint(null);
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (currentTool === DrawingTool.Circle && isDrawing) {
            const foldedCanvas = foldedCanvasRef.current;
            if (!foldedCanvas) return;

            const rect = foldedCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            drawCircleOnFoldedCanvas(x, y);
        }
    };

    const handleMouseUp = () => {
        if (currentTool === DrawingTool.Circle) {
            setIsDrawing(false);
        }
    };

    const handleMouseLeave = () => {
        if (currentTool === DrawingTool.Circle) {
            setIsDrawing(false);
        }
    };

    // Initialize canvases and event listeners
    useEffect(() => {
        const unfoldedCanvas = unfoldedCanvasRef.current;
        const foldedCanvas = foldedCanvasRef.current;

        if (!unfoldedCanvas || !foldedCanvas) return;

        // Set initial canvas dimensions
        unfoldedCanvas.width = canvasDimensions.width;
        unfoldedCanvas.height = canvasDimensions.height;

        // Update folded canvas dimensions
        updateFoldedCanvasDimensions();

        // Clear the canvases
        clearCanvases();

        // Draw the fold lines
        drawFoldLines();
    }, [canvasDimensions, folds]); // Re-run when canvas dimensions or folds change

    return (
        <div className="shibori-app">
            <h1>Folded Paper Drawing</h1>
            <p className="description">
                Draw on the right canvas and see the mirrored result on the left canvas.
                Use the fold buttons to create different symmetry patterns.
            </p>

            <div className="button-container">
                <button
                    onClick={() => handleFoldButtonClick(true)}
                    disabled={folds.vertical >= config.maxFolds}>
                    Fold Vertically
                </button>
                <button
                    onClick={() => handleFoldButtonClick(false)}
                    disabled={folds.horizontal >= config.maxFolds}>
                    Fold Horizontally
                </button>
                <button onClick={handleResetButtonClick}>
                    Reset Folds
                </button>
            </div>

            <div className="dimension-controls">
                <label htmlFor="canvasWidth">Canvas Width:</label>
                <input
                    type="number"
                    id="canvasWidth"
                    className="dimension-input"
                    min="100"
                    max="1000"
                    value={canvasDimensions.width}
                    onChange={(e) => setCanvasDimensions(prev => ({ ...prev, width: parseInt(e.target.value) || 100 }))}
                />
                <label htmlFor="canvasHeight">Height:</label>
                <input
                    type="number"
                    id="canvasHeight"
                    className="dimension-input"
                    min="100"
                    max="1000"
                    value={canvasDimensions.height}
                    onChange={(e) => setCanvasDimensions(prev => ({ ...prev, height: parseInt(e.target.value) || 100 }))}
                />
                <button onClick={() => handleCanvasDimensionsChange(canvasDimensions.width, canvasDimensions.height)}>
                    Apply
                </button>
            </div>

            <div className="canvas-container">
                <div className="canvas-wrapper">
                    <h3>Unfolded Version</h3>
                    <canvas ref={unfoldedCanvasRef} />
                </div>
                <div className="canvas-wrapper">
                    <h3>Folded Version</h3>
                    <canvas
                        ref={foldedCanvasRef}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseLeave}
                    />
                </div>
            </div>

            <div className="controls">
                <div className="tool-selector">
                    <label>Drawing Tool:</label>
                    <div className="radio-group">
                        <label>
                            <input
                                type="radio"
                                name="drawingTool"
                                value={DrawingTool.Circle}
                                checked={currentTool === DrawingTool.Circle}
                                onChange={() => setCurrentTool(DrawingTool.Circle)}
                            />
                            Circle Brush
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="drawingTool"
                                value={DrawingTool.Line}
                                checked={currentTool === DrawingTool.Line}
                                onChange={() => setCurrentTool(DrawingTool.Line)}
                            />
                            Line Tool
                        </label>
                    </div>
                </div>

                {currentTool === DrawingTool.Circle ? (
                    <div className="slider-container" id="circleControls">
                        <label htmlFor="sizeSlider">Circle Size:</label>
                        <input
                            type="range"
                            id="sizeSlider"
                            min="5"
                            max="50"
                            value={circleRadius}
                            onChange={(e) => setCircleRadius(parseInt(e.target.value))}
                        />
                        <span>{circleRadius}</span>px
                    </div>
                ) : (
                    <div className="slider-container" id="lineControls">
                        <label htmlFor="lineThicknessSlider">Line Thickness:</label>
                        <input
                            type="range"
                            id="lineThicknessSlider"
                            min="1"
                            max="20"
                            value={lineThickness}
                            onChange={(e) => setLineThickness(parseInt(e.target.value))}
                        />
                        <span>{lineThickness}</span>px
                    </div>
                )}
            </div>
        </div>
    );
};

export default ShiboriCanvas; 