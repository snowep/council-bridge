import { test, expect } from '@playwright/test';

test('debug page headings', async ({ page }) => {
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

  const pages = [
    { path: '/', name: 'Dashboard' },
    { path: '/chat', name: 'Chat' },
    { path: '/council', name: 'Council' },
    { path: '/deliverables', name: 'Deliverables' },
    { path: '/executions', name: 'Executions' },
    { path: '/meetings', name: 'Meetings' },
    { path: '/tasks', name: 'Tasks' },
    { path: '/approvals', name: 'Approvals' },
    { path: '/organization', name: 'Organization' },
    { path: '/memory', name: 'Memory' },
  ];

  for (const pageInfo of pages) {
    await page.goto('http://localhost:5173' + pageInfo.path);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find all h5 elements
    const h5s = await page.locator('h5').all();
    for (const h5 of h5s) {
      const text = await h5.textContent();
      console.log(`${pageInfo.name}: h5 = "${text}"`);
    }

    // Find all h6 elements
    const h6s = await page.locator('h6').all();
    for (const h6 of h6s) {
      const text = await h6.textContent();
      console.log(`${pageInfo.name}: h6 = "${text}"`);
    }

    // Find Typography with variant h5/h6
    const typos = await page.locator('[data-testid]').all();
    for (const typo of typos) {
      const text = await typo.textContent();
      console.log(`${pageInfo.name}: [data-testid] = "${text}"`);
    }
  }
});