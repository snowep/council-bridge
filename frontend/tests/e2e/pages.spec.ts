import { test, expect } from '@playwright/test';

const PAGES = [
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/chat', name: 'Chat' },
  { path: '/council', name: 'Council' },
  { path: '/meetings', name: 'Meetings' },
  { path: '/memory', name: 'Memory' },
  { path: '/organization', name: 'Organization' },
  { path: '/tasks', name: 'Tasks' },
  { path: '/executions', name: 'Executions' },
  { path: '/deliverables', name: 'Deliverables' },
  { path: '/approvals', name: 'Approvals' },
];

for (const pageItem of PAGES) {
  test(`loads ${pageItem.name} page`, async ({ page }) => {
    await page.goto(`http://localhost:5173${pageItem.path}`);
    await page.waitForLoadState('networkidle');

    // Check that page loaded (AppBar heading should be present - first h6 in header)
    await expect(page.locator('header h6').first()).toContainText('Council Bridge', { timeout: 10000 });
  });
}