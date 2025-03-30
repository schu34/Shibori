import { useRef, useCallback, useEffect, RefObject } from 'react';
import { ImageUtils } from '../utils/imageUtils';
import throttle from 'lodash-es/throttle';
import { DrawingModeFactory } from '../drawingModes/DrawingModeFactory';
import { useAppSelector, useAppDispatch } from './useReduxHooks';
import { CanvasDimensions } from '../types/DrawingMode';

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

export function useCanvas() {
    const state = useAppSelector(state => state.shibori);
    const dispatch = useAppDispatch();

    // Canvas references
    const unfoldedCanvasRef = useRef<HTMLCanvasElement>(null);
    const foldedCanvasRef = useRef<HTMLCanvasElement>(null);

    // Canvas context references - shared across the app
    const foldedCtxRef = useRef<CanvasRenderingContext2D | null>(null);
    const unfoldedCtxRef = useRef<CanvasRenderingContext2D | null>(null);

    // Initialize canvas contexts when canvas refs are available
    useEffect(() => {
        if (foldedCanvasRef.current) {
            foldedCtxRef.current = foldedCanvasRef.current.getContext('2d', { willReadFrequently: true });
        }
        if (unfoldedCanvasRef.current) {
            unfoldedCtxRef.current = unfoldedCanvasRef.current.getContext('2d', { willReadFrequently: true });
        }
    }, [foldedCanvasRef.current, unfoldedCanvasRef.current]);

    // Function to clear both canvases
    const clearCanvases = useCallback((backgroundColor?: string) => {
        const unfoldedCanvas = unfoldedCanvasRef.current;
        const foldedCanvas = foldedCanvasRef.current;
        const unfoldedCtx = unfoldedCtxRef.current;
        const foldedCtx = foldedCtxRef.current;

        if (!unfoldedCanvas || !foldedCanvas || !unfoldedCtx || !foldedCtx) return;

        unfoldedCtx.clearRect(0, 0, unfoldedCanvas.width, unfoldedCanvas.height);
        foldedCtx.clearRect(0, 0, foldedCanvas.width, foldedCanvas.height);

        // If a background color is provided, fill the canvas with it
        if (backgroundColor) {
            unfoldedCtx.fillStyle = backgroundColor;
            unfoldedCtx.fillRect(0, 0, unfoldedCanvas.width, unfoldedCanvas.height);

            foldedCtx.fillStyle = backgroundColor;
            foldedCtx.fillRect(0, 0, foldedCanvas.width, foldedCanvas.height);
        }
    }, []);

    // Function to draw fold lines on the unfolded canvas
    const drawFoldLines = useCallback(() => {
        const unfoldedCanvas = unfoldedCanvasRef.current;
        const unfoldedCtx = unfoldedCtxRef.current;

        if (!unfoldedCanvas || !unfoldedCtx) return;

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

        // Re-initialize context after canvas resize
        foldedCtxRef.current = foldedCanvas.getContext('2d', { willReadFrequently: true });

        // Apply navy background to folded canvas after resizing
        if (foldedCtxRef.current) {
            foldedCtxRef.current.fillStyle = 'navy';
            foldedCtxRef.current.fillRect(0, 0, foldedWidth, foldedHeight);
        }
    }, [state.folds.vertical, state.folds.horizontal]);

    // Function to draw diagonal fold lines on the folded canvas
    const drawDiagonalFoldLinesOnFolded = useCallback(() => {
        // Only draw if diagonal folds are exactly one fold, and canvas is square
        if (state.folds.diagonal.count !== 1 ||
            state.folds.vertical !== state.folds.horizontal) {
            return;
        }

        const foldedCanvas = foldedCanvasRef.current;
        const foldedCtx = foldedCtxRef.current;

        if (!foldedCanvas || !foldedCtx) return;

        const width = foldedCanvas.width;
        const height = foldedCanvas.height;
        const isTopLeftToBottomRight = false;

        foldedCtx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        foldedCtx.lineWidth = 1;
        foldedCtx.setLineDash([5, 3]); // Make diagonal lines dashed for better visibility

        // Draw the diagonal fold line
        foldedCtx.beginPath();

        // Top-left to bottom-right diagonal
        foldedCtx.moveTo(0, 0);
        foldedCtx.lineTo(width, height);

        foldedCtx.stroke();
        foldedCtx.setLineDash([]); // Reset line style

        // Add a small indicator at each end of the diagonal line
        foldedCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';

        if (isTopLeftToBottomRight) {
            // Indicators for top-left to bottom-right
            foldedCtx.beginPath();
            foldedCtx.arc(0, 0, 3, 0, Math.PI * 2);
            foldedCtx.fill();

            foldedCtx.beginPath();
            foldedCtx.arc(width, height, 3, 0, Math.PI * 2);
            foldedCtx.fill();
        } else {
            // Indicators for top-right to bottom-left
            foldedCtx.beginPath();
            foldedCtx.arc(width, 0, 3, 0, Math.PI * 2);
            foldedCtx.fill();

            foldedCtx.beginPath();
            foldedCtx.arc(0, height, 3, 0, Math.PI * 2);
            foldedCtx.fill();
        }
    }, [state.folds.diagonal, state.folds.vertical, state.folds.horizontal]);

    // Function to update the unfolded canvas by mirroring the folded canvas
    const updateUnfoldedCanvasUnthrottled = useCallback(() => {
        console.log('updateUnfoldedCanvasUnthrottled');
        const unfoldedCanvas = unfoldedCanvasRef.current;
        const foldedCanvas = foldedCanvasRef.current;
        const unfoldedCtx = unfoldedCtxRef.current;
        const foldedCtx = foldedCtxRef.current;

        if (!unfoldedCanvas || !foldedCanvas || !unfoldedCtx || !foldedCtx) return;

        // Clear the unfolded canvas and apply navy background
        unfoldedCtx.clearRect(0, 0, unfoldedCanvas.width, unfoldedCanvas.height);
        unfoldedCtx.fillStyle = 'navy';
        unfoldedCtx.fillRect(0, 0, unfoldedCanvas.width, unfoldedCanvas.height);

        // Get the original image data from the folded canvas
        let originalImage = foldedCtx.getImageData(0, 0, foldedCanvas.width, foldedCanvas.height);

        // Create the other pattern variations we'll need based on horizontal and vertical folds
        const horizontalFlipped = cachedLazy(() => ImageUtils.flipHorizontal(originalImage));
        const verticalFlipped = cachedLazy(() => ImageUtils.flipVertical(originalImage));
        const bothFlipped = cachedLazy(() => ImageUtils.flipVertical(horizontalFlipped())); // or flipHorizontal(verticalFlipped)

        if (state.folds.diagonal.count === 1 && state.folds.vertical === state.folds.horizontal) {
            originalImage = ImageUtils.mirrorDiagonalTopLeftToBottomRight(originalImage);
        }

        // Apply fold transformations We'll apply them to all four basic patterns
        const getOriginal = () => originalImage;
        const getHorizontalFlipped = horizontalFlipped;
        const getVerticalFlipped = verticalFlipped;
        const getBothFlipped = bothFlipped;

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

    // Function to check if a point is in the valid drawing area based on diagonal fold
    const isInValidDrawingArea = useCallback((x: number, y: number): boolean => {
        // Only apply restriction if diagonal fold is active (count is 1 and canvas is square)
        if (state.folds.diagonal.count !== 1 ||
            state.folds.vertical !== state.folds.horizontal) {
            return true;
        }

        const foldedCanvas = foldedCanvasRef.current;
        if (!foldedCanvas) return true;

        return y < x;
    }, [state.folds.diagonal, state.folds.vertical, state.folds.horizontal]);

    // Helper function to get canvas coordinates from mouse/touch event
    const getCanvasCoordinates = useCallback((clientX: number, clientY: number, foldedCanvas: HTMLCanvasElement) => {
        const rect = foldedCanvas.getBoundingClientRect();
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }, []);

    // Canvas dimension getters
    const getFoldedCanvasDimensions = useCallback((): CanvasDimensions | null => {
        const canvas = foldedCanvasRef.current;
        if (!canvas) return null;

        return {
            width: canvas.width,
            height: canvas.height
        };
    }, []);

    const getUnfoldedCanvasDimensions = useCallback((): CanvasDimensions | null => {
        const canvas = unfoldedCanvasRef.current;
        if (!canvas) return null;

        return {
            width: canvas.width,
            height: canvas.height
        };
    }, []);

    // Common start drawing function
    const startDrawing = useCallback((x: number, y: number) => {
        const mode = DrawingModeFactory.getMode(state.currentTool);
        if (!foldedCtxRef.current || !unfoldedCtxRef.current) return;
        mode.start({ x, y }, {
            state,
            dispatch,
            foldedCtx: foldedCtxRef.current,
            unfoldedCtx: unfoldedCtxRef.current,
            getFoldedCanvasDimensions,
            getUnfoldedCanvasDimensions,
            updateUnfoldedCanvas,
            drawDiagonalFoldLinesOnFolded,
            isInValidDrawingArea
        });
    }, [state, dispatch, getFoldedCanvasDimensions, getUnfoldedCanvasDimensions, updateUnfoldedCanvas, drawDiagonalFoldLinesOnFolded, isInValidDrawingArea]);

    // Common continue drawing function
    const continueDrawing = useCallback((x: number, y: number) => {
        const mode = DrawingModeFactory.getMode(state.currentTool);
        if (!foldedCtxRef.current || !unfoldedCtxRef.current) return;
        mode.continue({ x, y }, {
            state,
            dispatch,
            foldedCtx: foldedCtxRef.current,
            unfoldedCtx: unfoldedCtxRef.current,
            getFoldedCanvasDimensions,
            getUnfoldedCanvasDimensions,
            updateUnfoldedCanvas,
            drawDiagonalFoldLinesOnFolded,
            isInValidDrawingArea
        });
    }, [state, dispatch, getFoldedCanvasDimensions, getUnfoldedCanvasDimensions, updateUnfoldedCanvas, drawDiagonalFoldLinesOnFolded, isInValidDrawingArea]);

    // Common end drawing function
    const endDrawing = useCallback((x: number, y: number) => {
        const mode = DrawingModeFactory.getMode(state.currentTool);
        if (!foldedCtxRef.current || !unfoldedCtxRef.current) return;
        mode.end({ x, y }, {
            state,
            dispatch,
            foldedCtx: foldedCtxRef.current,
            unfoldedCtx: unfoldedCtxRef.current,
            getFoldedCanvasDimensions,
            getUnfoldedCanvasDimensions,
            updateUnfoldedCanvas,
            drawDiagonalFoldLinesOnFolded,
            isInValidDrawingArea
        });
    }, [state, dispatch, getFoldedCanvasDimensions, getUnfoldedCanvasDimensions, updateUnfoldedCanvas, drawDiagonalFoldLinesOnFolded, isInValidDrawingArea]);

    // Handle mouse events for the folded canvas
    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const foldedCanvas = assertCanvasRef(foldedCanvasRef);
        const coords = getCanvasCoordinates(e.clientX, e.clientY, foldedCanvas);
        if (!coords) return;

        startDrawing(coords.x, coords.y);
    }, [getCanvasCoordinates, startDrawing]);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const foldedCanvas = assertCanvasRef(foldedCanvasRef);
        const coords = getCanvasCoordinates(e.clientX, e.clientY, foldedCanvas);
        if (!coords) return;

        continueDrawing(coords.x, coords.y);
    }, [getCanvasCoordinates, continueDrawing]);

    const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const foldedCanvas = assertCanvasRef(foldedCanvasRef);
        const coords = getCanvasCoordinates(e.clientX, e.clientY, foldedCanvas);
        if (!coords) return;

        endDrawing(coords.x, coords.y);
    }, [getCanvasCoordinates, endDrawing]);

    const handleMouseLeave = useCallback(() => {
        if (state.isDrawing) {
            const mode = DrawingModeFactory.getMode(state.currentTool);
            if (!foldedCtxRef.current || !unfoldedCtxRef.current) return;
            mode.cancel({
                state,
                dispatch,
                foldedCtx: foldedCtxRef.current,
                unfoldedCtx: unfoldedCtxRef.current,
                getFoldedCanvasDimensions,
                getUnfoldedCanvasDimensions,
                updateUnfoldedCanvas,
                drawDiagonalFoldLinesOnFolded,
                isInValidDrawingArea
            });
        }
    }, [state, dispatch, getFoldedCanvasDimensions, getUnfoldedCanvasDimensions, updateUnfoldedCanvas, drawDiagonalFoldLinesOnFolded, isInValidDrawingArea]);

    // Handle touch events for mobile devices
    const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault(); // Prevent scrolling
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const foldedCanvas = assertCanvasRef(foldedCanvasRef);
            const coords = getCanvasCoordinates(touch.clientX, touch.clientY, foldedCanvas);
            if (!coords) return;

            startDrawing(coords.x, coords.y);
        }
    }, [getCanvasCoordinates, startDrawing]);

    const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault(); // Prevent scrolling
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const foldedCanvas = assertCanvasRef(foldedCanvasRef);
            const coords = getCanvasCoordinates(touch.clientX, touch.clientY, foldedCanvas);
            if (!coords) return;

            continueDrawing(coords.x, coords.y);
        }
    }, [getCanvasCoordinates, continueDrawing]);

    const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault(); // Prevent scrolling
        if (state.isDrawing && e.changedTouches && e.changedTouches.length > 0) {
            const touch = e.changedTouches[0];
            const foldedCanvas = assertCanvasRef(foldedCanvasRef);
            const coords = getCanvasCoordinates(touch.clientX, touch.clientY, foldedCanvas);
            if (coords) {
                endDrawing(coords.x, coords.y);
            }
        }
    }, [state, dispatch, getCanvasCoordinates, endDrawing, updateUnfoldedCanvas, drawDiagonalFoldLinesOnFolded, isInValidDrawingArea]);

    const handleTouchCancel = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault(); // Prevent scrolling
        const mode = DrawingModeFactory.getMode(state.currentTool);
        if (!foldedCtxRef.current || !unfoldedCtxRef.current) return;
        mode.cancel({
            state,
            dispatch,
            foldedCtx: foldedCtxRef.current,
            unfoldedCtx: unfoldedCtxRef.current,
            getFoldedCanvasDimensions,
            getUnfoldedCanvasDimensions,
            updateUnfoldedCanvas,
            drawDiagonalFoldLinesOnFolded,
            isInValidDrawingArea
        });
    }, [state, dispatch, getFoldedCanvasDimensions, getUnfoldedCanvasDimensions, updateUnfoldedCanvas, drawDiagonalFoldLinesOnFolded, isInValidDrawingArea]);

    // Function called when initializing or resetting the drawing canvas
    const resetCanvases = useCallback(() => {
        // Update folded canvas dimensions
        updateFoldedCanvasDimensions();

        // Clear the canvases with navy background
        clearCanvases('navy');

        // Draw the fold lines
        drawFoldLines();

        // Draw diagonal fold lines on the folded canvas
        drawDiagonalFoldLinesOnFolded();
    }, [clearCanvases, updateFoldedCanvasDimensions, drawFoldLines, drawDiagonalFoldLinesOnFolded]);

    // Function to download the unfolded canvas as an image
    const downloadUnfoldedCanvas = useCallback(() => {
        const unfoldedCanvas = unfoldedCanvasRef.current;
        if (!unfoldedCanvas) return;

        try {
            // Create a temporary link element
            const link = document.createElement('a');

            // Convert canvas to a data URL (PNG format by default)
            const dataUrl = unfoldedCanvas.toDataURL('image/png');

            // Set the href to the data URL
            link.href = dataUrl;

            // Set the download attribute with filename
            link.download = `shibori-design-${new Date().toISOString().slice(0, 10)}.png`;

            // Append to body, click, and remove
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Error downloading canvas as image:', error);
        }
    }, []);

    return {
        unfoldedCanvasRef,
        foldedCanvasRef,
        clearCanvases,
        updateFoldedCanvasDimensions,
        drawFoldLines,
        updateUnfoldedCanvas,
        resetCanvases,
        downloadUnfoldedCanvas,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleMouseLeave,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
        handleTouchCancel
    };
}

function assertCanvasRef(canvasRef: RefObject<HTMLCanvasElement | null>) {
    if (!canvasRef.current) {
        throw new Error('Canvas ref is not set');
    }
    return canvasRef.current;
}
