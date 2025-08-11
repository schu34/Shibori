import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Listen for console messages
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  try {
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(5000);
    console.log('Page title:', await page.title());
  } catch (error) {
    console.log('Error:', error.message);
  }
  
  await browser.close();
})();