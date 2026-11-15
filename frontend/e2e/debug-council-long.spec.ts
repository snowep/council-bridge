import { test, expect } from '@playwright/test';

test('debug council page wait longer', async ({ page }) => {
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

  console.log('=== Council Page ===');
  await page.goto('http://localhost:5173/council');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(30000);

  const failedRequests: string[] = [];
  page.on('response', response => {
    if (response.status() >= 400) {
      failedRequests.push(`${response.status()} ${response.url()}`);
    }
  });

  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  await page.waitForTimeout(10000);
  console.log('Failed requests:', failedRequests);
  console.log('Console errors:', errors);

  // Check for loading indicators
  const loading = await page.locator('.MuiCircularProgress-root').count();
  console.log('Loading indicators:', loading);

  // Check for typography
  const typos = await page.locator('.MuiTypography-root').all();
  for (const typo of typos) {
    const text = await typo.textContent();
    if (text && text.trim().length > 0 && text.trim().length < 200) {
      console.log('Typography:', text.trim());
    }
  }

  // Check for tabs
  const tabs = await page.locator('.MuiTabs-root').count();
  console.log('Tabs found:', tabs);

  if (tabs > 0) {
    const tabLabels = await page.locator('.MuiTab-root').all();
    for (const tab of tabLabels) {
      const text = await tab.textContent();
      console.log('Tab:', text);
    }
  }
});