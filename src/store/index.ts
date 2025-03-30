import { configureStore } from '@reduxjs/toolkit';
import { State, reducer, initialState, Action } from './shiboriCanvasState';

// Create a Redux slice
import { createSlice } from '@reduxjs/toolkit';

// Create a slice for our shibori canvas state
const shiboriSlice = createSlice({
    name: 'shibori',
    initialState,
    // Convert our existing reducer to Redux Toolkit's reducer format
    reducers: {},
    // Use the existing reducer function via extraReducers
    extraReducers: (builder) => {
        builder.addDefaultCase((state, action) => {
            // Call our existing reducer
            return reducer(state as State, action as Action);
        });
    },
});

// Create the store
export const store = configureStore({
    reducer: {
        shibori: shiboriSlice.reducer,
    },
});

// Define types for RootState and AppDispatch
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Export the slice
export const shiboriActions = shiboriSlice.actions; 