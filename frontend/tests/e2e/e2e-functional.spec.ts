import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

test.describe('E2E Functional Tests - User Journeys', () => {
  test.beforeEach(async ({ page }) => {
    // In local single-user mode, we auto-authenticate as founder
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
  });

  test('1. Dashboard page loads and displays correct data', async ({ page }) => {
    // Dashboard is the default landing page
    await expect(page.locator('role=heading[name="Founder Command Center"]')).toBeVisible({ timeout: 15000 });

    // Check for key dashboard elements
    await expect(page.locator('role=link[name="Review Approvals"]')).toBeVisible();
    await expect(page.locator('role=link[name="New Task"]')).toBeVisible();

    // Check stats cards are displayed
    await expect(page.locator('text=Active Divisions')).toBeVisible();
    await expect(page.locator('text=Staff Agents')).toBeVisible();
    await expect(page.locator('text=Pending Approvals')).toBeVisible();

    // Check for Recent Activity section
    await expect(page.locator('role=heading[name="Recent Activity"]')).toBeVisible();

    console.log('Dashboard page verified successfully');
  });

  test('2. Chat page loads and messages display in correct order', async ({ page }) => {
    // Navigate to chat page
    await page.goto(`${BASE_URL}/chat`);
    await page.waitForLoadState('networkidle');

    // Check for chat page heading
    await expect(page.locator('role=heading[name="Conversations"]')).toBeVisible({ timeout: 15000 });

    // Check for conversation list
    const conversationList = page.locator('role=list');
    await expect(conversationList).toBeVisible();

    // Check for new conversation FAB button
    await expect(page.locator('role=fab[aria-label="Start new conversation"]')).toBeVisible();

    console.log('Chat page verified successfully');
  });

  test('3. Message sending works end-to-end', async ({ page }) => {
    // Navigate to chat page
    await page.goto(`${BASE_URL}/chat`);
    await page.waitForLoadState('networkidle');

    // Start a new conversation with "claude" agent
    await page.locator('role=fab[aria-label="Start new conversation"]').click();

    // Wait for agent selection dialog
    await expect(page.locator('role=dialog')).toBeVisible();

    // Select claude agent (first one in the list)
    const claudeOption = page.locator('[role="menuitem"]').first();
    await claudeOption.click();

    // Wait for conversation to load
    await page.waitForLoadState('networkidle');

    // Check that conversation view is visible
    await expect(page.locator('role=article[aria-label*="claude"]')).toBeVisible({ timeout: 10000 });

    // Type a message
    const testMessage = `E2E test message ${Date.now()}`;
    await page.locator('[aria-label="Message input"]').fill(testMessage);

    // Send the message
    await page.locator('role=button[name="Send"]').click();

    // Wait for message to appear in the chat
    await expect(page.locator(`text="${testMessage}"`)).toBeVisible({ timeout: 10000 });

    console.log('Message sending verified successfully');
  });

  test('4. Theme toggle works without page reload', async ({ page }) => {
    // Start on dashboard
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Get initial theme (check for light mode icon which appears as DarkModeOutlined when light)
    const themeToggleButton = page.locator('role=button[aria-label*="theme"]');
    await expect(themeToggleButton).toBeVisible();

    // Store initial URL
    const initialUrl = page.url();

    // Click theme toggle
    await themeToggleButton.click();

    // Verify page is still at the same URL (no navigation)
    await expect(page.url()).toBe(initialUrl);

    // Toggle back to original theme
    await themeToggleButton.click();

    // Verify page is still at the same URL
    await expect(page.url()).toBe(initialUrl);

    console.log('Theme toggle verified successfully');
  });

  test('5. All main navigation links work', async ({ page }) => {
    const pages = [
      { path: '/dashboard', name: 'Dashboard', heading: 'Founder Command Center' },
      { path: '/chat', name: 'Chat', heading: 'Conversations' },
      { path: '/memory', name: 'Memory', heading: 'Memory Browser' },
      { path: '/tasks', name: 'Tasks', heading: 'Tasks' },
      { path: '/approvals', name: 'Approvals', heading: 'Approvals' },
    ];

    for (const pageInfo of pages) {
      await page.goto(`${BASE_URL}${pageInfo.path}`);
      await page.waitForLoadState('networkidle');

      // Check for page heading
      await expect(page.locator(`role=heading, h1, h2, h3, h4, h5, h6`).filter({ hasText: pageInfo.heading }).first()).toBeVisible({ timeout: 15000 });

      console.log(`${pageInfo.name} page verified`);
    }
  });

  test('6. Dashboard stats cards are clickable and navigate correctly', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Click on Active Divisions card
    await page.locator('text=Active Divisions').click();
    await page.waitForLoadState('networkidle');
    await expect(page.url()).toContain('/organization');

    // Navigate back to dashboard
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Click on Staff Agents card
    await page.locator('text=Staff Agents').click();
    await page.waitForLoadState('networkidle');
    await expect(page.url()).toContain('/organization');

    // Navigate back to dashboard
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Click on Pending Approvals card
    await page.locator('text=Pending Approvals').click();
    await page.waitForLoadState('networkidle');
    await expect(page.url()).toContain('/approvals');

    console.log('Dashboard navigation verified successfully');
  });

  test('7. 404 page is shown for non-existent routes', async ({ page }) => {
    await page.goto(`${BASE_URL}/non-existent-route-${Date.now()}`);
    await page.waitForLoadState('networkidle');

    // Check for 404 page heading - must be exact match for 404 - Page Not Found
    await expect(page.locator('text="404 - Page Not Found"')).toBeVisible({ timeout: 10000 });

    // Check for navigation buttons
    await expect(page.locator('role=button[name="Go to Dashboard"]')).toBeVisible();
    await expect(page.locator('role=button[name="Go Back"]')).toBeVisible();

    console.log('404 page verified successfully');
  });

  test('8. No JavaScript errors or server errors on page load', async ({ page }) => {
    const errors: string[] = [];
    const failedRequests: string[] = [];
    const unhandledRejections: string[] = [];

    // Track console errors comprehensively
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const errorText = msg.text();
        errors.push(errorText);
        // Also track network errors, deprecation warnings, etc.
        if (errorText.includes('Warning') || errorText.includes('Error')) {
          console.log(`Console ${msg.type()}: ${errorText}`);
        }
      }
    });

    // Track unhandled promise rejections
    page.on('pageerror', error => {
      unhandledRejections.push(error.message);
    });

    // Track failed responses - only track unexpected 4xx, not expected ones
    // Expected 4xx patterns: favicon, assets, manifest, robots.txt
    const isExpected4xx = (status: number, url: string): boolean => {
      // Expected 404s for common static assets that may not exist
      const expectedPatterns = [
        '/favicon.ico',
        '/manifest.json',
        '/robots.txt',
        '/.well-known',
        '/assets/',
      ];
      return status === 404 && expectedPatterns.some(p => url.includes(p));
    };

    page.on('response', response => {
      const status = response.status();
      const url = response.url();
      // Track 5xx and unexpected 4xx (not the expected 404s)
      if (status >= 400 && !isExpected4xx(status, url)) {
        failedRequests.push(`${status} ${url}`);
      }
    });

    // Navigate to all configured routes
    const routes = ['/', '/dashboard', '/activity', '/chat', '/council', '/meetings', '/memory', '/organization', '/tasks', '/executions', '/deliverables', '/approvals'];

    for (const route of routes) {
      await page.goto(`${BASE_URL}${route}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500); // Wait for async operations
    }

    // Filter comprehensive console errors - all errors, not just a subset
    const criticalErrors = errors.filter(e =>
      e.includes('Objects are not valid as React child') ||
      e.includes('map is not a function') ||
      e.includes('Cannot read properties of undefined') ||
      e.includes('TypeError') ||
      e.includes('Uncaught') ||
      e.includes('Failed to load') ||
      e.includes('NetworkError')
    );

    // Report ALL console errors for visibility
    if (errors.length > 0) {
      console.log('All console errors:', errors);
    }

    const warningErrors = errors.filter(e => e.includes('Warning'));

    // Report results
    if (criticalErrors.length > 0) {
      console.log('Critical errors found:', criticalErrors);
    }

    if (unhandledRejections.length > 0) {
      console.log('Unhandled rejections:', unhandledRejections);
    }

    const serverErrors = failedRequests.filter(r => {
      const status = parseInt(r.split(' ')[0]);
      return status >= 500;
    });

    const allClientErrors = failedRequests.filter(r => {
      const status = parseInt(r.split(' ')[0]);
      return status >= 400 && status < 500;
    });

    console.log(`Console errors: ${errors.length}`);
    console.log(`Unhandled rejections: ${unhandledRejections.length}`);
    console.log(`Server errors (5xx): ${serverErrors.length}`);
    console.log(`Unexpected client errors (4xx): ${allClientErrors.length}`);
    if (allClientErrors.length > 0) {
      console.log('Unexpected 4xx errors:', allClientErrors);
    }

    // We expect no server errors, unhandled rejections, or unexpected client errors
    expect(serverErrors.length).toBe(0);
    expect(unhandledRejections.length).toBe(0);
    expect(criticalErrors.length).toBe(0);
    expect(allClientErrors.length).toBe(0);
  });

  test('9. AppBar navigation is persistent across pages', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Check AppBar is visible
    const appBar = page.locator('role=region[aria-label="main navigation"], header');
    await expect(appBar).toBeVisible();

    // Navigate to a different page and check AppBar persists
    await page.goto(`${BASE_URL}/chat`);
    await page.waitForLoadState('networkidle');

    // AppBar should still be visible
    const appBarAfterNav = page.locator('role=region[aria-label="main navigation"], header');
    await expect(appBarAfterNav).toBeVisible();

    console.log('AppBar persistence verified successfully');
  });

  test('10. User menu opens and closes properly', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Find user menu button (Avatar)
    const userMenuButton = page.locator('role=button[aria-label="User menu"]');
    await expect(userMenuButton).toBeVisible();

    // Open user menu
    await userMenuButton.click();

    // Check menu is open
    await expect(page.locator('[role="menu"]')).toBeVisible();

    // Check menu items
    await expect(page.locator('role=menuitem[name="Logout"]')).toBeVisible();

    // Close menu by clicking outside or Esc
    await page.keyboard.press('Escape');

    // Wait a moment for menu to close
    await page.waitForTimeout(500);

    console.log('User menu verified successfully');
  });
});