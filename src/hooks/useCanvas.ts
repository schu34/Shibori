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
        if (!foldedCanvas) return;

        const rect = foldedCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (state.currentTool === DrawingTool.Circle) {
            dispatch({ type: 'SET_IS_DRAWING', payload: true });
            drawCircleOnFoldedCanvas(x, y);
        } else if (state.currentTool === DrawingTool.Line) {
            if (state.lineStartPoint === null) {
                // First click - set start point
                dispatch({ type: 'SET_LINE_START_POINT', payload: { x, y } });

                // Draw a temporary dot to show the start point
                const foldedCtx = foldedCanvas.getContext('2d', { willReadFrequently: true });
                if (!foldedCtx) return;

                foldedCtx.beginPath();
                foldedCtx.arc(x, y, 3, 0, Math.PI * 2);
                foldedCtx.fillStyle = state.config.lineColor;
                foldedCtx.fill();
            } else {
                // Second click - draw the line
                drawLineOnFoldedCanvas(state.lineStartPoint.x, state.lineStartPoint.y, x, y);
                dispatch({ type: 'SET_LINE_START_POINT', payload: null });
            }
        }
    }, [state.currentTool, state.lineStartPoint, state.config.lineColor, dispatch, drawCircleOnFoldedCanvas, drawLineOnFoldedCanvas]);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (state.currentTool === DrawingTool.Circle && state.isDrawing) {
            const foldedCanvas = foldedCanvasRef.current;
            if (!foldedCanvas) return;

            const rect = foldedCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            drawCircleOnFoldedCanvas(x, y);
        }
    }, [state.currentTool, state.isDrawing, drawCircleOnFoldedCanvas]);

    const handleMouseUp = useCallback(() => {
        if (state.currentTool === DrawingTool.Circle) {
            dispatch({ type: 'SET_IS_DRAWING', payload: false });
        }
    }, [state.currentTool, dispatch]);

    const handleMouseLeave = useCallback(() => {
        if (state.currentTool === DrawingTool.Circle) {
            dispatch({ type: 'SET_IS_DRAWING', payload: false });
        }
    }, [state.currentTool, dispatch]);

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