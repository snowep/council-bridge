import { test, expect } from '@playwright/test';

test('debug organization page', async ({ page }) => {
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

  console.log('=== Organization Page ===');
  await page.goto('http://localhost:5173/organization');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(10000);

  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  await page.waitForTimeout(5000);
  console.log('Console errors:', errors);

  // Get full page content
  const content = await page.content();
  console.log('Page content (first 10000 chars):', content.substring(0, 10000));
});