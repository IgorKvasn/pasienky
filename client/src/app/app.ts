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
  buildMobileTimelineDays,
  isCurrentWeek,
  TIMELINE_HOURS,
  TimelineDay,
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

const MOBILE_SWIPE_THRESHOLD_PX = 48;

@Component({
  selector: 'app-root',
  imports: [DatePipe],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly timetableService = inject(TimetableService);
  private mobileTouchStart: { x: number; y: number } | null = null;
  private pendingMobileRolloverDirection: -1 | 1 | null = null;

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

  protected readonly mobileTimelineDays = computed(() => {
    const weekDates = getWeekDates(this.selectedDate());
    return buildMobileTimelineDays(this.response().slots, weekDates);
  });

  protected readonly selectedDay = computed(() => this.mobileTimelineDays()[this.selectedDayIndex()]);

  constructor() {
    this.loadWeek();
    this.timetableService.getDateRange()
      .pipe(catchError(() => of({ minDate: null, maxDate: null })))
      .subscribe((dateRange) => this.dateRange.set(dateRange));
  }

  protected previousWeek(): void {
    this.pendingMobileRolloverDirection = 1;
    this.shiftWeek(-7);
  }

  protected nextWeek(): void {
    this.pendingMobileRolloverDirection = 1;
    this.shiftWeek(7);
  }

  protected goToCurrentWeek(): void {
    this.selectedDate.set(new Date());
    this.selectedDayIndex.set(todayDayIndex());
    this.loadWeek();
  }

  protected selectDay(index: number): void {
    if (!this.hasDayData(this.mobileTimelineDays()[index])) {
      return;
    }

    this.selectedDayIndex.set(index);
  }

  protected onMobileTouchStart(event: TouchEvent): void {
    const touch = event.changedTouches[0];
    this.mobileTouchStart = { x: touch.clientX, y: touch.clientY };
  }

  protected onMobileTouchEnd(event: TouchEvent): void {
    if (this.mobileTouchStart === null) {
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - this.mobileTouchStart.x;
    const deltaY = touch.clientY - this.mobileTouchStart.y;
    this.mobileTouchStart = null;

    if (Math.abs(deltaX) < MOBILE_SWIPE_THRESHOLD_PX || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }

    this.shiftMobileDay(deltaX > 0 ? -1 : 1);
  }

  protected hasDayData(day: TimelineDay | undefined): boolean {
    return (day?.segments.length ?? 0) > 0;
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

  private shiftWeek(days: number, selectedDayIndex = 0): void {
    const next = new Date(this.selectedDate());
    next.setUTCDate(next.getUTCDate() + days);
    this.selectedDate.set(next);
    this.selectedDayIndex.set(selectedDayIndex);
    this.loadWeek();
  }

  private shiftMobileDay(direction: -1 | 1): void {
    const targetDayIndex = this.selectedDayIndex() + direction;

    if (targetDayIndex >= 0 && targetDayIndex < 7) {
      if (this.hasDayData(this.mobileTimelineDays()[targetDayIndex])) {
        this.selectedDayIndex.set(targetDayIndex);
        return;
      }

      if (this.hasEnabledDayAfter(targetDayIndex, direction)) {
        return;
      }

      this.shiftMobileWeek(direction);
      return;
    }

    this.shiftMobileWeek(direction);
  }

  private hasEnabledDayAfter(index: number, direction: -1 | 1): boolean {
    const days = this.mobileTimelineDays();
    for (let i = index + direction; i >= 0 && i < days.length; i += direction) {
      if (this.hasDayData(days[i])) {
        return true;
      }
    }
    return false;
  }

  private shiftMobileWeek(direction: -1 | 1): void {
    if (direction === 1 && this.canGoForward()) {
      this.pendingMobileRolloverDirection = direction;
      this.shiftWeek(7, 0);
    }

    if (direction === -1 && this.canGoBack()) {
      this.pendingMobileRolloverDirection = direction;
      this.shiftWeek(-7, 6);
    }
  }

  private selectRolloverDayIfNeeded(): void {
    const direction = this.pendingMobileRolloverDirection;
    if (direction === null) {
      return;
    }

    this.pendingMobileRolloverDirection = null;
    const selectableDayIndex = this.findSelectableDayIndex(direction);
    if (selectableDayIndex !== null) {
      this.selectedDayIndex.set(selectableDayIndex);
    }
  }

  private findSelectableDayIndex(direction: -1 | 1): number | null {
    const days = this.mobileTimelineDays();
    const start = direction === 1 ? 0 : days.length - 1;

    for (let i = start; i >= 0 && i < days.length; i += direction) {
      if (this.hasDayData(days[i])) {
        return i;
      }
    }

    return null;
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
        this.selectRolloverDayIfNeeded();
        this.hasLoadedTimetable.set(true);
        this.isLoading.set(false);
      });
  }
}
