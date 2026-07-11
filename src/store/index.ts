import { configureStore } from '@reduxjs/toolkit';
import { reducer } from './shiboriCanvasState';
import type { State } from './shiboriCanvasState';

export interface PreloadedAppState {
    shibori: State;
}

/** Create an isolated app store while preserving the `state.shibori` API. */
export function createAppStore(preloadedState?: PreloadedAppState) {
    return configureStore({
        reducer: {
            shibori: reducer,
        },
        preloadedState,
    });
}

export const store = createAppStore();

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
