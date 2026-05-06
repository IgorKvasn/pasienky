import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { findWorkbookUrl } from '../src/source/bratislavaPage.js';

describe('findWorkbookUrl', () => {
  it('finds the SharePoint workbook link for public free lanes', async () => {
    const html = await readFile(new URL('./fixtures/bratislava-page.html', import.meta.url), 'utf8');

    expect(findWorkbookUrl(html)).toBe('https://starzbratislava.sharepoint.com/:x:/t/Technickyutvar/example');
  });

  it('fails when the target label is missing', () => {
    expect(() => findWorkbookUrl('<a href="https://wrong.example">Prejsť na stránku</a>')).toThrow(
      'Could not find workbook link'
    );
  });
});
