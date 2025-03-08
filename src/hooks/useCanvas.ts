import { useRef, useCallback } from 'react';
import { debounce } from 'lodash-es';
import { ImageUtils } from '../utils/imageUtils';
import { DrawingTool } from '../types';
import { State, Action } from '../store/shiboriCanvasState';

export interface UseCanvasProps {
    state: State;
    dispatch: React.Dispatch<Action>;
}

export function useCanvas({ state, dispatch }: UseCanvasProps) {
    // Canvas references
    const unfoldedCanvasRef = useRef<HTMLCanvasElement>(null);
    const foldedCanvasRef = useRef<HTMLCanvasElement>(null);

    // Add a ref to store the original canvas state
    const originalFoldedCanvasState = useRef<ImageData | null>(null);
    const originalUnfoldedCanvasState = useRef<ImageData | null>(null);

    // Function to clear both canvases
    const clearCanvases = useCallback(() => {
        const unfoldedCanvas = unfoldedCanvasRef.current;
        const foldedCanvas = foldedCanvasRef.current;

        if (!unfoldedCanvas || !foldedCanvas) return;

        const unfoldedCtx = unfoldedCanvas.getContext('2d', { willReadFrequently: true });
        const foldedCtx = foldedCanvas.getContext('2d', { willReadFrequently: true });

        if (!unfoldedCtx || !foldedCtx) return;

        unfoldedCtx.clearRect(0, 0, unfoldedCanvas.width, unfoldedCanvas.height);
        foldedCtx.clearRect(0, 0, foldedCanvas.width, foldedCanvas.height);
    }, []);

    // Function to draw fold lines for a specific axis
    const drawFoldLinesForAxis = useCallback((isVertical: boolean) => {
        const unfoldedCanvas = unfoldedCanvasRef.current;
        if (!unfoldedCanvas) return;

        const unfoldedCtx = unfoldedCanvas.getContext('2d', { willReadFrequently: true });
        if (!unfoldedCtx) return;

        const foldCount = isVertical ? state.folds.vertical : state.folds.horizontal;
        const canvasSize = isVertical ? unfoldedCanvas.width : unfoldedCanvas.height;

        unfoldedCtx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        unfoldedCtx.lineWidth = 1.5;

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
    }, [state.folds.vertical, state.folds.horizontal]);

    // Function to draw fold lines on the unfolded canvas
    const drawFoldLines = useCallback(() => {
        const unfoldedCanvas = unfoldedCanvasRef.current;
        if (!unfoldedCanvas) return;

        const unfoldedCtx = unfoldedCanvas.getContext('2d', { willReadFrequently: true });
        if (!unfoldedCtx) return;

        // Draw vertical fold lines
        drawFoldLinesForAxis(true);

        // Draw horizontal fold lines
        drawFoldLinesForAxis(false);
    }, [drawFoldLinesForAxis]);

    // Function to update folded canvas dimensions
    const updateFoldedCanvasDimensions = useCallback(() => {
        const unfoldedCanvas = unfoldedCanvasRef.current;
        const foldedCanvas = foldedCanvasRef.current;

        if (!unfoldedCanvas || !foldedCanvas) return;

        const foldedWidth = unfoldedCanvas.width / Math.pow(2, state.folds.vertical);
        const foldedHeight = unfoldedCanvas.height / Math.pow(2, state.folds.horizontal);

        foldedCanvas.width = foldedWidth;
        foldedCanvas.height = foldedHeight;
    }, [state.folds.vertical, state.folds.horizontal]);

    // Function to update the unfolded canvas by mirroring the folded canvas
    const updateUnfoldedCanvas = useCallback(() => {
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
        const gridWidth = Math.pow(2, state.folds.vertical);
        const gridHeight = Math.pow(2, state.folds.horizontal);

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
    }, [state.folds.vertical, state.folds.horizontal, drawFoldLines]);

    // Create a debounced version of updateUnfoldedCanvas using useCallback
    const debouncedUpdateUnfoldedCanvas = useCallback(
        debounce(() => {
            updateUnfoldedCanvas();
        }, state.config.debounceDelay),
        [updateUnfoldedCanvas, state.config.debounceDelay]
    );

    // Function to draw a circle on the folded canvas
    const drawCircleOnFoldedCanvas = useCallback((x: number, y: number) => {
        const foldedCanvas = foldedCanvasRef.current;
        if (!foldedCanvas) return;

        const foldedCtx = foldedCanvas.getContext('2d', { willReadFrequently: true });
        if (!foldedCtx) return;

        foldedCtx.beginPath();
        foldedCtx.arc(x, y, state.circleRadius, 0, Math.PI * 2);
        foldedCtx.fillStyle = state.config.circleColor;
        foldedCtx.fill();

        debouncedUpdateUnfoldedCanvas();
    }, [state.circleRadius, state.config.circleColor, debouncedUpdateUnfoldedCanvas]);

    // Function to draw a line on the folded canvas
    const drawLineOnFoldedCanvas = useCallback((startX: number, startY: number, endX: number, endY: number) => {
        const foldedCanvas = foldedCanvasRef.current;
        if (!foldedCanvas) return;

        const foldedCtx = foldedCanvas.getContext('2d', { willReadFrequently: true });
        if (!foldedCtx) return;

        foldedCtx.beginPath();
        foldedCtx.moveTo(startX, startY);
        foldedCtx.lineTo(endX, endY);
        foldedCtx.strokeStyle = state.config.lineColor;
        foldedCtx.lineWidth = state.lineThickness;
        foldedCtx.stroke();

        debouncedUpdateUnfoldedCanvas();
    }, [state.config.lineColor, state.lineThickness, debouncedUpdateUnfoldedCanvas]);

    // Handle mouse events for the folded canvas
    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const foldedCanvas = foldedCanvasRef.current;
        const unfoldedCanvas = unfoldedCanvasRef.current;
        if (!foldedCanvas || !unfoldedCanvas) return;

        const rect = foldedCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (state.currentTool === DrawingTool.Circle) {
            dispatch({ type: 'SET_IS_DRAWING', payload: true });
            drawCircleOnFoldedCanvas(x, y);
        } else if (state.currentTool === DrawingTool.Line) {
            // Set start point on mouse down and indicate we're drawing
            dispatch({ type: 'SET_LINE_START_POINT', payload: { x, y } });
            dispatch({ type: 'SET_IS_DRAWING', payload: true });

            // Store the original canvas states for preview restoration
            const foldedCtx = foldedCanvas.getContext('2d', { willReadFrequently: true });
            const unfoldedCtx = unfoldedCanvas.getContext('2d', { willReadFrequently: true });

            if (foldedCtx && unfoldedCtx) {
                originalFoldedCanvasState.current = foldedCtx.getImageData(0, 0, foldedCanvas.width, foldedCanvas.height);
                originalUnfoldedCanvasState.current = unfoldedCtx.getImageData(0, 0, unfoldedCanvas.width, unfoldedCanvas.height);
            }
        }
    }, [state.currentTool, dispatch, drawCircleOnFoldedCanvas]);

    // Helper function to draw preview line on both canvases
    const drawPreviewLineOnBothCanvases = useCallback((startX: number, startY: number, endX: number, endY: number) => {
        const foldedCanvas = foldedCanvasRef.current;
        const unfoldedCanvas = unfoldedCanvasRef.current;

        if (!foldedCanvas || !unfoldedCanvas) return;

        const foldedCtx = foldedCanvas.getContext('2d', { willReadFrequently: true });
        const unfoldedCtx = unfoldedCanvas.getContext('2d', { willReadFrequently: true });

        if (!foldedCtx || !unfoldedCtx) return;

        // Restore both canvases to their original states
        if (originalFoldedCanvasState.current) {
            foldedCtx.putImageData(originalFoldedCanvasState.current, 0, 0);
        }

        if (originalUnfoldedCanvasState.current) {
            unfoldedCtx.putImageData(originalUnfoldedCanvasState.current, 0, 0);
        }

        // Draw preview line on folded canvas
        foldedCtx.beginPath();
        foldedCtx.moveTo(startX, startY);
        foldedCtx.lineTo(endX, endY);
        foldedCtx.strokeStyle = state.config.lineColor;
        foldedCtx.lineWidth = state.lineThickness;
        foldedCtx.globalAlpha = 0.6;
        foldedCtx.stroke();
        foldedCtx.globalAlpha = 1.0;

        // Calculate relative positions for unfolded canvas
        const foldedWidth = foldedCanvas.width;
        const foldedHeight = foldedCanvas.height;
        const verticalFolds = state.folds.vertical;
        const horizontalFolds = state.folds.horizontal;

        // Draw preview line on each section of the unfolded canvas
        unfoldedCtx.globalAlpha = 0.6;
        unfoldedCtx.strokeStyle = state.config.lineColor;
        unfoldedCtx.lineWidth = state.lineThickness;

        // For each cell in the grid, determine how to map the line
        for (let row = 0; row < Math.pow(2, horizontalFolds); row++) {
            for (let col = 0; col < Math.pow(2, verticalFolds); col++) {
                const isRowEven = row % 2 === 0;
                const isColEven = col % 2 === 0;

                let mappedStartX = startX;
                let mappedStartY = startY;
                let mappedEndX = endX;
                let mappedEndY = endY;

                // Apply horizontal flipping if needed
                if (!isColEven) {
                    mappedStartX = foldedWidth - mappedStartX;
                    mappedEndX = foldedWidth - mappedEndX;
                }

                // Apply vertical flipping if needed
                if (!isRowEven) {
                    mappedStartY = foldedHeight - mappedStartY;
                    mappedEndY = foldedHeight - mappedEndY;
                }

                // Calculate position in the unfolded canvas
                const offsetX = col * foldedWidth;
                const offsetY = row * foldedHeight;

                // Draw the line segment
                unfoldedCtx.beginPath();
                unfoldedCtx.moveTo(offsetX + mappedStartX, offsetY + mappedStartY);
                unfoldedCtx.lineTo(offsetX + mappedEndX, offsetY + mappedEndY);
                unfoldedCtx.stroke();
            }
        }

        unfoldedCtx.globalAlpha = 1.0;
    }, [state.config.lineColor, state.lineThickness, state.folds.vertical, state.folds.horizontal]);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const foldedCanvas = foldedCanvasRef.current;
        if (!foldedCanvas) return;

        const rect = foldedCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (state.currentTool === DrawingTool.Circle && state.isDrawing) {
            drawCircleOnFoldedCanvas(x, y);
        } else if (state.currentTool === DrawingTool.Line && state.isDrawing && state.lineStartPoint !== null) {
            // Draw the preview line on both canvases
            drawPreviewLineOnBothCanvases(
                state.lineStartPoint.x,
                state.lineStartPoint.y,
                x,
                y
            );
        }
    }, [state.currentTool, state.isDrawing, state.lineStartPoint, drawCircleOnFoldedCanvas, drawPreviewLineOnBothCanvases]);

    const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (state.currentTool === DrawingTool.Circle) {
            dispatch({ type: 'SET_IS_DRAWING', payload: false });
        } else if (state.currentTool === DrawingTool.Line && state.isDrawing && state.lineStartPoint !== null) {
            const foldedCanvas = foldedCanvasRef.current;
            if (!foldedCanvas) return;

            const rect = foldedCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Draw the line from start point to where mouse was released
            drawLineOnFoldedCanvas(state.lineStartPoint.x, state.lineStartPoint.y, x, y);

            // Reset drawing state
            dispatch({ type: 'SET_IS_DRAWING', payload: false });
            dispatch({ type: 'SET_LINE_START_POINT', payload: null });
            originalFoldedCanvasState.current = null;
            originalUnfoldedCanvasState.current = null;
        }
    }, [state.currentTool, state.isDrawing, state.lineStartPoint, dispatch, drawLineOnFoldedCanvas]);

    const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        // Stop drawing for both tools when mouse leaves canvas
        if (state.isDrawing) {
            if (state.currentTool === DrawingTool.Circle) {
                dispatch({ type: 'SET_IS_DRAWING', payload: false });
            } else if (state.currentTool === DrawingTool.Line && state.lineStartPoint !== null) {
                const foldedCanvas = foldedCanvasRef.current;
                if (!foldedCanvas) {
                    dispatch({ type: 'SET_IS_DRAWING', payload: false });
                    dispatch({ type: 'SET_LINE_START_POINT', payload: null });
                    originalFoldedCanvasState.current = null;
                    originalUnfoldedCanvasState.current = null;
                    return;
                }

                // Get mouse position at the time it left the canvas
                const rect = foldedCanvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                // Calculate direction vector from start point to current mouse position
                const directionX = mouseX - state.lineStartPoint.x;
                const directionY = mouseY - state.lineStartPoint.y;

                // Find intersection with canvas boundary
                // First, determine which boundaries we need to check based on direction
                const boundaries = [];

                if (directionX > 0) {
                    // Moving right, check right boundary
                    boundaries.push({
                        x: foldedCanvas.width,
                        y: state.lineStartPoint.y + directionY * (foldedCanvas.width - state.lineStartPoint.x) / directionX
                    });
                } else if (directionX < 0) {
                    // Moving left, check left boundary
                    boundaries.push({
                        x: 0,
                        y: state.lineStartPoint.y + directionY * (-state.lineStartPoint.x) / directionX
                    });
                }

                if (directionY > 0) {
                    // Moving down, check bottom boundary
                    boundaries.push({
                        x: state.lineStartPoint.x + directionX * (foldedCanvas.height - state.lineStartPoint.y) / directionY,
                        y: foldedCanvas.height
                    });
                } else if (directionY < 0) {
                    // Moving up, check top boundary
                    boundaries.push({
                        x: state.lineStartPoint.x + directionX * (-state.lineStartPoint.y) / directionY,
                        y: 0
                    });
                }

                // Find the closest valid intersection point
                let intersectionPoint = null;
                let minDistance = Infinity;

                for (const point of boundaries) {
                    // Check if the point is actually on the canvas boundary (between 0 and width/height)
                    if (point.x >= 0 && point.x <= foldedCanvas.width &&
                        point.y >= 0 && point.y <= foldedCanvas.height) {

                        // Calculate distance from start point to this intersection
                        const dx = point.x - state.lineStartPoint.x;
                        const dy = point.y - state.lineStartPoint.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        // Check if this is along the direction of mouse movement
                        const dotProduct = dx * directionX + dy * directionY;

                        if (dotProduct > 0 && distance < minDistance) {
                            minDistance = distance;
                            intersectionPoint = point;
                        }
                    }
                }

                // Draw the line to the intersection point if found
                if (intersectionPoint) {
                    drawLineOnFoldedCanvas(
                        state.lineStartPoint.x,
                        state.lineStartPoint.y,
                        intersectionPoint.x,
                        intersectionPoint.y
                    );
                }

                // Reset drawing state
                dispatch({ type: 'SET_IS_DRAWING', payload: false });
                dispatch({ type: 'SET_LINE_START_POINT', payload: null });
                originalFoldedCanvasState.current = null;
                originalUnfoldedCanvasState.current = null;
            }
        }
    }, [state.currentTool, state.isDrawing, state.lineStartPoint, dispatch, drawLineOnFoldedCanvas]);

    // Initialize function to set up canvases
    const initializeCanvases = useCallback(() => {
        const unfoldedCanvas = unfoldedCanvasRef.current;
        const foldedCanvas = foldedCanvasRef.current;

        if (!unfoldedCanvas || !foldedCanvas) return;

        // Set initial canvas dimensions
        unfoldedCanvas.width = state.canvasDimensions.width;
        unfoldedCanvas.height = state.canvasDimensions.height;

        // Update folded canvas dimensions
        updateFoldedCanvasDimensions();

        // Clear the canvases
        clearCanvases();

        // Draw the fold lines
        drawFoldLines();
    }, [state.canvasDimensions, clearCanvases, updateFoldedCanvasDimensions, drawFoldLines]);

    return {
        // Refs
        unfoldedCanvasRef,
        foldedCanvasRef,

        // Canvas operations
        clearCanvases,
        updateFoldedCanvasDimensions,
        drawFoldLines,
        drawCircleOnFoldedCanvas,
        drawLineOnFoldedCanvas,
        updateUnfoldedCanvas,
        debouncedUpdateUnfoldedCanvas,
        initializeCanvases,

        // Event handlers
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleMouseLeave
    };
} 