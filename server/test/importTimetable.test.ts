import { describe, expect, it, vi } from 'vitest';
import { importTimetable } from '../src/import/importTimetable.js';

describe('importTimetable', () => {
  it('fetches page, finds workbook, parses slots, and stores them', async () => {
    const repository = {
      replaceTimetable: vi.fn().mockResolvedValue({ id: '1', slotCount: 1, finishedAt: '2026-05-06T10:00:00.000Z' })
    };

    const result = await importTimetable({
      pageUrl: 'https://example.test/page',
      fetchPage: vi.fn().mockResolvedValue('<h3>label</h3>'),
      findWorkbookUrl: vi.fn().mockReturnValue('https://example.test/file.xlsx'),
      fetchWorkbook: vi.fn().mockResolvedValue(Buffer.from('workbook')),
      parseWorkbook: vi.fn().mockReturnValue([
        {
          date: '2026-05-11',
          startTime: '06:00',
          endTime: '08:00',
          availableLanes: 4,
          note: null,
          sourceSheet: 'Rozpis',
          sourceRow: 2
        }
      ]),
      repository
    });

    expect(repository.replaceTimetable).toHaveBeenCalledWith('https://example.test/page', 'https://example.test/file.xlsx', [
      expect.objectContaining({ availableLanes: 4 })
    ]);
    expect(result.slotCount).toBe(1);
  });
});
