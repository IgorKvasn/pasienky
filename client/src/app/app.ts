import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { catchError, of } from 'rxjs';
import { TimetableService } from './timetable.service';
import { DateRange, TimetableResponse } from './timetable.types';
import {
  getWeekRange,
  getWeekDates,
  getAdjacentWeekRange,
  buildTimelineDays,
  isCurrentWeek,
  TIMELINE_HOURS,
  TimelineSegment
} from './week-utils';

function todayDayIndex(): number {
  const day = new Date().getDay();
  return day === 0 ? 6 : day - 1;
}

const LANE_COLORS: Record<number, string> = {
  0: '#1a1c22',
  1: '#7a2e2e',
  2: '#8a5a20',
  3: '#7a7a22',
  4: '#2a7a4a',
  5: '#1e8a5a',
  6: '#18806e',
  7: '#1a6a8a',
  8: '#2255aa'
};

@Component({
  selector: 'app-root',
  imports: [DatePipe],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly timetableService = inject(TimetableService);

  protected readonly selectedDate = signal(new Date());
  protected readonly isLoading = signal(true);
  protected readonly hasLoadedTimetable = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly response = signal<TimetableResponse>({ slots: [], lastImport: null });
  protected readonly dateRange = signal<DateRange>({ minDate: null, maxDate: null });
  protected readonly weekRange = computed(() => getWeekRange(this.selectedDate()));
  protected readonly isCurrentWeek = computed(() => isCurrentWeek(this.selectedDate()));
  protected readonly hours = TIMELINE_HOURS;
  protected readonly legendEntries = Array.from({ length: 8 }, (_, i) => i + 1);
  protected readonly selectedDayIndex = signal(todayDayIndex());

  protected readonly canGoBack = computed(() => {
    const { minDate } = this.dateRange();
    if (minDate === null) return true;
    const previousWeek = getAdjacentWeekRange(this.selectedDate(), -1);
    return previousWeek.to >= minDate;
  });

  protected readonly canGoForward = computed(() => {
    const { maxDate } = this.dateRange();
    if (maxDate === null) return true;
    const nextWeek = getAdjacentWeekRange(this.selectedDate(), 1);
    return nextWeek.from <= maxDate;
  });

  protected readonly timelineDays = computed(() => {
    const weekDates = getWeekDates(this.selectedDate());
    return buildTimelineDays(this.response().slots, weekDates);
  });

  protected readonly selectedDay = computed(() => this.timelineDays()[this.selectedDayIndex()]);

  constructor() {
    this.loadWeek();
    this.timetableService.getDateRange()
      .pipe(catchError(() => of({ minDate: null, maxDate: null })))
      .subscribe((dateRange) => this.dateRange.set(dateRange));
  }

  protected previousWeek(): void {
    this.shiftWeek(-7);
  }

  protected nextWeek(): void {
    this.shiftWeek(7);
  }

  protected goToCurrentWeek(): void {
    this.selectedDate.set(new Date());
    this.selectedDayIndex.set(todayDayIndex());
    this.loadWeek();
  }

  protected selectDay(index: number): void {
    this.selectedDayIndex.set(index);
  }

  protected segmentColor(lanes: number): string {
    return LANE_COLORS[Math.min(lanes, 8)] ?? LANE_COLORS[8];
  }

  protected segmentTooltip(segment: TimelineSegment): string {
    const base = `${segment.startTime} – ${segment.endTime}: ${segment.lanes} dráh`;
    return segment.note ? `${base} (${segment.note})` : base;
  }

  protected hourTickLeft(hour: number): number {
    return ((hour - 5) / 19) * 100;
  }

  private shiftWeek(days: number): void {
    const next = new Date(this.selectedDate());
    next.setUTCDate(next.getUTCDate() + days);
    this.selectedDate.set(next);
    this.selectedDayIndex.set(0);
    this.loadWeek();
  }

  private loadWeek(): void {
    const range = this.weekRange();
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.timetableService
      .getTimetable(range.from, range.to)
      .pipe(
        catchError(() => {
          this.errorMessage.set('Rozpis sa nepodarilo načítať.');
          return of({ slots: [], lastImport: null });
        })
      )
      .subscribe((response) => {
        this.response.set(response);
        this.hasLoadedTimetable.set(true);
        this.isLoading.set(false);
      });
  }
}
