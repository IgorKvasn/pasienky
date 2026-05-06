import { TimetableSlot } from './timetable.types';

export interface DaySlots {
  date: string;
  slots: TimetableSlot[];
}

export interface TimelineSegment {
  leftPercent: number;
  widthPercent: number;
  lanes: number;
  startTime: string;
  endTime: string;
  note: string | null;
}

export interface TimelineDay {
  date: string;
  segments: TimelineSegment[];
}

const DAY_START_MINUTES = 5 * 60;
const DAY_END_MINUTES = 24 * 60;
const DAY_SPAN_MINUTES = DAY_END_MINUTES - DAY_START_MINUTES;

export function getWeekRange(date: Date): { from: string; to: string } {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = start.getUTCDay() || 7;
  start.setUTCDate(start.getUTCDate() - day + 1);

  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  return {
    from: formatDate(start),
    to: formatDate(end)
  };
}

export function getWeekDates(date: Date): string[] {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = start.getUTCDay() || 7;
  start.setUTCDate(start.getUTCDate() - day + 1);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    return formatDate(d);
  });
}

export function buildTimelineDays(slots: TimetableSlot[], weekDates: string[]): TimelineDay[] {
  const slotsByDate = new Map<string, TimetableSlot[]>();
  for (const slot of slots) {
    slotsByDate.set(slot.date, [...(slotsByDate.get(slot.date) ?? []), slot]);
  }

  return weekDates.map(date => {
    const daySlots = (slotsByDate.get(date) ?? [])
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    const segments: TimelineSegment[] = daySlots.map(slot => {
      const startMinutes = parseTime(slot.startTime);
      const endMinutes = parseTime(slot.endTime);
      return {
        leftPercent: ((startMinutes - DAY_START_MINUTES) / DAY_SPAN_MINUTES) * 100,
        widthPercent: ((endMinutes - startMinutes) / DAY_SPAN_MINUTES) * 100,
        lanes: slot.availableLanes,
        startTime: slot.startTime,
        endTime: slot.endTime,
        note: slot.note
      };
    });

    return { date, segments };
  });
}

export function getAdjacentWeekRange(date: Date, direction: -1 | 1): { from: string; to: string } {
  const shifted = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  shifted.setUTCDate(shifted.getUTCDate() + direction * 7);
  return getWeekRange(shifted);
}

export function isCurrentWeek(date: Date): boolean {
  const now = new Date();
  const currentRange = getWeekRange(now);
  const selectedRange = getWeekRange(date);
  return currentRange.from === selectedRange.from;
}

export const TIMELINE_HOURS = Array.from({ length: 20 }, (_, i) => i + 5);

function parseTime(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function groupSlotsByDate(slots: TimetableSlot[], minimumLanes: number): DaySlots[] {
  const grouped = new Map<string, TimetableSlot[]>();

  for (const slot of slots) {
    if (slot.availableLanes < minimumLanes) {
      continue;
    }

    grouped.set(slot.date, [...(grouped.get(slot.date) ?? []), slot]);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, daySlots]) => ({
      date,
      slots: daySlots.sort((left, right) => left.startTime.localeCompare(right.startTime))
    }));
}
