import type { ImportRunSummary, TimetableRepository } from '../database/timetableRepository.js';
import { fetchBratislavaPage, findWorkbookUrl } from '../source/bratislavaPage.js';
import { parseWorkbook } from '../source/workbookParser.js';

export interface ImportTimetableDependencies {
  pageUrl: string;
  fetchPage?: (url: string) => Promise<string>;
  findWorkbookUrl?: (html: string) => string;
  fetchWorkbook?: (url: string) => Promise<Buffer>;
  parseWorkbook?: (buffer: Buffer) => Parameters<TimetableRepository['replaceTimetable']>[2];
  repository: Pick<TimetableRepository, 'replaceTimetable'>;
}

export async function importTimetable(dependencies: ImportTimetableDependencies): Promise<ImportRunSummary> {
  const fetchPage = dependencies.fetchPage ?? fetchBratislavaPage;
  const discoverWorkbookUrl = dependencies.findWorkbookUrl ?? findWorkbookUrl;
  const downloadWorkbook = dependencies.fetchWorkbook ?? fetchWorkbook;
  const parse = dependencies.parseWorkbook ?? parseWorkbook;

  const html = await fetchPage(dependencies.pageUrl);
  const workbookUrl = discoverWorkbookUrl(html);
  const workbookBuffer = await downloadWorkbook(workbookUrl);
  const slots = parse(workbookBuffer);

  return dependencies.repository.replaceTimetable(dependencies.pageUrl, workbookUrl, slots);
}

export async function fetchWorkbook(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch workbook: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}
