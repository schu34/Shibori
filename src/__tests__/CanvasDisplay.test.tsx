import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CanvasDisplay } from '../components/shibori/CanvasDisplay';
import { State } from '../store/shiboriCanvasState';
import { DrawingTool, DiagonalDirection } from '../types';

// Mock the useCanvas hook
jest.mock('../hooks/useCanvas', () => ({
    useCanvas: () => ({
        unfoldedCanvasRef: { current: null },
        foldedCanvasRef: { current: null },
        resetCanvases: jest.fn(),
        handleMouseDown: jest.fn(),
        handleMouseMove: jest.fn(),
        handleMouseUp: jest.fn(),
        handleMouseLeave: jest.fn(),
        handleTouchStart: jest.fn(),
        handleTouchMove: jest.fn(),
        handleTouchEnd: jest.fn(),
        handleTouchCancel: jest.fn(),
        // Add missing properties to satisfy TypeScript
        clearCanvases: jest.fn(),
        updateFoldedCanvasDimensions: jest.fn(),
        drawFoldLines: jest.fn(),
        drawCircleOnFoldedCanvas: jest.fn(),
        drawLineOnFoldedCanvas: jest.fn(),
        updateUnfoldedCanvas: jest.fn(),
        debouncedUpdateUnfoldedCanvas: jest.fn()
    })
}));

describe('CanvasDisplay Component', () => {
    const mockState: State = {
        config: {
            maxFolds: 3,
            unfoldedCanvasWidth: 400,
            unfoldedCanvasHeight: 400,
            defaultCircleRadius: 20,
            circleColor: 'white',
            defaultLineThickness: 2,
            lineColor: 'white',
        },
        folds: {
            vertical: 2,
            horizontal: 1,
            diagonal: {
                enabled: false,
                count: 0,
                direction: DiagonalDirection.TopLeftToBottomRight
            }
        },
        circleRadius: 20,
        lineThickness: 2,
        currentTool: DrawingTool.Circle,
        isDrawing: false,
        lineStartPoint: null,
        canvasDimensions: {
            width: 400,
            height: 400
        }
    };

    const mockDispatch = jest.fn();

    test('renders canvas components', () => {
        const { container } = render(<CanvasDisplay state={mockState} dispatch={mockDispatch} />);

        // Check if the component renders canvas elements
        const canvases = container.querySelectorAll('canvas');
        expect(canvases.length).toBe(2);

        // Check if titles are rendered
        expect(container.textContent).toContain('Unfolded Version');
        expect(container.textContent).toContain('Folded Version');
    });
}); 