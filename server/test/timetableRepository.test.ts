import { describe, expect, test } from 'vitest';

import { TimetableRepository, type TimetableSlotInput } from '../src/database/timetableRepository.js';

interface QueryCall {
  text: string;
  values?: unknown[];
}

class FakeClient {
  readonly calls: QueryCall[] = [];
  releaseCount = 0;

  constructor(private readonly handler: (text: string, values?: unknown[]) => unknown = () => ({ rows: [] })) {}

  async query(text: string, values?: unknown[]) {
    this.calls.push({ text, values });
    return this.handler(text, values);
  }

  release() {
    this.releaseCount += 1;
  }
}

class FakePool {
  readonly calls: QueryCall[] = [];

  constructor(private readonly client?: FakeClient, private readonly handler: (text: string, values?: unknown[]) => unknown = () => ({ rows: [] })) {}

  async connect() {
    if (!this.client) {
      throw new Error('No fake client configured');
    }

    return this.client;
  }

  async query(text: string, values?: unknown[]) {
    this.calls.push({ text, values });
    return this.handler(text, values);
  }
}

function createRepository(pool: FakePool): TimetableRepository {
  return new TimetableRepository(pool as never);
}

describe('TimetableRepository', () => {
  test('replaceTimetable replaces slots inside one successful transaction', async () => {
    const slots: TimetableSlotInput[] = [
      {
        date: '2026-05-07',
        startTime: '08:30',
        endTime: '09:30',
        availableLanes: 4,
        note: 'morning',
        sourceSheet: 'May',
        sourceRow: 12
      },
      {
        date: '2026-05-07',
        startTime: '09:30',
        endTime: '10:30',
        availableLanes: 2
      }
    ];
    const client = new FakeClient((text) => {
      if (text.includes('INSERT INTO import_runs')) {
        return { rows: [{ id: '42' }] };
      }

      if (text.includes('UPDATE import_runs')) {
        return {
          rows: [
            {
              id: '42',
              status: 'succeeded',
              source_page_url: 'https://example.test/page',
              workbook_url: 'https://example.test/workbook.xlsx',
              started_at: '2026-05-06T10:00:00.000Z',
              finished_at: '2026-05-06T10:01:00.000Z',
              slot_count: 2,
              error_message: null
            }
          ]
        };
      }

      return { rows: [] };
    });
    const repository = createRepository(new FakePool(client));

    const summary = await repository.replaceTimetable(
      'https://example.test/page',
      'https://example.test/workbook.xlsx',
      slots
    );

    expect(client.calls.map((call) => firstSqlWords(call.text))).toEqual([
      'BEGIN',
      'INSERT INTO import_runs',
      'DELETE FROM timetable_slots',
      'INSERT INTO timetable_slots',
      'INSERT INTO timetable_slots',
      'UPDATE import_runs SET',
      'COMMIT'
    ]);
    expect(client.calls[1].values).toEqual(['running', 'https://example.test/page', 'https://example.test/workbook.xlsx']);
    expect(client.calls[3].values).toEqual(['2026-05-07', '08:30', '09:30', 4, 'morning', 'May', 12, '42']);
    expect(client.calls[4].values).toEqual(['2026-05-07', '09:30', '10:30', 2, null, null, null, '42']);
    expect(summary).toEqual({
      id: '42',
      status: 'succeeded',
      sourcePageUrl: 'https://example.test/page',
      workbookUrl: 'https://example.test/workbook.xlsx',
      startedAt: '2026-05-06T10:00:00.000Z',
      finishedAt: '2026-05-06T10:01:00.000Z',
      slotCount: 2,
      errorMessage: null
    });
    expect(client.releaseCount).toBe(1);
  });

  test('replaceTimetable rolls back and releases the client when a slot insert fails', async () => {
    const client = new FakeClient((text) => {
      if (text.includes('INSERT INTO import_runs')) {
        return { rows: [{ id: '43' }] };
      }

      if (text.includes('INSERT INTO timetable_slots')) {
        throw new Error('insert failed');
      }

      return { rows: [] };
    });
    const repository = createRepository(new FakePool(client));

    await expect(
      repository.replaceTimetable('https://example.test/page', null, [
        {
          date: '2026-05-08',
          startTime: '08:00',
          endTime: '09:00',
          availableLanes: 1
        }
      ])
    ).rejects.toThrow('insert failed');

    expect(client.calls.map((call) => firstSqlWords(call.text))).toEqual([
      'BEGIN',
      'INSERT INTO import_runs',
      'DELETE FROM timetable_slots',
      'INSERT INTO timetable_slots',
      'ROLLBACK'
    ]);
    expect(client.releaseCount).toBe(1);
  });

  test('findSlots queries an inclusive date range and maps rows to camelCase values', async () => {
    const pool = new FakePool(undefined, () => ({
      rows: [
        {
          id: 7,
          slot_date: '2026-05-07',
          start_time: '08:30:00',
          end_time: '09:30:00',
          available_lanes: '3',
          note: null,
          source_sheet: 'May',
          source_row: 12,
          import_run_id: '42',
          created_at: '2026-05-06T10:02:00.000Z'
        }
      ]
    }));
    const repository = createRepository(pool);

    const slots = await repository.findSlots('2026-05-01', '2026-05-31');

    expect(firstSqlWords(pool.calls[0].text)).toBe('SELECT id, slot_date,');
    expect(pool.calls[0].text).toContain('slot_date >= $1');
    expect(pool.calls[0].text).toContain('slot_date <= $2');
    expect(pool.calls[0].text).toContain('ORDER BY slot_date, start_time');
    expect(pool.calls[0].values).toEqual(['2026-05-01', '2026-05-31']);
    expect(slots).toEqual([
      {
        id: '7',
        date: '2026-05-07',
        startTime: '08:30',
        endTime: '09:30',
        availableLanes: 3,
        note: null,
        sourceSheet: 'May',
        sourceRow: 12,
        importRunId: '42',
        createdAt: '2026-05-06T10:02:00.000Z'
      }
    ]);
  });

  test('getLastSuccessfulImport returns the newest succeeded import or null', async () => {
    const pool = new FakePool(undefined, () => ({
      rows: [
        {
          id: '44',
          status: 'succeeded',
          source_page_url: 'https://example.test/page',
          workbook_url: null,
          started_at: '2026-05-06T11:00:00.000Z',
          finished_at: '2026-05-06T11:01:00.000Z',
          slot_count: '5',
          error_message: null
        }
      ]
    }));
    const repository = createRepository(pool);

    await expect(repository.getLastSuccessfulImport()).resolves.toEqual({
      id: '44',
      status: 'succeeded',
      sourcePageUrl: 'https://example.test/page',
      workbookUrl: null,
      startedAt: '2026-05-06T11:00:00.000Z',
      finishedAt: '2026-05-06T11:01:00.000Z',
      slotCount: 5,
      errorMessage: null
    });
    expect(pool.calls[0].text).toContain("WHERE status = 'succeeded'");
    expect(pool.calls[0].text).toContain('ORDER BY finished_at DESC');

    const emptyRepository = createRepository(new FakePool(undefined, () => ({ rows: [] })));
    await expect(emptyRepository.getLastSuccessfulImport()).resolves.toBeNull();
  });
});

function firstSqlWords(sql: string): string {
  return sql.trim().replace(/\s+/g, ' ').split(' ').slice(0, 3).join(' ');
}
