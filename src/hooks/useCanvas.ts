import { useRef, useCallback } from 'react';
import { ImageUtils } from '../utils/imageUtils';
import { DrawingTool } from '../types';
import { State, Action } from '../store/shiboriCanvasState';
import throttle from 'lodash-es/throttle';

export interface UseCanvasProps {
    state: State;
    dispatch: React.Dispatch<Action>;
}

function cachedLazy<T>(fn: () => T): () => T {
    let isCachePopulated = false;
    let returnValue: T | null = null;
    return () => {
        if (!isCachePopulated || returnValue === null) {
            returnValue = fn();
            isCachePopulated = true;
        }
        return returnValue;
    };
}

export function useCanvas({ state, dispatch }: UseCanvasProps) {
    // Canvas references
    const unfoldedCanvasRef = useRef<HTMLCanvasElement>(null);
    const foldedCanvasRef = useRef<HTMLCanvasElement>(null);

    // Reference to the folded canvas original state (for preview drawing)
    const originalFoldedCanvasState = useRef<ImageData | null>(null);

    // Reference to the unfolded canvas original state (for preview drawing)
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

    // Function to draw diagonal fold lines
    const drawDiagonalFoldLines = useCallback(() => {
        // Only draw if diagonal folds are enabled, only one fold is applied, and canvas is square
        if (!state.folds.diagonal.enabled ||
            state.folds.diagonal.count !== 1 ||
            state.folds.vertical !== state.folds.horizontal) {
            return;
        }

        const unfoldedCanvas = unfoldedCanvasRef.current;
        if (!unfoldedCanvas) return;

        const unfoldedCtx = unfoldedCanvas.getContext('2d', { willReadFrequently: true });
        if (!unfoldedCtx) return;

        const width = unfoldedCanvas.width;
        const height = unfoldedCanvas.height;
        const isTopLeftToBottomRight = state.folds.diagonal.direction === 'topLeftToBottomRight';

        unfoldedCtx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        unfoldedCtx.lineWidth = 1.5;
        unfoldedCtx.setLineDash([5, 3]); // Make diagonal lines dashed for distinction

        // With a single diagonal fold, we just need to draw the main diagonal
        unfoldedCtx.beginPath();

        if (isTopLeftToBottomRight) {
            // Top-left to bottom-right diagonal
            unfoldedCtx.moveTo(0, 0);
            unfoldedCtx.lineTo(width, height);
        } else {
            // Top-right to bottom-left diagonal
            unfoldedCtx.moveTo(width, 0);
            unfoldedCtx.lineTo(0, height);
        }

        unfoldedCtx.stroke();
        unfoldedCtx.setLineDash([]); // Reset line style
    }, [state.folds.diagonal, state.folds.vertical, state.folds.horizontal]);

    // Function to draw fold lines on the unfolded canvas
    const drawFoldLines = useCallback(() => {
        const unfoldedCanvas = unfoldedCanvasRef.current;
        if (!unfoldedCanvas) return;

        const unfoldedCtx = unfoldedCanvas.getContext('2d', { willReadFrequently: true });
        if (!unfoldedCtx) return;

        const width = unfoldedCanvas.width;
        const height = unfoldedCanvas.height;

        // Draw vertical fold lines
        unfoldedCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        unfoldedCtx.lineWidth = 1;

        // Vertical fold lines
        for (let i = 1; i <= state.folds.vertical; i++) {
            const segments = Math.pow(2, i);
            for (let j = 1; j < segments; j++) {
                const x = (width / segments) * j;

                unfoldedCtx.beginPath();
                unfoldedCtx.moveTo(x, 0);
                unfoldedCtx.lineTo(x, height);
                unfoldedCtx.stroke();
            }
        }

        // Horizontal fold lines
        for (let i = 1; i <= state.folds.horizontal; i++) {
            const segments = Math.pow(2, i);
            for (let j = 1; j < segments; j++) {
                const y = (height / segments) * j;

                unfoldedCtx.beginPath();
                unfoldedCtx.moveTo(0, y);
                unfoldedCtx.lineTo(width, y);
                unfoldedCtx.stroke();
            }
        }

        // No need to draw diagonal fold lines on the unfolded canvas anymore
        // They're drawn on the folded canvas and propagated through normal unfolding
    }, [state.folds.vertical, state.folds.horizontal]);

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

    // Function to draw diagonal fold lines on the folded canvas
    const drawDiagonalFoldLinesOnFolded = useCallback(() => {
        // Only draw if diagonal folds are enabled, exactly one fold, and canvas is square
        if (!state.folds.diagonal.enabled ||
            state.folds.diagonal.count !== 1 ||
            state.folds.vertical !== state.folds.horizontal) {
            return;
        }

        const foldedCanvas = foldedCanvasRef.current;
        if (!foldedCanvas) return;

        const foldedCtx = foldedCanvas.getContext('2d', { willReadFrequently: true });
        if (!foldedCtx) return;

        const width = foldedCanvas.width;
        const height = foldedCanvas.height;
        const isTopLeftToBottomRight = state.folds.diagonal.direction === 'topLeftToBottomRight';

        foldedCtx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        foldedCtx.lineWidth = 1;
        foldedCtx.setLineDash([3, 2]); // Make diagonal lines dashed for distinction

        // Draw the diagonal fold line
        foldedCtx.beginPath();

        if (isTopLeftToBottomRight) {
            // Top-left to bottom-right diagonal
            foldedCtx.moveTo(0, 0);
            foldedCtx.lineTo(width, height);
        } else {
            // Top-right to bottom-left diagonal
            foldedCtx.moveTo(width, 0);
            foldedCtx.lineTo(0, height);
        }

        foldedCtx.stroke();
        foldedCtx.setLineDash([]); // Reset line style
    }, [state.folds.diagonal, state.folds.vertical, state.folds.horizontal]);

    // Function to update the unfolded canvas by mirroring the folded canvas
    const updateUnfoldedCanvasUnthrottled = useCallback(() => {
        console.log('updateUnfoldedCanvasUnthrottled');
        const unfoldedCanvas = unfoldedCanvasRef.current;
        const foldedCanvas = foldedCanvasRef.current;

        if (!unfoldedCanvas || !foldedCanvas) return;

        const unfoldedCtx = unfoldedCanvas.getContext('2d', { willReadFrequently: true });
        const foldedCtx = foldedCanvas.getContext('2d', { willReadFrequently: true });

        if (!unfoldedCtx || !foldedCtx) return;

        unfoldedCtx.clearRect(0, 0, unfoldedCanvas.width, unfoldedCanvas.height);

        // Get the original image data from the folded canvas
        const originalImage = foldedCtx.getImageData(0, 0, foldedCanvas.width, foldedCanvas.height);

        // Create the other pattern variations we'll need based on horizontal and vertical folds
        const horizontalFlipped = cachedLazy(() => ImageUtils.flipHorizontal(originalImage));
        const verticalFlipped = cachedLazy(() => ImageUtils.flipVertical(originalImage));
        const bothFlipped = cachedLazy(() => ImageUtils.flipVertical(horizontalFlipped())); // or flipHorizontal(verticalFlipped)

        // Apply diagonal fold transformations if enabled
        // We'll apply them to all four basic patterns
        const getOriginal = () => originalImage;
        let getHorizontalFlipped = horizontalFlipped;
        let getVerticalFlipped = verticalFlipped;
        let getBothFlipped = bothFlipped;

        // Only apply diagonal transformations when enabled, exactly one fold, and canvas is square
        if (state.folds.diagonal.enabled &&
            state.folds.diagonal.count === 1 &&
            state.folds.vertical === state.folds.horizontal) {

            if (state.folds.diagonal.direction === 'topLeftToBottomRight') {
                // Keep original as is
                getHorizontalFlipped = cachedLazy(() => ImageUtils.flipDiagonalTopLeftToBottomRight(horizontalFlipped()));
                getVerticalFlipped = cachedLazy(() => ImageUtils.flipDiagonalTopLeftToBottomRight(verticalFlipped()));
                getBothFlipped = cachedLazy(() => ImageUtils.flipDiagonalTopLeftToBottomRight(bothFlipped()));
            } else {
                // topRightToBottomLeft
                // Keep original as is
                getHorizontalFlipped = cachedLazy(() => ImageUtils.flipDiagonalTopRightToBottomLeft(horizontalFlipped()));
                getVerticalFlipped = cachedLazy(() => ImageUtils.flipDiagonalTopRightToBottomLeft(verticalFlipped()));
                getBothFlipped = cachedLazy(() => ImageUtils.flipDiagonalTopRightToBottomLeft(bothFlipped()));
            }
        }

        // Calculate the total grid size based on folds
        const gridWidth = Math.pow(2, state.folds.vertical);
        const gridHeight = Math.pow(2, state.folds.horizontal);

        // Determine each cell's dimensions
        const cellWidth = originalImage.width;
        const cellHeight = originalImage.height;

        // For each cell in the grid, determine which pattern to use
        for (let row = 0; row < gridHeight; row++) {
            for (let col = 0; col < gridWidth; col++) {
                // Determine which pattern to use based on row and column position
                let patternToUse: ImageData;

                const isRowEven = row % 2 === 0;
                const isColEven = col % 2 === 0;

                if (isRowEven && isColEven) {
                    patternToUse = getOriginal();
                } else if (isRowEven && !isColEven) {
                    patternToUse = getHorizontalFlipped();
                } else if (!isRowEven && isColEven) {
                    patternToUse = getVerticalFlipped();
                } else {
                    patternToUse = getBothFlipped();
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
    }, [state.folds.vertical, state.folds.horizontal, state.folds.diagonal, drawFoldLines]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const updateUnfoldedCanvas = useCallback(throttle(updateUnfoldedCanvasUnthrottled, 100), [updateUnfoldedCanvasUnthrottled]);

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

        // Redraw diagonal fold lines on the folded canvas
        drawDiagonalFoldLinesOnFolded();

        updateUnfoldedCanvas();
    }, [state.circleRadius, state.config.circleColor, updateUnfoldedCanvas, drawDiagonalFoldLinesOnFolded]);

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

        // Redraw diagonal fold lines on the folded canvas
        drawDiagonalFoldLinesOnFolded();

        updateUnfoldedCanvas();
    }, [state.config.lineColor, state.lineThickness, updateUnfoldedCanvas, drawDiagonalFoldLinesOnFolded]);

    // Helper function to get canvas coordinates from mouse/touch event
    const getCanvasCoordinates = useCallback((clientX: number, clientY: number) => {
        const foldedCanvas = foldedCanvasRef.current;
        if (!foldedCanvas) return null;

        const rect = foldedCanvas.getBoundingClientRect();
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }, []);

    // Helper function to store original canvas states
    const storeCanvasStates = useCallback(() => {
        const foldedCanvas = foldedCanvasRef.current;
        const unfoldedCanvas = unfoldedCanvasRef.current;
        if (!foldedCanvas || !unfoldedCanvas) return;

        const foldedCtx = foldedCanvas.getContext('2d', { willReadFrequently: true });
        const unfoldedCtx = unfoldedCanvas.getContext('2d', { willReadFrequently: true });

        if (foldedCtx && unfoldedCtx) {
            originalFoldedCanvasState.current = foldedCtx.getImageData(0, 0, foldedCanvas.width, foldedCanvas.height);
            originalUnfoldedCanvasState.current = unfoldedCtx.getImageData(0, 0, unfoldedCanvas.width, unfoldedCanvas.height);
        }
    }, []);

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

        // Redraw diagonal fold lines on the folded canvas for visual guidance
        drawDiagonalFoldLinesOnFolded();

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

    // Common start drawing function
    const startDrawing = useCallback((x: number, y: number) => {
        if (state.currentTool === DrawingTool.Circle) {
            dispatch({ type: 'SET_IS_DRAWING', payload: true });
            drawCircleOnFoldedCanvas(x, y);
        } else if (state.currentTool === DrawingTool.Line) {
            dispatch({ type: 'SET_LINE_START_POINT', payload: { x, y } });
            dispatch({ type: 'SET_IS_DRAWING', payload: true });
            storeCanvasStates();
        }
    }, [state.currentTool, dispatch, drawCircleOnFoldedCanvas, storeCanvasStates]);

    // Common continue drawing function
    const continueDrawing = useCallback((x: number, y: number) => {
        if (state.currentTool === DrawingTool.Circle && state.isDrawing) {
            drawCircleOnFoldedCanvas(x, y);
        } else if (state.currentTool === DrawingTool.Line && state.isDrawing && state.lineStartPoint !== null) {
            drawPreviewLineOnBothCanvases(
                state.lineStartPoint.x,
                state.lineStartPoint.y,
                x,
                y
            );
        }
    }, [state.currentTool, state.isDrawing, state.lineStartPoint, drawCircleOnFoldedCanvas, drawPreviewLineOnBothCanvases]);

    // Common end drawing function
    const endDrawing = useCallback((x: number, y: number) => {
        if (state.currentTool === DrawingTool.Circle) {
            dispatch({ type: 'SET_IS_DRAWING', payload: false });
        } else if (state.currentTool === DrawingTool.Line && state.isDrawing && state.lineStartPoint !== null) {
            drawLineOnFoldedCanvas(state.lineStartPoint.x, state.lineStartPoint.y, x, y);
            dispatch({ type: 'SET_IS_DRAWING', payload: false });
            dispatch({ type: 'SET_LINE_START_POINT', payload: null });
            originalFoldedCanvasState.current = null;
            originalUnfoldedCanvasState.current = null;
        }
    }, [state.currentTool, state.isDrawing, state.lineStartPoint, dispatch, drawLineOnFoldedCanvas]);

    // Handle mouse events for the folded canvas
    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const coords = getCanvasCoordinates(e.clientX, e.clientY);
        if (!coords) return;

        startDrawing(coords.x, coords.y);
    }, [getCanvasCoordinates, startDrawing]);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const coords = getCanvasCoordinates(e.clientX, e.clientY);
        if (!coords) return;

        continueDrawing(coords.x, coords.y);
    }, [getCanvasCoordinates, continueDrawing]);

    const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const coords = getCanvasCoordinates(e.clientX, e.clientY);
        if (!coords) return;

        endDrawing(coords.x, coords.y);
    }, [getCanvasCoordinates, endDrawing]);

    // Handle touch events for mobile devices
    const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault(); // Prevent scrolling
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const coords = getCanvasCoordinates(touch.clientX, touch.clientY);
            if (!coords) return;

            startDrawing(coords.x, coords.y);
        }
    }, [getCanvasCoordinates, startDrawing]);

    const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault(); // Prevent scrolling
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const coords = getCanvasCoordinates(touch.clientX, touch.clientY);
            if (!coords) return;

            continueDrawing(coords.x, coords.y);
        }
    }, [getCanvasCoordinates, continueDrawing]);

    const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault(); // Prevent scrolling
        if (state.isDrawing) {
            // For touch end, we need to use the last known position since there are no coordinates in the touchend event
            if (state.currentTool === DrawingTool.Circle) {
                dispatch({ type: 'SET_IS_DRAWING', payload: false });
            } else if (state.currentTool === DrawingTool.Line && state.lineStartPoint !== null) {
                // For lines, check if we have a last touch position
                // If not, just cancel the drawing
                const foldedCanvas = foldedCanvasRef.current;
                if (!foldedCanvas) {
                    dispatch({ type: 'SET_IS_DRAWING', payload: false });
                    dispatch({ type: 'SET_LINE_START_POINT', payload: null });
                    originalFoldedCanvasState.current = null;
                    originalUnfoldedCanvasState.current = null;
                    return;
                }

                // Use the last position from changedTouches if available
                if (e.changedTouches && e.changedTouches.length > 0) {
                    const touch = e.changedTouches[0];
                    const coords = getCanvasCoordinates(touch.clientX, touch.clientY);
                    if (coords) {
                        endDrawing(coords.x, coords.y);
                    } else {
                        // Just reset if we couldn't get coordinates
                        dispatch({ type: 'SET_IS_DRAWING', payload: false });
                        dispatch({ type: 'SET_LINE_START_POINT', payload: null });
                        originalFoldedCanvasState.current = null;
                        originalUnfoldedCanvasState.current = null;
                    }
                } else {
                    // Just reset if we couldn't get coordinates
                    dispatch({ type: 'SET_IS_DRAWING', payload: false });
                    dispatch({ type: 'SET_LINE_START_POINT', payload: null });
                    originalFoldedCanvasState.current = null;
                    originalUnfoldedCanvasState.current = null;
                }
            }
        }
    }, [state.currentTool, state.isDrawing, state.lineStartPoint, dispatch, getCanvasCoordinates, endDrawing]);

    const handleTouchCancel = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault(); // Prevent scrolling
        // Just reset drawing state
        dispatch({ type: 'SET_IS_DRAWING', payload: false });
        dispatch({ type: 'SET_LINE_START_POINT', payload: null });
        originalFoldedCanvasState.current = null;
        originalUnfoldedCanvasState.current = null;

        // Restore canvases to their original state
        const foldedCanvas = foldedCanvasRef.current;
        const unfoldedCanvas = unfoldedCanvasRef.current;
        if (!foldedCanvas || !unfoldedCanvas) return;

        const foldedCtx = foldedCanvas.getContext('2d', { willReadFrequently: true });
        const unfoldedCtx = unfoldedCanvas.getContext('2d', { willReadFrequently: true });

        if (foldedCtx && unfoldedCtx) {
            if (originalFoldedCanvasState.current) {
                foldedCtx.putImageData(originalFoldedCanvasState.current, 0, 0);
            }
            if (originalUnfoldedCanvasState.current) {
                unfoldedCtx.putImageData(originalUnfoldedCanvasState.current, 0, 0);
            }
        }
    }, [dispatch]);

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

    // Function called when initializing or resetting the drawing canvas
    const resetCanvases = useCallback(() => {
        // Update folded canvas dimensions
        updateFoldedCanvasDimensions();

        // Draw diagonal fold lines on the folded canvas
        drawDiagonalFoldLinesOnFolded();

        // Clear the canvases
        clearCanvases();

        // Draw the fold lines
        drawFoldLines();
    }, [state.canvasDimensions, clearCanvases, updateFoldedCanvasDimensions, drawFoldLines, drawDiagonalFoldLinesOnFolded]);

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
        resetCanvases,

        // Mouse event handlers
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleMouseLeave,

        // Touch event handlers
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
        handleTouchCancel
    };
} 