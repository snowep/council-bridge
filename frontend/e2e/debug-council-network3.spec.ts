import { test, expect } from '@playwright/test';

test('debug council page check network full', async ({ page }) => {
  test.setTimeout(180000);

  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  await page.fill('input[name="owner_type"]', 'Founder');
  await page.fill('input[name="owner_id"]', 'Founder');
  await page.fill('input[name="runtime"]', 'Claude Code');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  console.log('=== Council Page Network ===');

  const apiCalls: string[] = [];
  page.on('response', response => {
    const url = response.url();
    if (url.includes('/api/')) {
      apiCalls.push(`${response.status()} ${url}`);
    }
  });

  await page.goto('http://localhost:5173/council');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(30000);

  console.log('All API calls:', apiCalls);

  // Check for loading indicators
  const loading = await page.locator('.MuiCircularProgress-root').count();
  console.log('Loading indicators:', loading);

  // Check for alerts
  const alerts = await page.locator('.MuiAlert-root').all();
  for (const alert of alerts) {
    const text = await alert.textContent();
    console.log('Alert:', text);
  }

  // Check for error typography
  const errorTypos = await page.locator('Typography[color="error"]').all();
  for (const typo of errorTypos) {
    const text = await typo.textContent();
    console.log('Error Typography:', text);
  }

  // Get full page HTML
  const html = await page.content();
  console.log('Page HTML length:', html.length);
});