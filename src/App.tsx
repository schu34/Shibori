import { useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'
import ShiboriCanvas from './components/ShiboriCanvas'
import { getSharedStateFromCurrentUrl, clearSharedParamFromUrl } from './utils/urlStateUtils'
import { ActionType } from './store/shiboriCanvasState'
import { logger } from './utils/logger'
import './App.css'

function App() {
  const dispatch = useDispatch()
  const hasProcessedUrl = useRef(false)

  useEffect(() => {
    // Only process URL once to avoid clearing state on re-renders
    if (hasProcessedUrl.current) {
      logger.url.load('URL already processed, skipping')
      return
    }

    // Check for shared state in URL when app loads
    const sharedState = getSharedStateFromCurrentUrl()
    
    logger.url.load('Checking for shared state in URL', { found: !!sharedState })
    
    if (sharedState) {
      logger.url.load('Loading shared state from URL', { 
        historyLength: sharedState.history?.length || 0,
        folds: sharedState.folds,
        tool: sharedState.currentTool 
      })
      
      // Load the shared state into Redux (this sets isLoadingFromUrl: true)
      dispatch({ type: ActionType.LOAD_STATE_FROM_URL, payload: sharedState })
      
      // Clean up URL to remove the shared parameter after a brief delay
      setTimeout(() => {
        clearSharedParamFromUrl()
        logger.url.load('Cleaned up URL parameter')
      }, 500);
    } else {
      logger.url.load('No shared state found in URL')
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
