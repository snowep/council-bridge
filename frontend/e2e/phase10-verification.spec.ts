import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';
const PAGES = [
  { path: '/', name: 'Dashboard', waitFor: 'h6:has-text("Recent Activity")' },
  { path: '/chat', name: 'Chat', waitFor: 'h6:has-text("Conversations")' },
  { path: '/council', name: 'Council', waitFor: '.MuiTabs-root' },
  { path: '/deliverables', name: 'Deliverables', waitFor: 'h6:has-text("No deliverables found")' },
  { path: '/executions', name: 'Executions', waitFor: 'h6:has-text("No execution requests found")' },
  { path: '/meetings', name: 'Meetings', waitFor: 'h5:has-text("Meetings")' },
  { path: '/tasks', name: 'Tasks', waitFor: '.MuiTabs-root' },
  { path: '/approvals', name: 'Approvals', waitFor: 'h6:has-text("No approval requests found")' },
  { path: '/organization', name: 'Organization', waitFor: '.MuiTabs-root' },
  { path: '/memory', name: 'Memory', waitFor: 'h6:has-text("Memory Browser")' },
];

test.describe('Phase 10 - All Pages Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL + '/login');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Login with test credentials - fill MUI Select inputs directly
    await page.fill('input[name="owner_type"]', 'Founder');
    await page.fill('input[name="owner_id"]', 'Founder');
    await page.fill('input[name="runtime"]', 'Claude Code');

    await page.click('button[type="submit"]');
    await page.waitForURL('**/', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  for (const pageInfo of PAGES) {
    test(`${pageInfo.name} page loads without errors`, async ({ page }) => {
      test.setTimeout(90000);
      console.log(`Testing ${pageInfo.name} at ${BASE_URL}${pageInfo.path}`);

      await page.goto(BASE_URL + pageInfo.path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(5000);

      // Wait for the main heading to appear
      await expect(page.locator(pageInfo.waitFor)).toBeVisible({ timeout: 60000 });

      // Check for any console errors
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      // Wait a bit more for any async operations
      await page.waitForTimeout(5000);

      // Verify no React errors (Objects are not valid as React child, etc.)
      const reactErrors = errors.filter(e =>
        e.includes('Objects are not valid as React child') ||
        e.includes('map is not a function') ||
        e.includes('Cannot read properties of undefined') ||
        e.includes('TypeError')
      );

      if (reactErrors.length > 0) {
        console.log(`React errors on ${pageInfo.name}:`, reactErrors);
      }

      expect(reactErrors.length).toBe(0);

      console.log(`${pageInfo.name} page verified successfully`);
    });
  }

  test('All pages - no 500 or 404 errors', async ({ page }) => {
    test.setTimeout(180000);
    const failedRequests: string[] = [];

    page.on('response', response => {
      if (response.status() >= 400) {
        failedRequests.push(`${response.status()} ${response.url()}`);
      }
    });

    for (const pageInfo of PAGES) {
      await page.goto(BASE_URL + pageInfo.path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }

    const serverErrors = failedRequests.filter(r => r.startsWith('5'));
    const notFoundErrors = failedRequests.filter(r => r.startsWith('404'));

    console.log('Failed requests:', failedRequests);
    expect(serverErrors.length).toBe(0);
    expect(notFoundErrors.length).toBe(0);
  });
});