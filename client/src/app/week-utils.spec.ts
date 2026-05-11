import { vi } from 'vitest';
import {
  getWeekRange,
  getWeekDates,
  getAdjacentWeekRange,
  buildTimelineDays,
  buildMobileTimelineDays,
  isCurrentWeek
} from './week-utils';

describe('getWeekRange', () => {
  it('returns a Monday to Sunday range', () => {
    expect(getWeekRange(new Date('2026-05-13T12:00:00Z'))).toEqual({
      from: '2026-05-11',
      to: '2026-05-17'
    });
  });
});

describe('getWeekDates', () => {
  it('returns 7 dates starting from Monday', () => {
    const dates = getWeekDates(new Date('2026-05-13T12:00:00Z'));
    expect(dates).toEqual([
      '2026-05-11', '2026-05-12', '2026-05-13', '2026-05-14',
      '2026-05-15', '2026-05-16', '2026-05-17'
    ]);
  });
});

describe('getAdjacentWeekRange', () => {
  it('returns previous week range', () => {
    const date = new Date('2026-05-13T12:00:00Z');
    expect(getAdjacentWeekRange(date, -1)).toEqual({
      from: '2026-05-04',
      to: '2026-05-10'
    });
  });

  it('returns next week range', () => {
    const date = new Date('2026-05-13T12:00:00Z');
    expect(getAdjacentWeekRange(date, 1)).toEqual({
      from: '2026-05-18',
      to: '2026-05-24'
    });
  });
});

describe('isCurrentWeek', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true when the date is in the current week', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-06T10:00:00Z'));
    expect(isCurrentWeek(new Date('2026-05-04T00:00:00Z'))).toBe(true);
    expect(isCurrentWeek(new Date('2026-05-10T23:59:59Z'))).toBe(true);
  });

  it('returns false when the date is in a different week', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-06T10:00:00Z'));
    expect(isCurrentWeek(new Date('2026-05-11T00:00:00Z'))).toBe(false);
    expect(isCurrentWeek(new Date('2026-04-27T00:00:00Z'))).toBe(false);
  });
});

describe('buildTimelineDays', () => {
  it('builds segments with correct percentages', () => {
    const slots = [
      { id: '1', date: '2026-05-11', startTime: '06:00', endTime: '08:00', availableLanes: 4, note: null }
    ];
    const days = buildTimelineDays(slots, ['2026-05-11']);

    expect(days).toHaveLength(1);
    expect(days[0].segments).toHaveLength(1);

    const segment = days[0].segments[0];
    expect(segment.lanes).toBe(4);
    expect(segment.startTime).toBe('06:00');
    expect(segment.endTime).toBe('08:00');
    // 06:00 = 360min, day starts at 300min, span = 1140min
    // left = (360-300)/1140*100 ≈ 5.26%
    expect(segment.leftPercent).toBeCloseTo(5.26, 1);
    // width = (480-360)/1140*100 ≈ 10.53%
    expect(segment.widthPercent).toBeCloseTo(10.53, 1);
  });

  it('includes empty days with no segments', () => {
    const days = buildTimelineDays([], ['2026-05-11', '2026-05-12']);
    expect(days).toHaveLength(2);
    expect(days[0].segments).toEqual([]);
    expect(days[1].segments).toEqual([]);
  });

  it('preserves notes in segments', () => {
    const slots = [
      { id: '1', date: '2026-05-11', startTime: '10:00', endTime: '12:00', availableLanes: 2, note: 'Údržba' }
    ];
    const days = buildTimelineDays(slots, ['2026-05-11']);
    expect(days[0].segments[0].note).toBe('Údržba');
  });

  it('marks days with at least 3 lanes throughout the full 07:00 to 08:00 interval', () => {
    const slots = [
      { id: '1', date: '2026-05-11', startTime: '06:00', endTime: '08:00', availableLanes: 3, note: null },
      { id: '2', date: '2026-05-12', startTime: '07:00', endTime: '08:00', availableLanes: 2, note: null },
      { id: '3', date: '2026-05-13', startTime: '08:00', endTime: '10:00', availableLanes: 4, note: null },
      { id: '4', date: '2026-05-14', startTime: '07:00', endTime: '07:30', availableLanes: 3, note: null },
      { id: '5', date: '2026-05-15', startTime: '07:00', endTime: '07:30', availableLanes: 3, note: null },
      { id: '6', date: '2026-05-15', startTime: '07:30', endTime: '08:00', availableLanes: 3, note: null }
    ];

    const days = buildTimelineDays(slots, [
      '2026-05-11',
      '2026-05-12',
      '2026-05-13',
      '2026-05-14',
      '2026-05-15'
    ]);

    expect(days.map(day => day.hasMorningAvailability)).toEqual([true, false, false, false, true]);
  });
});

describe('buildMobileTimelineDays', () => {
  it('expands imported ranges into 30-minute rows', () => {
    const slots = [
      { id: '1', date: '2026-05-11', startTime: '06:00', endTime: '07:30', availableLanes: 4, note: null },
      { id: '2', date: '2026-05-11', startTime: '10:00', endTime: '10:30', availableLanes: 2, note: 'Test' }
    ];

    const days = buildMobileTimelineDays(slots, ['2026-05-11']);

    expect(days[0].segments.map(segment => `${segment.startTime}-${segment.endTime}`)).toEqual([
      '06:00-06:30',
      '06:30-07:00',
      '07:00-07:30',
      '10:00-10:30'
    ]);
    expect(days[0].segments.map(segment => segment.lanes)).toEqual([4, 4, 4, 2]);
    expect(days[0].segments[3].note).toBe('Test');
  });

  it('keeps morning availability markers from desktop timeline days', () => {
    const slots = [
      { id: '1', date: '2026-05-11', startTime: '07:00', endTime: '08:00', availableLanes: 3, note: null }
    ];

    const days = buildMobileTimelineDays(slots, ['2026-05-11']);

    expect(days[0].hasMorningAvailability).toBe(true);
  });
});
