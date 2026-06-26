import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));
const page = await browser.newPage({ viewport: { width: 1743, height: 927 }, deviceScaleFactor: 1 });
await page.goto('http://localhost:5175/', { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: /Generate patient twin/i }).click();
await page.locator('.stage-canvas-layer canvas').waitFor({ state: 'visible', timeout: 12000 });
await page.locator('.lab-materializing-overlay').waitFor({ state: 'detached', timeout: 7000 }).catch(() => {});
await page.getByRole('tab', { name: /Dashboard/i }).click();
await page.getByText('Digital twin patient').waitFor({ timeout: 5000 });
await page.waitForTimeout(1200);
const styles = await page.evaluate(() => {
 const node = document.querySelector('.dashboard-hero');
 const s = getComputedStyle(node);
 return { opacity: s.opacity, animationName: s.animationName, animationDuration: s.animationDuration, animationDelay: s.animationDelay, animationPlayState: s.animationPlayState, animationFillMode: s.animationFillMode, transform: s.transform };
});
console.log(JSON.stringify(styles,null,2));
await browser.close();