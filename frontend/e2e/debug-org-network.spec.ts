import { test, expect } from '@playwright/test';

test('debug organization page network', async ({ page }) => {
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

  const failedRequests: string[] = [];
  page.on('response', response => {
    if (response.status() >= 400) {
      failedRequests.push(`${response.status()} ${response.url()}`);
    }
  });

  console.log('=== Organization Page ===');
  await page.goto('http://localhost:5173/organization');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(10000);

  console.log('Failed requests:', failedRequests);

  // Check for loading indicators
  const loading = await page.locator('.MuiCircularProgress-root').count();
  console.log('Loading indicators:', loading);

  // Check for alert/error
  const alerts = await page.locator('.MuiAlert-root').all();
  for (const alert of alerts) {
    const text = await alert.textContent();
    console.log('Alert:', text);
  }

  // Check for typography
  const typos = await page.locator('.MuiTypography-root').all();
  for (const typo of typos) {
    const text = await typo.textContent();
    if (text && text.trim().length > 0 && text.trim().length < 100) {
      console.log('Typography:', text.trim());
    }
  }
});