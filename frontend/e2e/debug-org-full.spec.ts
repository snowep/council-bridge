import { test, expect } from '@playwright/test';

test('debug organization page full content', async ({ page }) => {
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

  console.log('=== Organization Page ===');
  await page.goto('http://localhost:5173/organization');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(15000);

  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  await page.waitForTimeout(5000);
  console.log('Console errors:', errors);

  // Find all elements with text content
  const allElements = await page.locator('*').all();
  for (const el of allElements) {
    const text = await el.textContent();
    if (text && text.trim().length > 0 && text.trim().length < 200) {
      const tagName = await el.evaluate(el => el.tagName);
      const className = await el.getAttribute('class');
      console.log(`  <${tagName}${className ? '.' + className.split(' ').join('.') : ''}>: "${text.trim()}"`);
    }
  }
});