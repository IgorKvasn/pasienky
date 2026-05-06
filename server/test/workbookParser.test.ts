import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseWorkbook } from '../src/source/workbookParser.js';

describe('parseWorkbook', () => {
  it('parses date, time range, lane count, and note rows', () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Dátum', 'Čas', 'Voľné dráhy', 'Poznámka'],
      ['2026-05-11', '06:00 - 08:00', 4, 'ráno'],
      ['2026-05-12', '12:30 - 14:00', 2, null]
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Rozpis');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    expect(parseWorkbook(buffer)).toEqual([
      {
        date: '2026-05-11',
        startTime: '06:00',
        endTime: '08:00',
        availableLanes: 4,
        note: 'ráno',
        sourceSheet: 'Rozpis',
        sourceRow: 2
      },
      {
        date: '2026-05-12',
        startTime: '12:30',
        endTime: '14:00',
        availableLanes: 2,
        note: null,
        sourceSheet: 'Rozpis',
        sourceRow: 3
      }
    ]);
  });

  it('fails loudly when no timetable rows can be parsed', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['nothing']]), 'Empty');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    expect(() => parseWorkbook(buffer)).toThrow('No timetable slots found');
  });
});
