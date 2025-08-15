# CLAUDE.md - Shibori React Drawing App

## Project Overview
This is a React-based digital shibori (Japanese tie-dye) drawing application that allows users to draw on a folded canvas and see the symmetric patterns created on an unfolded canvas. The app includes shareable links functionality to save and restore drawing sessions.

## Tech Stack
- **Framework**: React 19 with TypeScript  
- **State Management**: Redux Toolkit with custom reducer
- **Canvas Drawing**: HTML5 Canvas with perfect-freehand library
- **Build Tool**: Vite
- **Testing**: Jest (unit) + Playwright (E2E)
- **Styling**: CSS with CSS-in-JS support

## Key Commands
```bash
# Development
npm run dev              # Start dev server (http://localhost:5173)
npm run build           # Build for production
npm run preview         # Preview production build

# Testing  
npm test               # Run Jest unit tests
npm run test:watch     # Run Jest in watch mode
npm run test:e2e       # Run Playwright E2E tests
npm run test:e2e:ui    # Run Playwright with UI

# Code Quality
npm run lint           # ESLint checking  
npm run build          # TypeScript build checking (IMPORTANT: Always run after changes)

# Playwright E2E Test Commands (IMPORTANT: Use these for /tests directory)
npm run test:e2e                    # Run all E2E tests
npm run test:e2e tests/basic.spec.ts  # Run specific test file
npm run test:e2e -- --grep "test name"  # Run specific test by name
npm run test:e2e:ui                 # Run with Playwright UI
npm run test:e2e -- --timeout 60000 # Run with custom timeout
```

## Architecture

### State Management (`src/store/`)
- **Redux store** with single `shibori` slice
- **Custom reducer** in `shiboriCanvasState.ts` handles all drawing state
- **Key state properties**:
  - `history`: Array of drawing operations for undo/replay
  - `folds`: Folding configuration (vertical/horizontal/diagonal) 
  - `currentTool`: Drawing tool (paintbrush/line)
  - `canvasDimensions`: Canvas size settings
  - `redrawTrigger`: Used to trigger canvas redraws from URL state

### Drawing System (`src/drawingModes/`)
- **Factory pattern** for drawing tools (`DrawingModeFactory.ts`)
- **Drawing modes**: PaintbrushMode, LineMode, CircleMode
- **History tracking**: Each drawing operation stored as `UndoableHistoryItem`
- **Canvas mirroring**: Folded canvas automatically mirrors to unfolded canvas

### Canvas Management (`src/hooks/useCanvas.ts`)
- **Custom hook** manages both folded and unfolded canvases
- **Key functions**:
  - `drawFromHistory()`: Replays drawing operations (critical for URL sharing)
  - `resetCanvases()`: Clears canvases and redraws fold lines
  - `updateUnfoldedCanvas()`: Creates mirrored symmetric pattern
  - `undo()`: Removes last operation and redraws

### Component Structure (`src/components/`)
- **ShiboriCanvas**: Main app container
- **CanvasDisplay**: Renders both canvases and handles interactions
- **Controls**: FoldControls, ToolControls, DimensionControls
- **ShareControls**: Generates and manages shareable links

## Shareable Links Implementation

### URL Serialization (`src/utils/urlStateUtils.ts`)
- **Encodes state** to base64 URL parameters
- **Validates and decodes** URL parameters back to app state
- **Handles errors** gracefully with fallback to default state
- **State structure**:
  ```typescript
  interface SerializableState {
    history: UndoableHistoryItem[];
    folds: FoldState;
    canvasDimensions: { width: number; height: number };
    circleRadius: number;
    lineThickness: number;
    currentTool: DrawingTool;
  }
  ```

### Redux Actions for URL Loading
- `LOAD_STATE_FROM_URL`: Restores shared state and increments `redrawTrigger`
- `REDRAW_FROM_HISTORY`: Triggers canvas redraw without state change

