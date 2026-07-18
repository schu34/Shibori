import { renderWithRedux } from '../testUtils'; import { fireEvent, screen } from '@testing-library/dom';
import '@testing-library/jest-dom';
import ShiboriCanvas from '../components/ShiboriCanvas';

// Mock the child components to isolate the main component in tests
jest.mock('../components/shibori/FoldControls', () => ({
    FoldControls: () => <div data-testid="mock-fold-controls">Fold Controls</div>
}));

jest.mock('../components/shibori/DimensionControls', () => ({
    DimensionControls: () => <div data-testid="mock-dimension-controls">Dimension Controls</div>
}));

jest.mock('../components/shibori/CanvasDisplay', () => ({
    CanvasDisplay: () => <div data-testid="mock-canvas-display">Canvas Display</div>
}));

jest.mock('../components/shibori/ToolControls', () => ({
    ToolControls: () => <div data-testid="mock-tool-controls">Tool Controls</div>
}));

describe('ShiboriCanvas Component', () => {
    test('renders without crashing', () => {
        renderWithRedux(<ShiboriCanvas />);

        // Check if the component renders its title
        expect(screen.getByRole('heading', { name: 'Shibori Folding' })).toBeInTheDocument();

        // Check if all child components are rendered
        expect(screen.getByTestId('mock-fold-controls')).toBeInTheDocument();
        expect(screen.queryByTestId('mock-dimension-controls')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Canvas size' })).toBeInTheDocument();
        expect(screen.getByTestId('mock-canvas-display')).toBeInTheDocument();
        expect(screen.getByTestId('mock-tool-controls')).toBeInTheDocument();
    });

    test('organizes secondary settings in collapsible inspector sections', () => {
        renderWithRedux(<ShiboriCanvas />);

        expect(screen.getByRole('button', { name: 'Folds' })).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('button', { name: 'Canvas size' })).toHaveAttribute('aria-expanded', 'false');
        expect(screen.getByRole('button', { name: 'Share' })).toHaveAttribute('aria-expanded', 'false');

        fireEvent.click(screen.getByRole('button', { name: 'Canvas size' }));
        expect(screen.getByTestId('mock-dimension-controls')).toBeInTheDocument();
    });
});
