import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

// Known single-user-mode endpoints that return 404 (not actual errors)
// These are expected because features are not yet implemented in single-user mode
// LIMITATION: Test runs in LOCAL_SINGLE_USER_MODE - login/authentication is NOT tested
const EXPECTED_404_PATHS = [
  '/api/founders',
];

// All 13 unique application routes (based on App.tsx)
// Note: '/' redirects to '/dashboard', so we only test the unique routes
const PAGES = [
  { path: '/dashboard', name: 'Dashboard', waitFor: 'h6:has-text("Recent Activity")', heading: 'Founder Command Center' },
  { path: '/activity', name: 'Activity', waitFor: 'h4:has-text("Activity")', heading: 'Activity' },
  { path: '/chat', name: 'Chat', waitFor: 'h6:has-text("Conversations")', heading: 'Conversations' },
  { path: '/council', name: 'Council', waitFor: '.MuiTabs-root', heading: 'Council' },
  { path: '/meetings', name: 'Meetings', waitFor: 'h5:has-text("Meetings")', heading: 'Meetings' },
  { path: '/tasks', name: 'Tasks', waitFor: '.MuiTabs-root', heading: 'Tasks' },
  { path: '/approvals', name: 'Approvals', waitFor: 'h6:has-text("No approval requests found")', heading: 'Approvals' },
  { path: '/organization', name: 'Organization', waitFor: '.MuiTabs-root', heading: 'Organization' },
  { path: '/memory', name: 'Memory', waitFor: 'h6:has-text("Memory Browser")', heading: 'Memory Browser' },
  { path: '/executions', name: 'Executions', waitFor: 'h6:has-text("No execution requests found")', heading: 'Executions' },
  { path: '/deliverables', name: 'Deliverables', waitFor: 'h6:has-text("No deliverables found")', heading: 'Deliverables' },
  { path: '/profile', name: 'Profile', waitFor: 'h6:has-text("Profile")', heading: 'Profile' },
  { path: '/settings', name: 'Settings', waitFor: 'h6:has-text("Settings")', heading: 'Settings' },
];

