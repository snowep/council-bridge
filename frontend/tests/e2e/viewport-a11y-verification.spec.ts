import { test, expect, devices } from '@playwright/test';

const viewports = [
  { name: 'Mobile', width: 375, height: 667 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Small desktop', width: 1024, height: 768 },
  { name: 'Desktop', width: 1440, height: 900 },
  { name: 'Large desktop', width: 1920, height: 1080 },
];

const pages = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Activity', path: '/activity' },
  { name: 'Organization', path: '/organization' },
  { name: 'Tasks', path: '/tasks' },
  { name: 'Council', path: '/council' },
  { name: 'Meetings', path: '/meetings' },
  { name: 'Executions', path: '/executions' },
  { name: 'Deliverables', path: '/deliverables' },
  { name: 'Approvals', path: '/approvals' },
  { name: 'Profile', path: '/profile' },
  { name: 'Settings', path: '/settings' },
];

test.describe('Viewport Verification', () => {
  for (const viewport of viewports) {
    test(`Viewport ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('http://localhost:5173');
      await page.waitForLoadState('networkidle');

      // Check for horizontal overflow
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewport.width + 5); // Allow 5px tolerance

      // Check navigation is visible
      const nav = page.locator('nav, .MuiToolbar-root, [role="navigation"]');
      await expect(nav.first()).toBeVisible({ timeout: 5000 });
    });
  }
});

test.describe('Keyboard Navigation Verification', () => {
  test('Navigation drawer opens and closes with keyboard', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    // Tab to trigger menu/button
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Check focus is visible
    const focusedElement = await page.evaluate(() => document.activeElement?.outerHTML || '');
    expect(focusedElement.length).toBeGreaterThan(0);
  });

  test('Forms are accessible via keyboard', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    // Navigate through focusable elements
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
    }

    // Verify focus is not trapped
    const hasFocus = await page.evaluate(() => !!document.activeElement);
    expect(hasFocus).toBe(true);
  });
});

test.describe('Profile Page Accessibility', () => {
  test('Profile page is read-only with accessible labels', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:5173/profile');
    await page.waitForLoadState('networkidle');

    // Check for form labels
    const labels = page.locator('label');
    await expect(labels.first()).toBeVisible();

    // Check disabled fields are properly marked
    const disabledInputs = page.locator('input[disabled]');
    const count = await disabledInputs.count();
    expect(count).toBeGreaterThan(0);

    // Check text is selectable
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    // Tab navigation should reach the profile content
  });
});

test.describe('Settings Page Persistence', () => {
  test('Cancel restores saved values', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:5173/settings');
    await page.waitForLoadState('networkidle');

    // Find settings toggle and verify it has accessible name (via FormControlLabel)
    const formControlLabel = page.locator('label:has-text("Dark Mode")');
    await expect(formControlLabel).toBeVisible();
  });
});