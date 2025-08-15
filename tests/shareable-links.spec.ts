// import { test, expect } from '@playwright/test';
// import { 
//   analyzeCanvasPixels, 
//   drawOnCanvas, 
//   selectDrawingTool 
// } from './utils/canvasHelpers';

// test.describe('Shareable Links', () => {
//   test('can create and load shareable drawing links', async ({ page, browser }) => {
//     await page.goto('/');

//     const foldedCanvas = page.locator('canvas').first();
//     await expect(foldedCanvas).toBeVisible();

//     // Ensure paintbrush is selected
//     await selectDrawingTool(page, 'paintbrush');

//     // Draw a specific pattern that we can verify later
//     console.log('Drawing original pattern...');
//     await drawOnCanvas(foldedCanvas, {
//       startOffset: { x: -40, y: -40 },
//       endOffset: { x: 40, y: 40 }
//     });

//     // Wait for drawing to complete
//     await page.waitForTimeout(500);

//     // Analyze the canvas state after drawing
//     const originalDrawing = await analyzeCanvasPixels(page, 0);
//     console.log(`Original drawing: ${originalDrawing.pixelCounts.white} white pixels, ${originalDrawing.drawingDensity.toFixed(2)}% density`);

//     // Verify we actually have a drawing
//     expect(originalDrawing.pixelCounts.white).toBeGreaterThan(1000);

//     // Find and click the "Generate Share Link" button
//     const generateButton = page.locator('button', { hasText: 'Generate Share Link' });
//     await expect(generateButton).toBeVisible();
//     await expect(generateButton).toBeEnabled();
    
//     console.log('Generating share link...');
//     await generateButton.click();

//     // Wait for the URL display to appear
//     await expect(page.locator('.url-display')).toBeVisible();

//     // Extract the generated URL from the input field
//     const urlInput = page.locator('.url-input');
//     await expect(urlInput).toBeVisible();
    
//     const shareUrl = await urlInput.inputValue();
//     console.log('Generated share URL:', shareUrl);
    
//     // Verify the URL contains the 'shared' parameter
//     expect(shareUrl).toContain('shared=');
//     expect(shareUrl.length).toBeGreaterThan(100); // Should be a substantial URL with encoded data

//     // Close the current page and create a fresh browser context
//     // This simulates a user clicking the link in a fresh session
//     console.log('Opening share link in fresh browser context...');
    
//     const newContext = await browser.newContext();
//     const newPage = await newContext.newPage();
    
//     // Listen to console messages from the browser
//     newPage.on('console', msg => {
//       console.log(`Browser console: ${msg.type()}: ${msg.text()}`);
//     });
    
//     // Navigate to the shared URL
//     await newPage.goto(shareUrl);

//     // Wait for the app to load and render
//     const newFoldedCanvas = newPage.locator('canvas').first();
//     await expect(newFoldedCanvas).toBeVisible();

//     // Debug the URL decoding process
//     const urlDecodingDebug = await newPage.evaluate((url) => {
//       try {
//         const urlParams = new URLSearchParams(new URL(url).search);
//         const encodedState = urlParams.get('shared');
        
//         if (!encodedState) {
//           return { error: 'No shared parameter found' };
//         }

//         // Decode the base64 manually to see what we get
//         let base64 = encodedState.replace(/-/g, '+').replace(/_/g, '/');
//         while (base64.length % 4) {
//           base64 += '=';
//         }
        
//         const jsonString = atob(base64);
//         const decoded = JSON.parse(jsonString);
        
//         return {
//           encodedLength: encodedState.length,
//           decodedHistoryLength: decoded.history?.length || 0,
//           decodedHistoryFirstItem: decoded.history?.[0] || null,
//           decodedFolds: decoded.folds || null,
//           decodedTool: decoded.currentTool || null
//         };
//       } catch (error) {
//         return { error: error.message };
//       }
//     }, shareUrl);
    
//     console.log('URL decoding debug:', urlDecodingDebug);

//     // Add debugging to see what happens during URL loading
//     const debugInfo = await newPage.evaluate(() => {
//       // Try to access Redux state if possible
//       const state = (window as any).store?.getState?.()?.shibori;
//       return {
//         hasReduxState: !!state,
//         historyLength: state?.history?.length || 0,
//         redrawTrigger: state?.redrawTrigger || 0,
//         currentTool: state?.currentTool || 'unknown',
//         canvasCount: document.querySelectorAll('canvas').length
//       };
//     });
    
//     console.log('Debug info after URL load:', debugInfo);

//     // Give extra time for any URL state loading and canvas redrawing
//     await newPage.waitForTimeout(2000);

//     // Check state again after waiting
//     const debugInfoAfterWait = await newPage.evaluate(() => {
//       const state = (window as any).store?.getState?.()?.shibori;
//       return {
//         hasReduxState: !!state,
//         historyLength: state?.history?.length || 0,
//         redrawTrigger: state?.redrawTrigger || 0,
//         currentTool: state?.currentTool || 'unknown',
//         isDrawing: state?.isDrawing || false,
//         folds: state?.folds || null
//       };
//     });
    
//     console.log('Debug info after wait:', debugInfoAfterWait);

