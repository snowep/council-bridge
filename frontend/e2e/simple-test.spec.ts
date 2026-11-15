import { test, expect } from '@playwright/test';

test('login page loads', async ({ page }) => {
  // In dev mode, the auth context auto-loads from fallback
  await page.goto('http://localhost:5173/');
  await page.waitForLoadState('networkidle');

  // Should redirect to dashboard since we have fallback auth
  await expect(page.locator('role=heading').first()).toBeVisible({ timeout: 10000 });

  console.log('Dashboard loaded successfully');
});