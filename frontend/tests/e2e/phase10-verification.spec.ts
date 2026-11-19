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
  { path: '/dashboard', name: 'Dashboard', waitFor: 'h6:has-text("Recent Activity")' },
  { path: '/activity', name: 'Activity', waitFor: 'h5,h6' },
  { path: '/chat', name: 'Chat', waitFor: 'h6:has-text("Conversations")' },
  { path: '/council', name: 'Council', waitFor: '.MuiTabs-root' },
  { path: '/meetings', name: 'Meetings', waitFor: 'h5:has-text("Meetings")' },
  { path: '/tasks', name: 'Tasks', waitFor: '.MuiTabs-root' },
  { path: '/approvals', name: 'Approvals', waitFor: 'h6:has-text("No approval requests found")' },
  { path: '/organization', name: 'Organization', waitFor: '.MuiTabs-root' },
  { path: '/memory', name: 'Memory', waitFor: 'h6:has-text("Memory Browser")' },
  { path: '/executions', name: 'Executions', waitFor: 'h6:has-text("No execution requests found")' },
  { path: '/deliverables', name: 'Deliverables', waitFor: 'h6:has-text("No deliverables found")' },
  { path: '/profile', name: 'Profile', waitFor: 'h6:has-text("Profile")' },
  { path: '/settings', name: 'Settings', waitFor: 'h6:has-text("Settings")' },
];

test.describe('Phase 10 - All Pages Verification', () => {
  // Register console, page-error, and failed-response listeners BEFORE any navigation
  // This ensures we catch all errors from the first navigation
  let consoleErrors: string[] = [];
  let pageErrors: string[] = [];
  let failedRequests: { status: number; url: string }[] = [];

  test.beforeEach(async ({ page }) => {
    // LOCAL_SINGLE_USER_MODE: Test runs in local single-user mode
    // The server auto-authenticates as Founder on loopback connections
    // Login/authentication flow is NOT tested - this is a known limitation

    // Track all console errors from the start
    consoleErrors = [];
    pageErrors = [];
    failedRequests = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });

    page.on('response', response => {
      if (response.status() >= 400) {
        failedRequests.push({
          status: response.status(),
          url: response.url()
        });
      }
    });

    // Navigate to base URL first to establish the page
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
  });

  for (const pageInfo of PAGES) {
    test(`${pageInfo.name} page loads without errors`, async ({ page }) => {
      test.setTimeout(90000);
      console.log(`Testing ${pageInfo.name} at ${BASE_URL}${pageInfo.path}`);

      // Navigate to the page
      await page.goto(BASE_URL + pageInfo.path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      // Require the expected page content to be visible (do not suppress)
      await expect(page.locator(pageInfo.waitFor)).toBeVisible({ timeout: 60000 });

      // Wait for any async operations to complete
      await page.waitForTimeout(2000);

      // Verify no React errors (Objects are not valid as React child, etc.)
      const reactErrors = consoleErrors.filter(e =>
        e.includes('Objects are not valid as React child') ||
        e.includes('map is not a function') ||
        e.includes('Cannot read properties of undefined') ||
        e.includes('TypeError')
      );

      // FAIL on unexpected console errors and uncaught page errors
      if (reactErrors.length > 0) {
        console.log(`React errors on ${pageInfo.name}:`, reactErrors);
      }

      // Verify no page errors
      if (pageErrors.length > 0) {
        console.log(`Page errors on ${pageInfo.name}:`, pageErrors);
      }

      // These should fail the test if present
      expect(reactErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);

      console.log(`${pageInfo.name} page verified successfully`);
    });
  }

  test('All pages - no 500 or unexpected 404 errors', async ({ page }) => {
    test.setTimeout(180000);

    for (const pageInfo of PAGES) {
      await page.goto(BASE_URL + pageInfo.path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
    }

    const serverErrors = failedRequests.filter(r => r.status === 500 || r.status >= 500);
    const unexpected404s = failedRequests.filter(r => {
      if (r.status !== 404) return false;
      // Check if this is an expected single-user-mode 404
      const url = new URL(r.url);
      const pathname = url.pathname;
      return !EXPECTED_404_PATHS.some(expectedPath => pathname === expectedPath || pathname.startsWith(expectedPath));
    });

    console.log('Failed requests:', failedRequests);
    console.log('Server errors (5xx):', serverErrors.length);
    console.log('Unexpected 404s:', unexpected404s);

    // These tests should fail if there are server errors or unexpected 404s
    expect(serverErrors.length).toBe(0);
    expect(unexpected404s.length).toBe(0);
    expect(pageErrors.length).toBe(0);

    console.log('All pages verified - no server errors or unexpected 404s');
  });
});