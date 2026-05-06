import type { Pool } from 'pg';

export interface TimetableSlotInput {
  date: string;
  startTime: string;
  endTime: string;
  availableLanes: number;
  note?: string | null;
  sourceSheet?: string | null;
  sourceRow?: number | null;
}

export interface TimetableSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  availableLanes: number;
  note: string | null;
  sourceSheet: string | null;
  sourceRow: number | null;
  importRunId: string;
  createdAt: string;
}

export interface ImportRunSummary {
  id: string;
  status: 'running' | 'succeeded' | 'failed';
  sourcePageUrl: string;
  workbookUrl: string | null;
  startedAt: string;
  finishedAt: string | null;
  slotCount: number;
  errorMessage: string | null;
}

interface TimetableSlotRow {
  id: string | number | bigint;
  slot_date: string | Date;
  start_time: string | Date;
  end_time: string | Date;
  available_lanes: string | number;
  note: string | null;
  source_sheet: string | null;
  source_row: number | null;
  import_run_id: string | number | bigint;
  created_at: string | Date;
}

interface ImportRunSummaryRow {
  id: string | number | bigint;
  status: 'running' | 'succeeded' | 'failed';
  source_page_url: string;
  workbook_url: string | null;
  started_at: string | Date;
  finished_at: string | Date | null;
  slot_count: string | number;
  error_message: string | null;
}

export class TimetableRepository {
  constructor(private readonly pool: Pool) {}

  async replaceTimetable(
    sourcePageUrl: string,
    workbookUrl: string | null,
    slots: TimetableSlotInput[]
  ): Promise<ImportRunSummary> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const importRunResult = await client.query<{ id: string }>(
        `
          INSERT INTO import_runs (status, source_page_url, workbook_url)
          VALUES ($1, $2, $3)
          RETURNING id
        `,
        ['running', sourcePageUrl, workbookUrl]
      );
      const importRunId = String(importRunResult.rows[0].id);

      await client.query('DELETE FROM timetable_slots');

      for (const slot of slots) {
        await client.query(
          `
            INSERT INTO timetable_slots (
              slot_date,
              start_time,
              end_time,
              available_lanes,
              note,
              source_sheet,
              source_row,
              import_run_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            slot.date,
            slot.startTime,
            slot.endTime,
            slot.availableLanes,
            slot.note ?? null,
            slot.sourceSheet ?? null,
            slot.sourceRow ?? null,
            importRunId
          ]
        );
      }

      const summaryResult = await client.query<ImportRunSummaryRow>(
        `
          UPDATE import_runs
          SET status = 'succeeded',
              finished_at = now(),
              slot_count = $2
          WHERE id = $1
          RETURNING id,
                    status,
                    source_page_url,
                    workbook_url,
                    started_at,
                    finished_at,
                    slot_count,
                    error_message
        `,
        [importRunId, slots.length]
      );

      await client.query('COMMIT');

      return mapImportRunSummary(summaryResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findSlots(from: string, to: string): Promise<TimetableSlot[]> {
    const result = await this.pool.query<TimetableSlotRow>(
      `
        SELECT id,
               slot_date,
               start_time,
               end_time,
               available_lanes,
               note,
               source_sheet,
               source_row,
               import_run_id,
               created_at
        FROM timetable_slots
        WHERE slot_date >= $1
          AND slot_date <= $2
        ORDER BY slot_date, start_time
      `,
      [from, to]
    );

    return result.rows.map(mapTimetableSlot);
  }

  async getDateRange(): Promise<{ minDate: string; maxDate: string } | null> {
    const result = await this.pool.query<{ min_date: string | Date | null; max_date: string | Date | null }>(
      `
        SELECT MIN(slot_date) AS min_date,
               MAX(slot_date) AS max_date
        FROM timetable_slots
      `
    );

    const row = result.rows[0];
    if (!row?.min_date || !row?.max_date) {
      return null;
    }

    return {
      minDate: formatDate(row.min_date),
      maxDate: formatDate(row.max_date)
    };
  }

  async getLastSuccessfulImport(): Promise<ImportRunSummary | null> {
    const result = await this.pool.query<ImportRunSummaryRow>(
      `
        SELECT id,
               status,
               source_page_url,
               workbook_url,
               started_at,
               finished_at,
               slot_count,
               error_message
        FROM import_runs
        WHERE status = 'succeeded'
        ORDER BY finished_at DESC
        LIMIT 1
      `
    );

    if (!result.rows[0]) {
      return null;
    }

    return mapImportRunSummary(result.rows[0]);
  }
}

function mapTimetableSlot(row: TimetableSlotRow): TimetableSlot {
  return {
    id: String(row.id),
    date: formatDate(row.slot_date),
    startTime: formatTime(row.start_time),
    endTime: formatTime(row.end_time),
    availableLanes: Number(row.available_lanes),
    note: row.note,
    sourceSheet: row.source_sheet,
    sourceRow: row.source_row,
    importRunId: String(row.import_run_id),
    createdAt: formatTimestamp(row.created_at)
  };
}

function mapImportRunSummary(row: ImportRunSummaryRow): ImportRunSummary {
  return {
    id: String(row.id),
    status: row.status,
    sourcePageUrl: row.source_page_url,
    workbookUrl: row.workbook_url,
    startedAt: formatTimestamp(row.started_at),
    finishedAt: row.finished_at ? formatTimestamp(row.finished_at) : null,
    slotCount: Number(row.slot_count),
    errorMessage: row.error_message
  };
}

function formatDate(value: string | Date): string {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return value.slice(0, 10);
}

function formatTime(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(11, 16);
  }

  return value.slice(0, 5);
}

function formatTimestamp(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}
