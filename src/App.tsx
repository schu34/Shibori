import { useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'
import ShiboriCanvas from './components/ShiboriCanvas'
import { UrlLoadingService } from './services/UrlLoadingService'
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

    // Check for shared state parameter in URL when app loads
    const sharedParam = UrlLoadingService.getSharedParameterFromUrl(window.location)
    
    logger.url.load('Checking for shared state in URL', { found: !!sharedParam })
    
    if (sharedParam && UrlLoadingService.validateUrlParameter(sharedParam)) {
      logger.url.load('Loading shared state from URL via UrlLoadingService')
      
      // Load the shared state using the service
      UrlLoadingService.loadStateFromUrl(sharedParam, dispatch)
        .then(() => {
          logger.url.load('Successfully loaded state from URL')
          // Clean up URL parameter after successful loading
          setTimeout(() => {
            UrlLoadingService.cleanupUrlParameter(window.location)
            logger.url.load('URL cleanup completed')
          }, 500);
        })
        .catch((error) => {
          logger.error('Failed to load state from URL', error, {
            component: 'App'
          })
        });
    } else {
      if (sharedParam) {
        logger.url.load('Invalid shared parameter found, ignoring and using default state')
      } else {
        logger.url.load('No shared state found in URL')
      }
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
