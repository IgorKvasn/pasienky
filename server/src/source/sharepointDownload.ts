import { chromium } from 'playwright';

export async function downloadSharePointWorkbook(shareUrl: string): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(shareUrl, { waitUntil: 'networkidle', timeout: 60000 });

    const excelFrame = page.frames().find(f => f.url().includes('officeapps.live.com'));
    if (!excelFrame) {
      throw new Error('Excel Online viewer frame not found — the share link may be invalid or expired');
    }

    await excelFrame.locator('text=Súbor').first().click();
    await page.waitForTimeout(1000);
    await excelFrame.locator('text=Vytvoriť kópiu').first().click();
    await page.waitForTimeout(1000);

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      excelFrame.locator('text=Stiahnuť kópiu').first().click()
    ]);

    const downloadPath = await download.path();
    if (!downloadPath) {
      throw new Error('Download failed — no file received');
    }

    const { readFileSync } = await import('node:fs');
    return readFileSync(downloadPath);
  } finally {
    await browser.close();
  }
}
