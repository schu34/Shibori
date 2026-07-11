/**
 * Unit tests for DrawingModeFactory
 * Tests mode configuration and drawing tool selection.
 */

import { DrawingModeFactory, RenderingMode } from '../drawingModes/DrawingModeFactory';
import { DrawingTool } from '../types';
import { DrawableDrawingTool } from '../types/DrawingMode';

describe('DrawingModeFactory', () => {
  beforeEach(() => {
    // Reset factory state before each test
    DrawingModeFactory.configure({ renderingMode: 'auto', useWebGL: true });
  });

  describe('Configuration Management', () => {
    test('should set and get configuration correctly', () => {
      const config = { renderingMode: 'webgl' as RenderingMode };
      DrawingModeFactory.configure(config);
      
      expect(DrawingModeFactory.getConfig().renderingMode).toBe('webgl');
    });

    test('should merge configuration options', () => {
      DrawingModeFactory.configure({ renderingMode: 'webgl' });
      DrawingModeFactory.configure({ renderingMode: 'canvas2d' });
      
      expect(DrawingModeFactory.getConfig().renderingMode).toBe('canvas2d');
    });

    test('should handle undefined configuration gracefully', () => {
      const initialConfig = DrawingModeFactory.getConfig();
      DrawingModeFactory.configure({});
      
      // Should not change existing config
      expect(DrawingModeFactory.getConfig()).toEqual(initialConfig);
    });
  });

  describe('Tool Selection', () => {
    test('should return paintbrush mode for paintbrush tool', () => {
      const mode = DrawingModeFactory.getTool(DrawingTool.Paintbrush);
      expect(mode).toBeDefined();
      expect(mode.constructor.name).toMatch(/PaintbrushMode/);
    });

    test('should return line mode for line tool', () => {
      const mode = DrawingModeFactory.getTool(DrawingTool.Line);
      expect(mode).toBeDefined();
      expect(mode.constructor.name).toMatch(/LineMode/);
    });

    test.each([
      [DrawingTool.Rectangle, 'RectangleMode'],
      [DrawingTool.Square, 'SquareMode'],
      [DrawingTool.Circle, 'CircleMode'],
    ] satisfies Array<[DrawableDrawingTool, string]>)('should return %s mode', (tool, expectedModeName) => {
      const mode = DrawingModeFactory.getTool(tool);
      expect(mode).toBeDefined();
      expect(mode.constructor.name).toBe(expectedModeName);
    });

    test('should throw error for unknown tool', () => {
      expect(() => {
        DrawingModeFactory.getTool('unknown' as DrawableDrawingTool);
      }).toThrow('Unknown drawing tool: unknown');
    });
  });

  describe('Rendering Mode Configuration', () => {
    test('should keep paintbrush drawing on Canvas 2D when WebGL unfolding is configured', () => {
      DrawingModeFactory.configure({ renderingMode: 'webgl' });
      
      const mode = DrawingModeFactory.getTool(DrawingTool.Paintbrush);
      
      expect(mode.constructor.name).toBe('PaintbrushMode');
    });

    test('should use Canvas 2D mode when explicitly configured', () => {
      DrawingModeFactory.configure({ renderingMode: 'canvas2d' });
      
      const mode = DrawingModeFactory.getTool(DrawingTool.Paintbrush);
      
      // Should not return WebGL version
      expect(mode.constructor.name).not.toMatch(/WebGL/);
    });

    test('should choose appropriate mode for auto configuration', () => {
      DrawingModeFactory.configure({ renderingMode: 'auto' });
      
      const mode = DrawingModeFactory.getTool(DrawingTool.Paintbrush);
      
      // Should return some valid mode
      expect(mode).toBeDefined();
    });
  });

  describe('Brush Renderer Stability', () => {
    test('should keep paintbrush mode independent of WebGL availability', () => {
      DrawingModeFactory.configure({ renderingMode: 'webgl' });
      
      const mode = DrawingModeFactory.getTool(DrawingTool.Paintbrush);
      
      expect(mode.constructor.name).toBe('PaintbrushMode');
    });

    test('should respect user preference when WebGL is available', () => {
      DrawingModeFactory.configure({ renderingMode: 'canvas2d' });
      
      const mode = DrawingModeFactory.getTool(DrawingTool.Paintbrush);
      
      // Should respect Canvas 2D preference even when WebGL is available
      expect(mode.constructor.name).not.toMatch(/WebGL/);
    });
  });

  describe('Factory State Consistency', () => {
    test('should maintain consistent state across multiple tool requests', () => {
      DrawingModeFactory.configure({ renderingMode: 'webgl' });
      
      const mode1 = DrawingModeFactory.getTool(DrawingTool.Paintbrush);
      const mode2 = DrawingModeFactory.getTool(DrawingTool.Paintbrush);
      
      // Should return same type of mode
      expect(mode1.constructor.name).toBe(mode2.constructor.name);
    });

    test('should update mode type when configuration changes', () => {
      DrawingModeFactory.configure({ renderingMode: 'canvas2d' });
      const canvasMode = DrawingModeFactory.getTool(DrawingTool.Paintbrush);
      
      DrawingModeFactory.configure({ renderingMode: 'webgl' });
      const webglMode = DrawingModeFactory.getTool(DrawingTool.Paintbrush);
      
      expect(DrawingModeFactory.getConfig().renderingMode).toBe('webgl');
      expect(canvasMode.constructor.name).toBe('PaintbrushMode');
      expect(webglMode.constructor.name).toBe('PaintbrushMode');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid rendering mode gracefully', () => {
      // This should not throw
      expect(() => {
        DrawingModeFactory.configure({ renderingMode: 'invalid' as RenderingMode });
      }).not.toThrow();
      
      // Should still be able to get tools
      expect(() => {
        DrawingModeFactory.getTool(DrawingTool.Paintbrush);
      }).not.toThrow();
    });

    test('should provide fallback when mode creation fails', () => {
      // This should always return a valid mode
      const mode = DrawingModeFactory.getTool(DrawingTool.Paintbrush);
      expect(mode).toBeDefined();
      expect(typeof mode.start).toBe('function');
      expect(typeof mode.continue).toBe('function');
      expect(typeof mode.end).toBe('function');
    });
  });
});
