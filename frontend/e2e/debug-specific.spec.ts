import { test, expect } from '@playwright/test';

test('debug specific page', async ({ page }) => {
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

  // Check Council page
  console.log('=== Council Page ===');
  await page.goto('http://localhost:5173/council');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(10000);

  const councilErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      councilErrors.push(msg.text());
    }
  });

  await page.waitForTimeout(5000);
  console.log('Council errors:', councilErrors);

  // Check Tasks page
  console.log('\n=== Tasks Page ===');
  await page.goto('http://localhost:5173/tasks');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(10000);

  const tasksErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      tasksErrors.push(msg.text());
    }
  });

  await page.waitForTimeout(5000);
  console.log('Tasks errors:', tasksErrors);

  // Check Organization page
  console.log('\n=== Organization Page ===');
  await page.goto('http://localhost:5173/organization');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(10000);

  const orgErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      orgErrors.push(msg.text());
    }
  });

  await page.waitForTimeout(5000);
  console.log('Organization errors:', orgErrors);
});