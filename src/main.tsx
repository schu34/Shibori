import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Provider } from 'react-redux'
import { store } from './store'
import { applyTestRenderingModeOverride } from './utils/renderingBackend'
import { bootstrapSharedState } from './services/bootstrapSharedState'

declare global {
  interface Window {
    store?: typeof store;
  }
}

applyTestRenderingModeOverride()
bootstrapSharedState(window.location, window.history, document.title, store.dispatch)

// Expose store to window for debugging (development only)
if (import.meta.env.MODE === 'development') {
  window.store = store;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
)
