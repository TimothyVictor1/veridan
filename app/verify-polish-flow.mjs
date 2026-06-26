import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));
const page = await browser.newPage({ viewport: { width: 1743, height: 927 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

await page.goto('http://localhost:5175/', { waitUntil: 'domcontentloaded' });
await page.getByText('Build the twin before the treatment.').waitFor({ timeout: 10000 });
const generate = page.getByRole('button', { name: /Generate patient twin/i });
const buttonBox = await generate.boundingBox();
if (!buttonBox || buttonBox.y > 730 || buttonBox.height < 64) throw new Error(`Generate button issue: ${JSON.stringify(buttonBox)}`);
await page.screenshot({ path: 'tmp-polish-setup.png', fullPage: false });
await page.locator('button.setup-patient').filter({ hasText: 'P03' }).click();
await generate.click();
await page.locator('.lab-materializing-overlay').waitFor({ state: 'visible', timeout: 3000 });
await page.locator('.stage-canvas-layer canvas').waitFor({ state: 'visible', timeout: 12000 });
await page.locator('.lab-materializing-overlay').waitFor({ state: 'detached', timeout: 7000 });
await page.getByRole('tab', { name: /Testing/i }).waitFor({ timeout: 5000 });
await page.getByText('Medicine library').waitFor({ timeout: 5000 });
await page.screenshot({ path: 'tmp-polish-testing.png', fullPage: false });
await page.getByRole('tab', { name: /Dashboard/i }).click();
await page.getByText('Digital twin patient').waitFor({ timeout: 5000 });
await page.getByText('Predicted trajectory').waitFor({ timeout: 5000 });
await page.screenshot({ path: 'tmp-polish-dashboard.png', fullPage: false });
const report = {
  ok: true,
  buttonBox,
  canvas: await page.locator('.stage-canvas-layer canvas').evaluate((node) => {
    const box = node.getBoundingClientRect();
    return { width: Math.round(box.width), height: Math.round(box.height), x: Math.round(box.x), y: Math.round(box.y) };
  }),
  testingCards: await page.locator('.control-panel').count(),
  dashboardStats: await page.locator('.stat-card').count(),
};
await browser.close();
if (errors.length) throw new Error(errors.join('\n'));
console.log(JSON.stringify(report, null, 2));