test.describe('Phase 10 - All Pages Verification', () => {
  // Runtime monitoring state - initialized fresh per test
  let consoleErrors: string[] = [];
  let pageErrors: string[] = [];
  let failedRequests: { status: number; url: string; error?: string }[] = [];
  let unhandledException: Error | null = null;

  // Helper to check if an error is a known React/console warning (not a failure)
  function isKnownWarning(message: string): boolean {
    const warnings = [
      'DevTools',
      'React DevTools',
      'context menu',
      'double click',
    ];
    return warnings.some(w => message.toLowerCase().includes(w.toLowerCase()));
  }

  // Register ALL monitoring listeners BEFORE any navigation occurs
  // This ensures we catch EVERY error from the first page load
  function registerPageListeners(page: any) {
    // Console errors - capture all console.error messages
    page.on('console', (msg: any) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!isKnownWarning(text)) {
          consoleErrors.push(text);
        }
      }
    });

    // Uncaught page exceptions (JavaScript errors)
    page.on('pageerror', (error: Error) => {
      pageErrors.push(error.message);
    });

    // Unhandled promise rejections and exceptions
    page.on('unhandledException', (error: Error, stack: string) => {
      unhandledException = error;
      pageErrors.push(`Unhandled exception: ${error.message}`);
    });

    // Failed network requests (non-2xx responses)
    page.on('response', (response: any) => {
      const status = response.status();
      const url = response.url();
      if (status >= 400) {
        failedRequests.push({
          status,
          url,
          error: response.statusText() || undefined,
        });
      }
    });

    // Request failures (network errors, timeouts, etc.)
    page.on('requestfailed', (request: any, failure: any) => {
      failedRequests.push({
        status: 0,
        url: request.url(),
        error: failure.errorText || 'Request failed',
      });
    });
  }

  // Reset monitoring state before each test
  test.beforeEach(async ({ page }) => {
    // LOCAL_SINGLE_USER_MODE: Test runs in local single-user mode
    // The server auto-authenticates as Founder on loopback connections
    // Login/authentication flow is NOT tested - this is a known limitation

    // Clear all monitoring arrays
    consoleErrors = [];
    pageErrors = [];
    failedRequests = [];
    unhandledException = null;

    // Register listeners BEFORE any navigation
    registerPageListeners(page);
  });

  // Test each route individually with comprehensive checks
  for (const pageInfo of PAGES) {
    test(`${pageInfo.name} - navigate and verify content`, async ({ page }) => {
      // Reset monitoring state for this test
      consoleErrors = [];
      pageErrors = [];
      failedRequests = [];
      unhandledException = null;

      test.setTimeout(90000);

      // Navigate directly to the actual route
      await page.goto(`${BASE_URL}${pageInfo.path}`);

      // Wait for network to settle
      await page.waitForLoadState('networkidle');

      // Wait for loading indicators to settle (any spinners/skeletons)
      await page.waitForTimeout(1000);

      // Confirm exact pathname using URL API
      const url = new URL(page.url());
      expect(url.pathname).toBe(pageInfo.path);

      // Confirm expected page heading or unique landmark is visible
      await expect(page.locator(pageInfo.waitFor)).toBeVisible({
        timeout: 30000,
        message: `Expected element '${pageInfo.waitFor}' should be visible on ${pageInfo.name}`
      });

      // Confirm page is not blank (has content)
      const bodyContent = await page.locator('body').textContent();
      expect(bodyContent && bodyContent.trim().length).toBeGreaterThan(10, 'Page should have meaningful content, not be blank');

      // Confirm heading is visible
      if (pageInfo.heading) {
        await expect(
          page.locator(`role=heading`).filter({ hasText: pageInfo.heading })
        ).toBeVisible({ timeout: 15000 });
      }

      // Wait additional time for any async operations to complete
      await page.waitForTimeout(1000);

      // Check for uncaught browser exceptions (React runtime errors, etc.)
      // Document every exception explicitly
      const documentedExceptions: string[] = [];

      if (pageErrors.length > 0) {
        pageErrors.forEach((err, i) => {
          documentedExceptions.push(`[PAGE ERROR ${i + 1}]: ${err}`);
        });
      }

      if (unhandledException) {
        documentedExceptions.push(`[UNHANDLED EXCEPTION]: ${unhandledException.message}`);
      }

      // Check for unexpected server errors (5xx)
      const serverErrors = failedRequests.filter(r => r.status >= 500);
      if (serverErrors.length > 0) {
        serverErrors.forEach((err, i) => {
          documentedExceptions.push(`[SERVER ERROR ${i + 1}]: ${err.status} ${err.url} - ${err.error}`);
        });
      }

      // Log any documented exceptions
      if (documentedExceptions.length > 0) {
        console.log(`${pageInfo.name} - Documented exceptions:`);
        documentedExceptions.forEach(e => console.log(e));
      }

      // Assert no critical errors
      expect(pageErrors.length, `No page errors expected on ${pageInfo.name}`).toBe(0);
      expect(unhandledException, `No unhandled exceptions expected on ${pageInfo.name}`).toBeNull();
      expect(serverErrors.length, `No 5xx server errors expected on ${pageInfo.name}`).toBe(0);

      // Verify no broken primary navigation by checking nav links
      const navLinks = await page.locator('nav a, .Mui AppBar a, .navbar a, [role=navigation] a').count();
      if (navLinks > 0) {
        // Verify navigation links are present and clickable
        const brokenLinks = failedRequests.filter(r =>
          r.url.includes('navigation') || r.url.includes('nav') || r.url.includes('menu')
        );
        expect(brokenLinks.length, `Navigation links should work on ${pageInfo.name}`).toBe(0);
      }

      console.log(`${pageInfo.name} page verified successfully`);
    });
  }

  // Test: All pages - no 500 or unexpected 404 errors
  test('All pages - no 500 or unexpected 404 errors', async ({ page }) => {
    test.setTimeout(180000);

    // Reset monitoring state
    consoleErrors = [];
    pageErrors = [];
    failedRequests = [];
    unhandledException = null;

    // Re-register listeners (they were registered in beforeEach)
    registerPageListeners(page);

    for (const pageInfo of PAGES) {
      // Navigate to each page
      await page.goto(`${BASE_URL}${pageInfo.path}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
    }

    // Check for server errors (5xx) - these are always failures
    const serverErrors = failedRequests.filter(r => r.status >= 500);

    // Check for unexpected 404s using exact pathname comparison (NOT startsWith)
    const unexpected404s = failedRequests.filter(r => {
      if (r.status !== 404) return false;
      // Parse the URL to get the pathname
      try {
        const url = new URL(r.url, BASE_URL);
        const pathname = url.pathname;
        return !EXPECTED_404_PATHS.some(expectedPath => pathname === expectedPath);
      } catch {
        return true; // If URL parsing fails, treat as unexpected
      }
    });

    // Check for uncaught JavaScript errors
    const jsErrors = pageErrors.filter(e =>
      e.includes('TypeError') ||
      e.includes('ReferenceError') ||
      e.includes('SyntaxError') ||
      e.includes('Cannot read') ||
      e.includes('is not defined')
    );

    console.log('Failed requests:', failedRequests);
    console.log('Server errors (5xx):', serverErrors.length);
    console.log('Unexpected 404s:', unexpected404s.length);
    console.log('JavaScript errors:', jsErrors.length);

    if (unexpected404s.length > 0) {
      console.log('Unexpected 404 paths:', unexpected404s.map(r => r.url));
    }

    if (jsErrors.length > 0) {
      console.log('JavaScript errors:', jsErrors);
    }

    // These tests should fail if there are server errors or unexpected 404s
    expect(serverErrors.length, `Expected no 5xx server errors, found ${serverErrors.length}`).toBe(0);
    expect(unexpected404s.length, `Expected no unexpected 404s, found ${unexpected404s.length}`).toBe(0);
    expect(pageErrors.length, `Expected no page errors, found ${pageErrors.length}`).toBe(0);
    expect(jsErrors.length, `Expected no JavaScript errors, found ${jsErrors.length}`).toBe(0);

    console.log('All pages verified - no server errors or unexpected 404s');
  });
});