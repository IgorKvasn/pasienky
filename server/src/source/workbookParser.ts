import * as XLSX from 'xlsx';
import type { TimetableSlotInput } from '../database/timetableRepository.js';

type CellValue = string | number | boolean | Date | null | undefined;

export function parseWorkbook(buffer: Buffer): TimetableSlotInput[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const slots: TimetableSlotInput[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<CellValue[]>(sheet, { header: 1, blankrows: false });

    rows.forEach((row, index) => {
      const parsed = parseRow(row, sheetName, index + 1);
      if (parsed) {
        slots.push(parsed);
      }
    });
  }

  if (!slots.length) {
    throw new Error('No timetable slots found');
  }

  return slots;
}

function parseRow(row: CellValue[], sourceSheet: string, sourceRow: number): TimetableSlotInput | null {
  const values = row.map(normalizeCell);
  const date = values.map(parseDate).find(Boolean);
  const timeRange = values.map(parseTimeRange).find(Boolean);
  const availableLanes = values.map(parseLaneCount).find((value) => value !== null);

  if (!date || !timeRange || availableLanes === null || availableLanes === undefined) {
    return null;
  }

  const note = values.find((value) => value && !parseDate(value) && !parseTimeRange(value) && parseLaneCount(value) === null) ?? null;

  return {
    date,
    startTime: timeRange.startTime,
    endTime: timeRange.endTime,
    availableLanes,
    note,
    sourceSheet,
    sourceRow
  };
}

function normalizeCell(value: CellValue): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value === null || value === undefined ? '' : String(value).trim();
}

function parseDate(value: string): string | null {
  const iso = value.match(/^\d{4}-\d{2}-\d{2}$/);
  if (iso) {
    return value;
  }

  const slovak = value.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
  if (!slovak) {
    return null;
  }

  const [, day, month, year] = slovak;
  return `${year}-${padTwo(month)}-${padTwo(day)}`;
}

function parseTimeRange(value: string): { startTime: string; endTime: string } | null {
  const match = value.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  if (!match) {
    return null;
  }

  return {
    startTime: `${padTwo(match[1])}:${match[2]}`,
    endTime: `${padTwo(match[3])}:${match[4]}`
  };
}

function parseLaneCount(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }
  return Number(value);
}

function padTwo(value: string): string {
  return value.padStart(2, '0');
}
