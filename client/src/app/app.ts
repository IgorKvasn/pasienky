import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { catchError, of } from 'rxjs';
import { TimetableService } from './timetable.service';
import { TimetableResponse } from './timetable.types';
import { getWeekRange, groupSlotsByDate } from './week-utils';

@Component({
  selector: 'app-root',
  imports: [DatePipe, NgClass],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly timetableService = inject(TimetableService);

  protected readonly selectedDate = signal(new Date());
  protected readonly minimumLanes = signal(1);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly response = signal<TimetableResponse>({ slots: [], lastImport: null });
  protected readonly weekRange = computed(() => getWeekRange(this.selectedDate()));
  protected readonly days = computed(() => groupSlotsByDate(this.response().slots, this.minimumLanes()));

  constructor() {
    this.loadWeek();
  }

  protected previousWeek(): void {
    this.shiftWeek(-7);
  }

  protected nextWeek(): void {
    this.shiftWeek(7);
  }

  protected setMinimumLanes(value: Event): void {
    const input = value.target as HTMLInputElement;
    this.minimumLanes.set(Number(input.value));
  }

  protected laneClass(count: number): string {
    if (count >= 4) {
      return 'high';
    }
    if (count >= 2) {
      return 'medium';
    }
    return 'low';
  }

  private shiftWeek(days: number): void {
    const next = new Date(this.selectedDate());
    next.setUTCDate(next.getUTCDate() + days);
    this.selectedDate.set(next);
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
          this.errorMessage.set('Timetable could not be loaded.');
          return of({ slots: [], lastImport: null });
        })
      )
      .subscribe((response) => {
        this.response.set(response);
        this.isLoading.set(false);
      });
  }
}
