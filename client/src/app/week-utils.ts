import { TimetableSlot } from './timetable.types';

export interface DaySlots {
  date: string;
  slots: TimetableSlot[];
}

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

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
