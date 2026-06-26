import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));
const page = await browser.newPage({ viewport: { width: 1743, height: 927 }, deviceScaleFactor: 1 });
await page.goto('http://localhost:5175/', { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: /Generate patient twin/i }).click();
await page.locator('.stage-canvas-layer canvas').waitFor({ state: 'visible', timeout: 12000 });
await page.locator('.lab-materializing-overlay').waitFor({ state: 'detached', timeout: 7000 }).catch(() => {});
await page.getByRole('tab', { name: /Dashboard/i }).click();
await page.getByText('Digital twin patient').waitFor({ timeout: 5000 });
const boxes = await page.evaluate(() => {
  const pick = (sel) => [...document.querySelectorAll(sel)].map((node) => {
    const r = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return { sel, text: node.textContent?.trim().slice(0, 80), x: r.x, y: r.y, w: r.width, h: r.height, display: style.display, opacity: style.opacity, visibility: style.visibility, z: style.zIndex, position: style.position, overflow: style.overflow };
  });
  return {
    activeWorkspaceText: document.querySelector('.workspace-content')?.className,
    panel: pick('.workspace-panel'),
    content: pick('.workspace-content'),
    dashboard: pick('.dashboard-workspace'),
    hero: pick('.dashboard-hero'),
    stats: pick('.stat-card'),
    sections: pick('.dashboard-section'),
    tabs: pick('.workspace-tab'),
  };
});
console.log(JSON.stringify(boxes, null, 2));
await browser.close();