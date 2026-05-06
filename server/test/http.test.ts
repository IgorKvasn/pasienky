import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/http/app.js';

describe('HTTP API', () => {
  it('rejects parse trigger without shared secret', async () => {
    const app = createApp({
      parseTriggerToken: 'secret',
      importTimetable: vi.fn(),
      repository: fakeRepository()
    });

    await request(app).post('/api/admin/parse').expect(401);
  });

  it('runs parse trigger with shared secret', async () => {
    const importTimetable = vi.fn().mockResolvedValue({ id: '1', slotCount: 2, finishedAt: '2026-05-06T10:00:00.000Z' });
    const app = createApp({
      parseTriggerToken: 'secret',
      importTimetable,
      repository: fakeRepository()
    });

    const response = await request(app).post('/api/admin/parse').set('X-Parse-Token', 'secret').expect(200);

    expect(response.body.slotCount).toBe(2);
    expect(importTimetable).toHaveBeenCalledOnce();
  });

  it('returns date range from repository', async () => {
    const repository = fakeRepository();
    const app = createApp({
      parseTriggerToken: 'secret',
      importTimetable: vi.fn(),
      repository
    });

    const response = await request(app).get('/api/timetable/date-range').expect(200);

    expect(response.body).toEqual({ minDate: '2026-05-01', maxDate: '2026-05-31' });
    expect(repository.getDateRange).toHaveBeenCalledOnce();
  });

  it('returns nulls when no date range data exists', async () => {
    const repository = fakeRepository();
    repository.getDateRange = vi.fn().mockResolvedValue(null);
    const app = createApp({
      parseTriggerToken: 'secret',
      importTimetable: vi.fn(),
      repository
    });

    const response = await request(app).get('/api/timetable/date-range').expect(200);

    expect(response.body).toEqual({ minDate: null, maxDate: null });
  });

  it('returns timetable slots and import metadata', async () => {
    const repository = fakeRepository();
    const app = createApp({
      parseTriggerToken: 'secret',
      importTimetable: vi.fn(),
      repository
    });

    const response = await request(app).get('/api/timetable?from=2026-05-11&to=2026-05-17').expect(200);

    expect(response.body.slots).toHaveLength(1);
    expect(response.body.lastImport.slotCount).toBe(1);
  });
});

function fakeRepository() {
  return {
    findSlots: vi.fn().mockResolvedValue([
      {
        id: '1',
        date: '2026-05-11',
        startTime: '06:00',
        endTime: '08:00',
        availableLanes: 4,
        note: null,
        sourceSheet: 'Rozpis',
        sourceRow: 2
      }
    ]),
    getLastSuccessfulImport: vi.fn().mockResolvedValue({
      id: '1',
      status: 'succeeded',
      sourcePageUrl: 'https://example.test',
      workbookUrl: 'https://example.test/file.xlsx',
      startedAt: '2026-05-06T09:59:00.000Z',
      finishedAt: '2026-05-06T10:00:00.000Z',
      slotCount: 1,
      errorMessage: null
    }),
    getDateRange: vi.fn().mockResolvedValue({ minDate: '2026-05-01', maxDate: '2026-05-31' })
  };
}
