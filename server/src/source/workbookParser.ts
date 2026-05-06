import * as XLSX from 'xlsx';
import type { TimetableSlotInput } from '../database/timetableRepository.js';

type CellValue = string | number | boolean | Date | null | undefined;

const LANE_COUNT_LABEL = 'Počet voľných dráh';
const FIRST_HOUR_COLUMN = 4;
const COLUMNS_PER_HOUR = 4;
const MINUTES_PER_SLOT = 15;
const START_HOUR = 5;
const END_HOUR = 24;

export function parseWorkbook(buffer: Buffer): TimetableSlotInput[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const slots: TimetableSlotInput[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<CellValue[]>(sheet, { header: 1, blankrows: false });

    let currentDate: string | null = null;
    let currentDateRow = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const date = extractDate(row[0]);
      if (date) {
        currentDate = date;
        currentDateRow = i + 1;
        continue;
      }

      if (!currentDate) continue;

      const label = String(row[0] ?? '').trim();
      if (label !== LANE_COUNT_LABEL) continue;

      const daySlots = extractDaySlots(row, currentDate, sheetName, currentDateRow);
      slots.push(...daySlots);
    }
  }

  if (!slots.length) {
    throw new Error('No timetable slots found');
  }

  return slots;
}

function extractDaySlots(row: CellValue[], date: string, sourceSheet: string, sourceRow: number): TimetableSlotInput[] {
  const intervals: { hour: number; minute: number; lanes: number }[] = [];

  for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
    const hourOffset = hour - START_HOUR;
    const baseColumn = FIRST_HOUR_COLUMN + hourOffset * COLUMNS_PER_HOUR;

    for (let quarter = 0; quarter < COLUMNS_PER_HOUR; quarter++) {
      const cellValue = row[baseColumn + quarter];
      if (cellValue === null || cellValue === undefined || cellValue === '') continue;
      const lanes = Number(cellValue);
      if (!Number.isFinite(lanes)) continue;
      intervals.push({ hour, minute: quarter * MINUTES_PER_SLOT, lanes });
    }
  }

  return mergeIntervals(intervals, date, sourceSheet, sourceRow);
}

function mergeIntervals(
  intervals: { hour: number; minute: number; lanes: number }[],
  date: string,
  sourceSheet: string,
  sourceRow: number
): TimetableSlotInput[] {
  if (!intervals.length) return [];

  const slots: TimetableSlotInput[] = [];
  let startHour = intervals[0].hour;
  let startMinute = intervals[0].minute;
  let currentLanes = intervals[0].lanes;

  for (let i = 1; i < intervals.length; i++) {
    const interval = intervals[i];
    if (interval.lanes === currentLanes) continue;

    slots.push({
      date,
      startTime: formatTime(startHour, startMinute),
      endTime: formatTime(interval.hour, interval.minute),
      availableLanes: currentLanes,
      note: null,
      sourceSheet,
      sourceRow
    });

    startHour = interval.hour;
    startMinute = interval.minute;
    currentLanes = interval.lanes;
  }

  const last = intervals[intervals.length - 1];
  const endMinutes = (last.hour * 60 + last.minute + MINUTES_PER_SLOT);
  const cappedMinutes = Math.min(endMinutes, 24 * 60);
  slots.push({
    date,
    startTime: formatTime(startHour, startMinute),
    endTime: formatTime(Math.floor(cappedMinutes / 60), cappedMinutes % 60),
    availableLanes: currentLanes,
    note: null,
    sourceSheet,
    sourceRow
  });

  return slots;
}

function extractDate(value: CellValue): string | null {
  if (value instanceof Date) {
    // xlsx cellDates produces local-timezone Date objects; use local components
    // to avoid UTC conversion shifting the date by one day
    return `${value.getFullYear()}-${padTwo(String(value.getMonth() + 1))}-${padTwo(String(value.getDate()))}`;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const slovak = trimmed.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
  if (slovak) {
    return `${slovak[3]}-${padTwo(slovak[2])}-${padTwo(slovak[1])}`;
  }
  return null;
}

function formatTime(hour: number, minute: number): string {
  return `${padTwo(String(hour))}:${padTwo(String(minute))}`;
}

function padTwo(value: string): string {
  return value.padStart(2, '0');
}