### URL Loading Flow
1. **App.tsx** checks for `?shared=` parameter on load
2. **Decodes** base64 parameter to state object  
3. **Dispatches** `LOAD_STATE_FROM_URL` action
4. **CanvasDisplay** detects `redrawTrigger` change
5. **Calls** `resetCanvases()` → `drawFromHistory()` → `updateUnfoldedCanvas()`
6. **Cleans** URL parameter after successful load

## Testing Setup

### Jest Unit Tests (`src/__tests__/`)
- **Component testing** with React Testing Library
- **Mock useCanvas hook** for isolated testing
- **Redux integration** via `testUtils.tsx`

### Playwright E2E Tests (`tests/`)
- **Canvas interaction testing** using `dragTo()` method
- **Pixel-level verification** to confirm actual drawing occurs  
- **Visual regression** capabilities with screenshots
- **Key learnings**:
  - ❌ Manual `page.mouse` events don't trigger React canvas handlers
  - ✅ `locator.dragTo()` properly fires synthetic events
  - ✅ Pixel data comparison confirms drawing worked

#### Canvas Drawing Test Pattern
```typescript
// Correct way to test canvas drawing
await foldedCanvas.dragTo(foldedCanvas, {
  sourcePosition: { x: centerX - 30, y: centerY - 30 },
  targetPosition: { x: centerX + 30, y: centerY + 30 }
});

// Verify with pixel data
const whitePixelCount = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  // Count white pixels (drawing color)
});
```

## Known Issues

### Shareable Links - History Clearing Fixed ✅
- **Original Problem**: When visiting shared URLs, canvas remained blank
- **Root cause**: `CanvasDisplay` component was clearing history immediately after URL loading
- **Solution**: Added `urlLoadTracker` global flag and `isLoadingFromUrl` state to prevent history clearing during URL loads
- **Status**: ✅ History preservation is working - Redux state shows `historyLength: 1` after URL load

### Remaining Issue: Canvas Rendering 
- **Problem**: History is preserved and drawing functions execute, but canvas shows 0 white pixels
- **Evidence**: Console shows `drawFromHistory`, `updateUnfoldedCanvasUnthrottled`, `flipHorizontal/Vertical` are called
- **Investigation needed**: 
  - Canvas context or rendering timing issues
  - Coordinate transformation problems during redraw
  - Canvas clearing happening after drawing operations

### Debugging Tools
- **Playwright screenshots**: Visual verification of rendering
- **Console logging**: Added throughout URL loading flow
- **Redux DevTools**: Monitor state changes
- **Browser DevTools**: Check canvas pixel data manually

## Development Notes

### Canvas Coordinate System
- **Folded canvas**: Smaller dimensions based on fold count
- **Unfolded canvas**: Full size shows mirrored pattern
- **Coordinate mapping**: Drawing coordinates must account for canvas scaling

### Drawing History Format
```typescript
interface UndoableHistoryItem {
  action: DrawingTool;        // 'paintbrush' | 'line'
  points: Point[];           // All mouse/touch points
}
```

### CSS Architecture
- **Component-scoped CSS** files
- **Responsive design** for canvas layouts
- **Control panel** with collapsible sections

## Future Enhancements
- **Visual regression testing** with image comparison
- **Touch device support** testing
- **Performance optimization** for large drawing histories
- **Export functionality** testing (download button verification)
- **Cross-browser compatibility** testing

## Dependencies of Note
- **perfect-freehand**: Smooth brush stroke rendering
- **lodash-es**: Utility functions (debounce for canvas updates)
- **@reduxjs/toolkit**: Modern Redux implementation
- **@playwright/test**: E2E testing framework

## Important File Locations
- **Main app**: `src/App.tsx` (handles URL parameter detection)
- **Canvas logic**: `src/hooks/useCanvas.ts` (core drawing functionality)  
- **State management**: `src/store/shiboriCanvasState.ts` (Redux state/actions)
- **URL utilities**: `src/utils/urlStateUtils.ts` (sharing functionality)
- **E2E tests**: `tests/basic.spec.ts` (canvas interaction tests)
- **Configuration**: `playwright.config.ts`, `vite.config.ts`, `tsconfig.json`