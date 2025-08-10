import { useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'
import ShiboriCanvas from './components/ShiboriCanvas'
import { getSharedStateFromCurrentUrl, clearSharedParamFromUrl } from './utils/urlStateUtils'
import { ActionType } from './store/shiboriCanvasState'
import './App.css'

// Global flag to track if we just loaded from URL (to prevent history clearing)
export const urlLoadTracker = { justLoaded: false };

function App() {
  const dispatch = useDispatch()
  const hasProcessedUrl = useRef(false)

  useEffect(() => {
    // Only process URL once to avoid clearing state on re-renders
    if (hasProcessedUrl.current) {
      console.log('App.tsx - URL already processed, skipping')
      return
    }

    // Check for shared state in URL when app loads
    const sharedState = getSharedStateFromCurrentUrl()
    
    console.log('App.tsx - getSharedStateFromCurrentUrl result:', sharedState)
    
    if (sharedState) {
      console.log('App.tsx - dispatching LOAD_STATE_FROM_URL with history length:', sharedState.history?.length)
      
      // Set flag to prevent history clearing during the next few renders
      urlLoadTracker.justLoaded = true;
      
      // Load the shared state into Redux
      dispatch({ type: ActionType.LOAD_STATE_FROM_URL, payload: sharedState })
      
      // Clean up URL to remove the shared parameter
      // clearSharedParamFromUrl()
      
      // Clear the flag after a brief delay to allow components to stabilize
      // setTimeout(() => {
      //   urlLoadTracker.justLoaded = false;
      // }, 1000);
    } else {
      console.log('App.tsx - no shared state found in URL')
    }

    // Mark as processed so we don't run this again
    hasProcessedUrl.current = true
  }, [dispatch])

  return (
    <div className="App">
      <ShiboriCanvas />
    </div>
  )
}

export default App
