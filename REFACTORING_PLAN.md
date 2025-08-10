# Shibori React Architecture Refactoring Plan

## Overview
This document tracks the progress of refactoring the Shibori React drawing app to improve debuggability, maintainability, and code organization.

## Current Architecture Issues

### 1. Monolithic useCanvas Hook (721 lines)
- Mixed responsibilities: canvas management, event handling, state management, drawing operations
- Hard to test individual functions
- Complex dependencies make debugging difficult
- Single point of failure for all canvas operations

### 2. Problematic Global State Management
- Global `urlLoadTracker` in App.tsx creating hidden dependencies
- Complex Redux state with mixed concerns (transient vs persistent)
- Unclear state flow between components

### 3. Canvas Rendering Complexity
- Complex mirroring logic buried in useCanvas
- Hard to debug drawing operations
- No separation between canvas operations and business logic

### 4. Poor Error Handling & Debugging
- Scattered console.log statements
- No centralized error handling
- Difficult to trace canvas rendering issues

## Refactoring Progress

### Phase 1: Setup & Canvas Service Layer ✅
- [x] **E2E Baseline Tests** - All 5 tests passing ✅
- [x] **Create REFACTORING_PLAN.md** - This document ✅  
- [x] **Create src/utils/logger.ts** - Centralized logging utility ✅
- [x] **Extract CanvasService** - Move canvas operations to service layer ✅
- [x] **E2E Test After CanvasService** - Ensure functionality preserved ✅

### Phase 2: Split useCanvas Hook (Planned)
- [ ] `src/hooks/useCanvasRefs.ts` - Canvas reference management
- [ ] `src/hooks/useCanvasEvents.ts` - Mouse/touch event handling  
- [ ] `src/hooks/useCanvasDrawing.ts` - Drawing operations
- [ ] `src/hooks/useCanvasHistory.ts` - History management
- [ ] Update main `useCanvas.ts` to orchestrate these hooks
- [ ] **E2E tests after each extraction**

### Phase 3: State Management Cleanup (Planned)
- [ ] Split Redux state into logical slices
- [ ] Remove global `urlLoadTracker`
- [ ] Add proper state validation
- [ ] Create canvas state machine for predictable transitions
- [ ] **Test state persistence and URL sharing**

### Phase 4: Component Responsibility Separation (Planned)
- [ ] Split `CanvasDisplay.tsx` into focused components
- [ ] Extract URL loading logic to dedicated service
- [ ] Make components more testable
- [ ] **Final comprehensive E2E test run**

## Testing Strategy
- Run `npm run test:e2e` after each major refactoring step
- Focus on critical paths: drawing, undo, URL sharing
- Use `npm run test:e2e:ui` for debugging test failures
- Ensure pixel-level canvas verification continues to work

## Key Files Modified
- `REFACTORING_PLAN.md` - This tracking document
- `src/utils/logger.ts` - New centralized logging utility ✅
- `src/services/CanvasService.ts` - New canvas operations service layer ✅  
- `src/hooks/useCanvas.ts` - Refactored to use CanvasService ✅

## Test Results Log
- **Baseline**: 2024-08-10 - All 5 E2E tests passing ✅
  - Drawing functionality working (3115 white pixels detected)
  - Canvas mirroring working (folded → unfolded mirroring verified)
  - All basic interactions functional

- **After Phase 1**: 2024-08-10 - All 5 E2E tests passing ✅
  - Drawing functionality preserved (3115 white pixels detected)
  - Canvas mirroring still working (folded → unfolded mirroring verified)
  - CanvasService extraction successful - no regressions detected
  - Centralized logging implemented and working

## Phase 1 Summary
Successfully extracted all canvas operations into a dedicated service layer while preserving all functionality. The monolithic useCanvas hook has been significantly simplified by delegating canvas operations to the CanvasService. Centralized logging is now in place to improve debugging capabilities.