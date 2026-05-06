import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseWorkbook } from '../src/source/workbookParser.js';

function buildWorkbook(laneValues: (number | null)[]): Buffer {
  const headerRow: (string | number | null)[] = ['Dátum', 'Služba', null];
  for (let hour = 5; hour <= 24; hour++) {
    headerRow.push(hour, '00', null, null);
  }

  const dateRow: (Date | null)[] = [new Date('2026-05-11T00:00:00Z'), null, null];
  const emptyRow: null[] = [null, null, null];
  const lanesRow: (string | number | null)[] = ['Počet voľných dráh', null, null, ...laneValues];

  const sheet = XLSX.utils.aoa_to_sheet([headerRow, dateRow, emptyRow, lanesRow]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Verejnost');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

describe('parseWorkbook', () => {
  it('parses hourly lane counts into merged time-range slots', () => {
    // 4 sub-columns per hour (15-min intervals), hours 5-24
    // Set: 5:00=0,0,0,0  6:00=2,2,4,4  7:00=4,4,4,4
    const lanes: (number | null)[] = [];
    // Hour 5: all zeros
    lanes.push(0, 0, 0, 0);
    // Hour 6: 2,2,4,4
    lanes.push(2, 2, 4, 4);
    // Hour 7: all 4s
    lanes.push(4, 4, 4, 4);
    // Hours 8-24: pad with zeros
    for (let h = 8; h <= 24; h++) {
      lanes.push(0, 0, 0, 0);
    }

    const slots = parseWorkbook(buildWorkbook(lanes));

    expect(slots).toEqual([
      expect.objectContaining({ date: '2026-05-11', startTime: '05:00', endTime: '06:00', availableLanes: 0 }),
      expect.objectContaining({ date: '2026-05-11', startTime: '06:00', endTime: '06:30', availableLanes: 2 }),
      expect.objectContaining({ date: '2026-05-11', startTime: '06:30', endTime: '08:00', availableLanes: 4 }),
      expect.objectContaining({ date: '2026-05-11', startTime: '08:00', endTime: '24:00', availableLanes: 0 }),
    ]);

    expect(slots[0].sourceSheet).toBe('Verejnost');
  });

  it('fails loudly when no timetable rows can be parsed', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['nothing']]), 'Empty');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    expect(() => parseWorkbook(buffer)).toThrow('No timetable slots found');
  });
});
