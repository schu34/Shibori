import { renderWithRedux } from '../testUtils';
import '@testing-library/jest-dom';
import { CanvasDisplay } from '../components/shibori/CanvasDisplay';

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
    test('renders canvas components', () => {
        const { container } = renderWithRedux(<CanvasDisplay />);

        // Check if the component renders canvas elements
        const canvases = container.querySelectorAll('canvas');
        expect(canvases.length).toBe(2);

        // Check if titles are rendered
        expect(container.textContent).toContain('Unfolded Version');
        expect(container.textContent).toContain('Folded Version');
    });
}); 