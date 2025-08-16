# WebGL Migration Plan for Shibori React App

## Overview
Migrating the shibori drawing app from Canvas 2D API to WebGL for improved performance and GPU acceleration. This migration will maintain all existing functionality while enabling future advanced visual effects.

## Current Architecture Analysis
- **Canvas 2D API** with `perfect-freehand` library for smooth strokes
- **ImageData manipulation** for mirroring/folding effects in `src/utils/imageUtils.ts`
- **Two-canvas system** (folded + unfolded) managed by `src/hooks/useCanvas.ts`
- **Redux state management** for drawing history in `src/store/shiboriCanvasState.ts`
- **Real-time symmetric pattern generation** in `src/services/CanvasService.ts`

## Migration Strategy: Test-First Approach

### Phase 1: Setup Planning & Test Infrastructure ✅
- [x] Create `WEBGL_MIGRATION.md` planning document in repo root
- [x] Create abstract `CanvasTestAdapter` interface in `tests/utils/`
- [x] Implement `Canvas2DTestAdapter` wrapping existing test logic
- [x] Update `canvasHelpers.ts` to use adapter pattern
- [x] Verify all existing tests still pass with adapter layer
- [x] **Commit**: "Add canvas test adapter infrastructure"

### Phase 2: WebGL Test Compatibility
- [ ] Implement `WebGLTestAdapter` with `gl.readPixels()` support
- [ ] Add WebGL context detection and fallback logic
- [ ] Create dual-mode test runner for Canvas 2D vs WebGL comparison
- [ ] Add environment variables for forcing WebGL test mode
- [ ] Add Playwright WebGL browser configuration
- [ ] **Commit**: "Add WebGL test adapter and dual-mode testing"

### Phase 3: WebGL Core Infrastructure  
- [ ] Create WebGL utility classes (`WebGLRenderer`, `ShaderProgram`, `BufferManager`)
- [ ] Implement basic WebGL context setup and management
- [ ] Add WebGL capability detection with Canvas 2D fallback
- [ ] Create shader compilation and program linking utilities
- [ ] Add basic vertex and fragment shader templates
- [ ] **Commit**: "Add WebGL core infrastructure and utilities"

### Phase 4: Drawing System Migration
- [ ] Convert paintbrush drawing from Canvas 2D to WebGL shaders
- [ ] Migrate line drawing to WebGL vertex buffers
- [ ] Update circle drawing with WebGL rendering
- [ ] Replace `perfect-freehand` with WebGL-based stroke rendering
- [ ] Implement texture-based drawing state management
- [ ] **Commit**: "Migrate drawing tools to WebGL implementation"

### Phase 5: Mirroring/Folding with Shaders
- [ ] Convert `ImageUtils` flip operations to fragment shaders
- [ ] Implement real-time symmetric pattern generation in WebGL
- [ ] Replace `CanvasService.updateUnfoldedCanvas()` with shader-based mirroring
- [ ] Optimize texture management for fold operations
- [ ] Add diagonal fold shader implementations
- [ ] **Commit**: "Replace image manipulation with WebGL shaders"

### Phase 6: Integration & Cleanup
- [ ] Update React components to use WebGL renderer
- [ ] Ensure Redux state compatibility with WebGL
- [ ] Test download functionality with WebGL canvas
- [ ] Run full test suite and fix any regressions
- [ ] Update drawing mode factory for WebGL compatibility
- [ ] **Commit**: "Complete WebGL integration and testing"

### Phase 7: Performance & Polish
- [ ] Add performance benchmarking between Canvas 2D and WebGL
- [ ] Optimize shader compilation and buffer management
- [ ] Add error handling and graceful degradation
- [ ] Update documentation for WebGL implementation
- [ ] Add feature detection and progressive enhancement
- [ ] **Commit**: "Add performance optimizations and documentation"

## Key Files to Modify

### Core Canvas Management
- `src/hooks/useCanvas.ts` - Main canvas hook orchestration
- `src/hooks/useCanvasRefs.ts` - Canvas reference management
- `src/hooks/useCanvasDrawing.ts` - Drawing operations
- `src/services/CanvasService.ts` - Canvas utilities and operations

### Drawing System
- `src/drawingModes/PaintbrushMode.ts` - Brush stroke implementation
- `src/drawingModes/LineMode.ts` - Line drawing
- `src/drawingModes/CircleMode.ts` - Circle drawing
- `src/drawingModes/DrawingModeFactory.ts` - Tool factory

### Image Processing
- `src/utils/imageUtils.ts` - Image manipulation utilities

### Testing Infrastructure
- `tests/utils/canvasHelpers.ts` - Canvas testing utilities
- `tests/basic.spec.ts` - E2E canvas tests

## Technical Considerations

### WebGL Context Management
- Use `getContext("webgl2")` with fallback to `getContext("webgl")`
- Implement proper context loss handling
- Add resource cleanup for textures and buffers

### Shader Implementation Strategy
- **Vertex shaders**: Handle positioning and transformations
- **Fragment shaders**: Handle pixel-level operations (drawing, mirroring)
- **Texture management**: Replace ImageData with WebGL textures
- **Render-to-texture**: For intermediate drawing operations

### Performance Optimizations
- **Buffer pooling**: Reuse vertex buffers for drawing operations
- **Texture atlasing**: Combine small textures for efficiency
- **Batch rendering**: Group similar operations together
- **Shader compilation caching**: Cache compiled shaders

### Compatibility & Fallbacks
- **Feature detection**: Check WebGL support and capabilities
- **Graceful degradation**: Fall back to Canvas 2D if WebGL unavailable
- **Error handling**: Comprehensive WebGL error reporting
- **Cross-browser testing**: Ensure compatibility across browsers

## Testing Strategy

### Test Adapter Pattern
```typescript
interface CanvasTestAdapter {
  analyzePixels(canvas: HTMLCanvasElement): Promise<CanvasAnalysis>
  getPixelData(canvas: HTMLCanvasElement): Promise<Uint8Array>
  supportsWebGL(): boolean
}
```

### Dual-Mode Testing
- Run same tests against both Canvas 2D and WebGL implementations
- Compare pixel-level results for compatibility verification
- Performance benchmarking between implementations

### Visual Regression Testing
- Screenshot comparison between Canvas 2D and WebGL outputs
- Automated detection of rendering differences
- Reference image generation for both modes

## Risk Mitigation

### Rollback Strategy
- Maintain Canvas 2D implementation alongside WebGL
- Runtime feature flags for switching between implementations
- Easy rollback mechanism if critical issues arise

### Incremental Migration
- Implement one drawing tool at a time
- Maintain test coverage throughout migration
- Validate each phase before proceeding to next

### Performance Monitoring
- Benchmark rendering performance at each phase
- Monitor memory usage and GPU utilization
- Track frame rates and responsiveness

## Success Criteria

1. ✅ All existing tests pass with new WebGL implementation
2. ✅ Pixel-perfect compatibility with Canvas 2D output
3. ✅ No regression in drawing functionality or user experience
4. ✅ Improved performance metrics (FPS, memory, responsiveness)
5. ✅ Proper error handling and fallback mechanisms
6. ✅ Clean, maintainable code architecture
7. ✅ Comprehensive documentation and comments

## Notes and Roadblocks

*This section will be updated as we encounter challenges or need to adjust the plan*

---

**Last Updated**: 2025-08-16
**Status**: Phase 1 - Complete ✅
**Current Task**: Ready for Phase 2 - WebGL Test Compatibility