import { test, expect } from '@playwright/test';

test('debug failing pages', async ({ page }) => {
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
    { path: '/council', name: 'Council' },
    { path: '/tasks', name: 'Tasks' },
    { path: '/organization', name: 'Organization' },
  ];

  for (const pageInfo of pages) {
    console.log(`\n=== Debugging ${pageInfo.name} ===`);
    await page.goto('http://localhost:5173' + pageInfo.path);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    // Take screenshot
    await page.screenshot({ path: `e2e-screenshots/debug-${pageInfo.name.toLowerCase()}.png`, fullPage: true });

    // Check console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Check page content
    const content = await page.content();
    console.log(`Page content length: ${content.length}`);

    // Find all h5/h6 elements
    const headings = await page.locator('h5, h6').all();
    for (const h of headings) {
      const text = await h.textContent();
      console.log(`  Heading: "${text}"`);
    }

    // Check for loading indicators
    const loading = await page.locator('.MuiCircularProgress-root').count();
    console.log(`  Loading indicators: ${loading}`);

    // Check for Alert/error messages
    const alerts = await page.locator('.MuiAlert-root').all();
    for (const alert of alerts) {
      const text = await alert.textContent();
      console.log(`  Alert: "${text}"`);
    }

    // Check for typography elements
    const typos = await page.locator('.MuiTypography-root').all();
    for (const typo of typos) {
      const text = await typo.textContent();
      if (text && text.trim().length > 0 && text.trim().length < 100) {
        console.log(`  Typography: "${text.trim()}"`);
      }
    }

    if (errors.length > 0) {
      console.log('  Console errors:', errors);
    }
  }
});