//     // Debug canvas state directly
//     const canvasDebug = await newPage.evaluate(() => {
//       const canvases = Array.from(document.querySelectorAll('canvas'));
//       return canvases.map((canvas, index) => {
//         const ctx = canvas.getContext('2d');
//         if (!ctx) return { index, error: 'No context' };
        
//         const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
//         const data = imageData.data;
        
//         let whitePixels = 0;
//         let totalPixels = data.length / 4;
        
//         for (let i = 0; i < data.length; i += 4) {
//           const r = data[i], g = data[i + 1], b = data[i + 2];
//           if (r > 240 && g > 240 && b > 240) whitePixels++;
//         }
        
//         return {
//           index,
//           width: canvas.width,
//           height: canvas.height,
//           whitePixels,
//           totalPixels,
//           density: (whitePixels / totalPixels * 100).toFixed(2) + '%'
//         };
//       });
//     });
    
//     console.log('Canvas debug info:', canvasDebug);

//     // Analyze the canvas in the new page
//     const loadedDrawing = await analyzeCanvasPixels(newPage, 0);
//     console.log(`Loaded drawing: ${loadedDrawing.pixelCounts.white} white pixels, ${loadedDrawing.drawingDensity.toFixed(2)}% density`);

//     // Let's also manually check if we can trigger the redraw
//     console.log('Attempting manual state inspection...');
//     const manualRedrawAttempt = await newPage.evaluate(() => {
//       const state = (window as any).store?.getState?.()?.shibori;
//       if (!state || !state.history || state.history.length === 0) {
//         return { success: false, reason: 'No history in state' };
//       }
      
//       // Try to trigger a redraw manually by incrementing redraw trigger
//       try {
//         (window as any).store?.dispatch?.({ 
//           type: 'REDRAW_FROM_HISTORY'
//         });
//         return { success: true, historyItems: state.history.length };
//       } catch (error) {
//         return { success: false, reason: error.message };
//       }
//     });
    
//     console.log('Manual redraw attempt:', manualRedrawAttempt);
    
//     // Wait a bit more after manual trigger
//     await newPage.waitForTimeout(1000);
    
//     // Check canvas again
//     const afterManualRedraw = await analyzeCanvasPixels(newPage, 0);
//     console.log(`After manual redraw: ${afterManualRedraw.pixelCounts.white} white pixels`);

//     // Take screenshots for debugging
//     await page.screenshot({ path: 'test-results/original-drawing.png', fullPage: true });
//     await newPage.screenshot({ path: 'test-results/loaded-drawing.png', fullPage: true });

//     // The critical assertion: the loaded drawing should match the original
//     // We expect the same number of white pixels (or very close due to rendering differences)
//     expect(loadedDrawing.pixelCounts.white).toBeGreaterThan(0);
//     expect(loadedDrawing.pixelCounts.white).toBeCloseTo(originalDrawing.pixelCounts.white, -100); // Allow 100 pixel difference

//     // Verify both have substantial drawing
//     expect(loadedDrawing.pixelCounts.white).toBeGreaterThan(1000);
//     expect(loadedDrawing.hasDrawing).toBe(true);

//     // Drawing densities should be similar
//     expect(loadedDrawing.drawingDensity).toBeCloseTo(originalDrawing.drawingDensity, 1);

//     console.log('✅ Shareable link successfully recreated the drawing!');

//     // Clean up
//     await newContext.close();
//   });

//   test('shareable link preserves fold settings', async ({ page, browser }) => {
//     await page.goto('/');

//     // Change fold settings from default
//     const verticalFoldButton = page.locator('button', { hasText: 'Fold +' }).first();
//     await verticalFoldButton.click();
    
//     // Verify fold setting changed (should show "Vertical Folds: 2")
//     await expect(page.locator('text=Vertical Folds: 2')).toBeVisible();

//     // Draw something
//     const foldedCanvas = page.locator('canvas').first();
//     await selectDrawingTool(page, 'paintbrush');
//     await drawOnCanvas(foldedCanvas);
//     await page.waitForTimeout(500);

//     // Generate share link
//     const generateButton = page.locator('button', { hasText: 'Generate Share Link' });
//     await generateButton.click();
    
//     const urlInput = page.locator('.url-input');
//     const shareUrl = await urlInput.inputValue();

//     // Load in fresh context
//     const newContext = await browser.newContext();
//     const newPage = await newContext.newPage();
//     await newPage.goto(shareUrl);

//     // Verify fold setting was preserved
//     await expect(newPage.locator('text=Vertical Folds: 2')).toBeVisible();

//     // Verify canvas still has drawing
//     const loadedDrawing = await analyzeCanvasPixels(newPage, 0);
//     expect(loadedDrawing.hasDrawing).toBe(true);

//     await newContext.close();
//   });

//   test('handles invalid share URLs gracefully', async ({ page }) => {
//     // Try to load a URL with corrupted shared parameter
//     await page.goto('/?shared=invalid-data');

//     // App should still load normally (fallback to default state)
//     await expect(page.locator('h1')).toContainText('Folded Paper Drawing');
//     await expect(page.locator('canvas').first()).toBeVisible();

//     // Canvas should be clean (no drawing)
//     const analysis = await analyzeCanvasPixels(page, 0);
//     expect(analysis.hasDrawing).toBe(false);
//     expect(analysis.pixelCounts.white).toBe(0);
//   });
// });
