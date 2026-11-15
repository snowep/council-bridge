import { test, expect } from '@playwright/test';

test('debug login page', async ({ page }) => {
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);

  // Take screenshot
  await page.screenshot({ path: 'e2e-screenshots/debug-login.png', fullPage: true });

  // Print page content
  const content = await page.content();
  console.log('Page content:', content.substring(0, 5000));

  // Check for any select elements
  const selects = await page.locator('select').all();
  console.log('Number of select elements:', selects.length);

  for (const sel of selects) {
    const name = await sel.getAttribute('name');
    console.log('Select name:', name);
  }

  // Check for any input elements
  const inputs = await page.locator('input').all();
  console.log('Number of input elements:', inputs.length);

  for (const inp of inputs) {
    const type = await inp.getAttribute('type');
    const name = await inp.getAttribute('name');
    console.log('Input type:', type, 'name:', name);
  }
});