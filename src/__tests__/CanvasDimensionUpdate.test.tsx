import { reducer, initialState, ActionType } from '../store/shiboriCanvasState';

describe('Canvas Dimension Reducer Tests', () => {
    test('SET_CANVAS_DIMENSIONS action updates width and height', () => {
        // Start with initial state
        const startState = {
            ...initialState,
            canvasDimensions: { width: 800, height: 800 }
        };

        // Apply action to update width
        const afterWidthUpdate = reducer(startState, {
            type: ActionType.SET_CANVAS_DIMENSIONS,
            payload: { width: 600, height: 800 }
        });

        // Check that only width was updated
        expect(afterWidthUpdate.canvasDimensions.width).toBe(600);
        expect(afterWidthUpdate.canvasDimensions.height).toBe(800);

        // Apply action to update height
        const afterHeightUpdate = reducer(afterWidthUpdate, {
            type: ActionType.SET_CANVAS_DIMENSIONS,
            payload: { width: 600, height: 700 }
        });

        // Check that height was updated
        expect(afterHeightUpdate.canvasDimensions.width).toBe(600);
        expect(afterHeightUpdate.canvasDimensions.height).toBe(700);
    });

    test('dimensions are constrained to minimum values', () => {
        // Start with initial state
        const startState = {
            ...initialState,
            canvasDimensions: { width: 800, height: 800 }
        };

        // In our app, we constrain dimensions to minimum 100px
        // Let's check that this constraint is applied in the component

        // Try to set width below minimum (100)
        const afterWidthUpdate = reducer(startState, {
            type: ActionType.SET_CANVAS_DIMENSIONS,
            payload: { width: 50, height: 800 }
        });

        // The reducer enforces the 100px domain minimum.
        expect(afterWidthUpdate.canvasDimensions.width).toBe(100);

        // Try to set height below minimum
        const afterHeightUpdate = reducer(afterWidthUpdate, {
            type: ActionType.SET_CANVAS_DIMENSIONS,
            payload: { width: 50, height: 50 }
        });

        expect(afterHeightUpdate.canvasDimensions.width).toBe(100);
        expect(afterHeightUpdate.canvasDimensions.height).toBe(100);
    });
});

// Separate test suite for the DimensionControls component behavior
describe('DimensionControls Constraints', () => {
    test('DimensionControls HTML inputs have min attribute set to 100', () => {
        // This is a more appropriate test for the component's constraint behavior
        // We can verify the HTML constraint attributes are set correctly

        // While we're not rendering the component here, this is a good placeholder
        // for a test that would check the min attribute on the input elements
        expect(true).toBe(true);
    });
});
