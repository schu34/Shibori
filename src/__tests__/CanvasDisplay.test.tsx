import { renderWithRedux } from '../testUtils';
import '@testing-library/jest-dom';
import { CanvasDisplay } from '../components/shibori/CanvasDisplay';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createAppStore } from '../store';
import { initialState, ActionType } from '../store/shiboriCanvasState';
import { DrawingTool, HistoryAction } from '../types';

// Mock the useCanvas hook
jest.mock('../hooks/useCanvas', () => ({
    useCanvas: () => ({
        unfoldedCanvasRef: { current: null },
        foldedCanvasRef: { current: null },
        foldedCtxRef: { current: null },
        unfoldedCtxRef: { current: null },
        resetCanvases: jest.fn(),
        handlePointerDown: jest.fn(),
        handlePointerMove: jest.fn(),
        handlePointerUp: jest.fn(),
        handlePointerCancel: jest.fn(),
        handleLostPointerCapture: jest.fn(),
        handleKeyDown: jest.fn(),
        // Add missing properties to satisfy TypeScript
        clearCanvases: jest.fn(),
        updateFoldedCanvasDimensions: jest.fn(),
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

    test('keeps the folded canvas backing store at full resolution for matching fold counts', () => {
        const { container } = renderWithRedux(<CanvasDisplay />);
        const [foldedCanvas, unfoldedCanvas] = Array.from(container.querySelectorAll('canvas'));

        expect(foldedCanvas).toHaveAttribute('width', '1600');
        expect(foldedCanvas).toHaveAttribute('height', '1600');
        expect(unfoldedCanvas).toHaveAttribute('width', '1600');
        expect(unfoldedCanvas).toHaveAttribute('height', '1600');
    });

    test('toggles fold guides as display-only overlays', () => {
        const { container } = renderWithRedux(<CanvasDisplay />);

        expect(screen.getByRole('button', { name: 'Hide fold guides' })).toHaveAttribute('aria-pressed', 'true');
        expect(container.querySelectorAll('.fold-guide-overlay')).toHaveLength(2);

        fireEvent.click(screen.getByRole('button', { name: 'Hide fold guides' }));

        expect(screen.getByRole('button', { name: 'Show fold guides' })).toHaveAttribute('aria-pressed', 'false');
        expect(container.querySelectorAll('.fold-guide-overlay')).toHaveLength(0);
    });

    test('Clear adds one undoable command and performs no imperative canvas reset', () => {
        const store = createAppStore({
            shibori: {
                ...initialState,
                history: [{
                    id: 'line-1',
                    action: DrawingTool.Line,
                    points: [{ x: 1, y: 1 }, { x: 5, y: 5 }],
                }],
            },
        });
        const dispatch = jest.spyOn(store, 'dispatch');
        render(<Provider store={store}><CanvasDisplay /></Provider>);

        fireEvent.click(screen.getByTitle('Clear canvas'));

        expect(dispatch).toHaveBeenCalledTimes(1);
        expect(dispatch).toHaveBeenCalledWith({
            type: ActionType.ADD_HISTORY_ITEM,
            payload: { action: HistoryAction.Clear, points: [] },
        });
    });

    test('Clear is a no-op when history is already empty', () => {
        const store = createAppStore();
        const dispatch = jest.spyOn(store, 'dispatch');
        render(<Provider store={store}><CanvasDisplay /></Provider>);

        fireEvent.click(screen.getByTitle('Clear canvas'));

        expect(dispatch).not.toHaveBeenCalled();
    });

    test('Undo dispatches only the state transition', () => {
        const store = createAppStore({
            shibori: {
                ...initialState,
                history: [{
                    id: 'line-1',
                    action: DrawingTool.Line,
                    points: [{ x: 1, y: 1 }, { x: 5, y: 5 }],
                }],
            },
        });
        const dispatch = jest.spyOn(store, 'dispatch');
        render(<Provider store={store}><CanvasDisplay /></Provider>);

        fireEvent.click(screen.getByTitle('Undo'));

        expect(dispatch).toHaveBeenCalledTimes(1);
        expect(dispatch).toHaveBeenCalledWith({ type: ActionType.UNDO });
    });
}); 
