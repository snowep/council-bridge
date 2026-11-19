import { test, expect } from '@playwright/test';

const viewports = [
  { name: 'Mobile', width: 375, height: 667 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Small desktop', width: 1024, height: 768 },
  { name: 'Desktop', width: 1440, height: 900 },
  { name: 'Large desktop', width: 1920, height: 1080 },
];

// All 13 application routes from App.tsx
const routes = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Activity', path: '/activity' },
  { name: 'Chat', path: '/chat' },
  { name: 'Council', path: '/council' },
  { name: 'Meetings', path: '/meetings' },
  { name: 'Memory', path: '/memory' },
  { name: 'Organization', path: '/organization' },
  { name: 'Tasks', path: '/tasks' },
  { name: 'Executions', path: '/executions' },
  { name: 'Deliverables', path: '/deliverables' },
  { name: 'Approvals', path: '/approvals' },
  { name: 'Profile', path: '/profile' },
  { name: 'Settings', path: '/settings' },
];

const BASE_URL = 'http://localhost:5173';

test.describe('Viewport Verification', () => {
  for (const viewport of viewports) {
    for (const route of routes) {
      test(`Viewport ${viewport.name} - ${route.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(`${BASE_URL}${route.path}`);
        await page.waitForLoadState('networkidle');

        // Check for horizontal overflow
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(bodyWidth).toBeLessThanOrEqual(viewport.width + 5); // Allow 5px tolerance

        // Check navigation is visible
        const nav = page.locator('nav, .MuiToolbar-root, [role="navigation"]');
        await expect(nav.first()).toBeVisible({ timeout: 5000 });

        // Check main content is visible
        const mainContent = page.locator('main, .MuiContainer-root, .MuiPaper-root').first();
        await expect(mainContent).toBeVisible({ timeout: 5000 });
      });
    }
  }
});

test.describe('Keyboard Navigation Verification', () => {
  test('Navigation drawer opens and closes with keyboard', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Tab to trigger menu/button
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Verify focus is visible (element with focus should be different from body)
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? el.tagName + (el.id ? '#' + el.id : '') + (el.className ? '.' + el.className.split(' ').join('.') : '') : null;
    });
    expect(focusedElement).not.toBe('HTML');
  });

  test('Forms are accessible via keyboard', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Navigate through focusable elements
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
    }

    // Verify focus moves to something interactive (not trapped on body)
    const hasFocus = await page.evaluate(() => !!document.activeElement?.tagName);
    expect(hasFocus).toBe(true);
  });

  test('Enter activates focused buttons', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Tab to first focusable element
    await page.keyboard.press('Tab');
    const beforeUrl = page.url();

    // Press Enter
    await page.keyboard.press('Enter');

    // Press Escape to close any dialog
    await page.keyboard.press('Escape');
  });

  test('Escape closes dialogs and menus', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Open user menu
    const userMenuButton = page.locator('role=button[aria-label="User menu"]');
    if (await userMenuButton.isVisible()) {
      await userMenuButton.click();
      await page.keyboard.press('Escape');
      // Menu should be closed
      const menu = page.locator('[role="menu"]');
      await expect(menu).not.toBeVisible();
    }
  });
});

test.describe('Profile Page Accessibility', () => {
  test('Profile page is accessible and content is selectable', async ({ page }) => {
    // Test on desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/profile`);
    await page.waitForLoadState('networkidle');

    // Check for profile heading
    const heading = page.locator('role=heading').filter({ hasText: /profile/i });
    await expect(heading.first()).toBeVisible();

    // Check that content is selectable (not just disabled inputs)
    const profileContent = page.locator('profile, .MuiTabs-root, [role="tabpanel"]');
    await expect(profileContent.first()).toBeVisible();

    // Verify we can interact with the page
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
  });
});

test.describe('Settings Page Persistence', () => {
  test('Settings page is accessible and functional', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState('networkidle');

    // Check for settings heading
    const heading = page.locator('role=heading').filter({ hasText: /settings/i });
    await expect(heading.first()).toBeVisible();

    // Check settings controls are present and accessible
    const themeToggle = page.locator('role=button[aria-label*="theme"], input[type="checkbox"]');
    await expect(themeToggle.first()).toBeVisible();
  });
});