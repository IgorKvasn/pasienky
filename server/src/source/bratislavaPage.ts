import * as cheerio from 'cheerio';

const targetLabel = 'Časový rozpis voľných plaveckých dráh pre verejnosť';

export async function fetchBratislavaPage(pageUrl: string): Promise<string> {
  const response = await fetch(pageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch Bratislava page: ${response.status}`);
  }
  return response.text();
}

export function findWorkbookUrl(html: string): string {
  const $ = cheerio.load(html);
  const heading = $('h1,h2,h3,h4,h5,li,p,div')
    .filter((_, element) => $(element).text().includes(targetLabel))
    .first();

  if (!heading.length) {
    throw new Error('Could not find workbook link label');
  }

  const scope = heading.closest('article,section,li,div').first();
  const link = scope.find('a[href*="sharepoint.com"]').first().attr('href');
  const plainUrl = scope.text().match(/https:\/\/starzbratislava\.sharepoint\.com\/\S+/)?.[0];
  const workbookUrl = link ?? plainUrl;

  if (!workbookUrl) {
    throw new Error('Could not find workbook link');
  }

  return workbookUrl;
}
