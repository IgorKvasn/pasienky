import { describe, expect, it } from 'vitest';
import { groupSlotsByDate, getWeekRange } from './week-utils';

describe('week utilities', () => {
  it('returns a Monday to Sunday range', () => {
    expect(getWeekRange(new Date('2026-05-13T12:00:00Z'))).toEqual({
      from: '2026-05-11',
      to: '2026-05-17'
    });
  });

  it('groups slots by date and applies minimum lanes', () => {
    const grouped = groupSlotsByDate(
      [
        { id: '1', date: '2026-05-11', startTime: '06:00', endTime: '08:00', availableLanes: 1, note: null },
        { id: '2', date: '2026-05-11', startTime: '12:00', endTime: '14:00', availableLanes: 4, note: null }
      ],
      2
    );

    expect(grouped).toEqual([
      {
        date: '2026-05-11',
        slots: [{ id: '2', date: '2026-05-11', startTime: '12:00', endTime: '14:00', availableLanes: 4, note: null }]
      }
    ]);
  });
});
