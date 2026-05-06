import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';
import { appConfig } from './app.config';
import { ImportRunSummary } from './timetable.types';

describe('App', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        ...(appConfig.providers ?? []),
        provideHttpClientTesting()
      ]
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  function flushTimetable(slots: any[] = [], lastImport: ImportRunSummary | null = null) {
    const req = httpTesting.expectOne(r => r.url === '/api/timetable');
    req.flush({ slots, lastImport });
  }

  function flushDateRange(minDate: string | null = null, maxDate: string | null = null) {
    const req = httpTesting.expectOne(r => r.url === '/api/timetable/date-range');
    req.flush({ minDate, maxDate });
  }

  function flushAll(slots: any[] = [], minDate: string | null = null, maxDate: string | null = null) {
    flushTimetable(slots);
    flushDateRange(minDate, maxDate);
  }

  function swipe(fixture: ReturnType<typeof TestBed.createComponent<App>>, fromX: number, toX: number) {
    fixture.componentInstance['onMobileTouchStart']({
      changedTouches: [{ clientX: fromX, clientY: 20 }]
    } as unknown as TouchEvent);
    fixture.componentInstance['onMobileTouchEnd']({
      changedTouches: [{ clientX: toX, clientY: 20 }]
    } as unknown as TouchEvent);
  }

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    flushAll();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render heading', async () => {
    const fixture = TestBed.createComponent(App);
    flushAll();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Voľné plavecké dráhy');
  });

  it('renders visible dates with Slovak weekday names and DD.MM.YYYY dates', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance['selectedDate'].set(new Date(Date.UTC(2026, 4, 13)));
    flushTimetable([], {
      id: 'import-1',
      status: 'succeeded',
      sourcePageUrl: 'https://example.test',
      finishedAt: '2026-05-06T09:08:00Z',
      workbookUrl: null,
      startedAt: '2026-05-06T09:00:00Z',
      slotCount: 0,
      errorMessage: null
    });
    flushDateRange();
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const weekControls = compiled.querySelector('.week-controls')?.textContent ?? '';
    const desktopDayLabel = compiled.querySelector('.desktop-timeline .timeline-row .timeline-day-label')?.textContent ?? '';
    const mobileDayTab = compiled.querySelector('.day-tab')?.textContent ?? '';
    const lastUpdated = compiled.querySelector('.last-updated')?.textContent ?? '';

    expect(weekControls).toContain('11.05.2026');
    expect(weekControls).toContain('17.05.2026');
    expect(desktopDayLabel).toContain('po 11.05.');
    expect(desktopDayLabel).not.toContain('2026');
    expect(desktopDayLabel).not.toContain('Mon');
    expect(mobileDayTab).toContain('po');
    expect(mobileDayTab).not.toContain('Mon');
    expect(mobileDayTab).toContain('11.05.2026');
    expect(lastUpdated).toContain('06.05.2026');
  });

  describe('current week button', () => {
    it('disables the today button when viewing current week', async () => {
      const fixture = TestBed.createComponent(App);
      flushAll();
      fixture.detectChanges();
      await fixture.whenStable();
      const todayButton = fixture.nativeElement.querySelector('.today-button') as HTMLButtonElement;
      expect(todayButton).not.toBeNull();
      expect(todayButton.disabled).toBe(true);
    });

    it('enables the today button after navigating to a different week', async () => {
      const fixture = TestBed.createComponent(App);
      flushAll();
      fixture.detectChanges();

      fixture.componentInstance['previousWeek']();
      flushTimetable();
      fixture.detectChanges();
      await fixture.whenStable();

      const todayButton = fixture.nativeElement.querySelector('.today-button');
      expect(todayButton).not.toBeNull();
      expect(todayButton.disabled).toBe(false);
      expect(todayButton.textContent).toContain('Tento týždeň');
    });

    it('navigates back to current week when today button is clicked', async () => {
      const fixture = TestBed.createComponent(App);
      flushAll();
      fixture.detectChanges();

      fixture.componentInstance['previousWeek']();
      flushTimetable();
      fixture.detectChanges();

      const todayButton = fixture.nativeElement.querySelector('.today-button') as HTMLButtonElement;
      todayButton.click();
      flushTimetable();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(fixture.componentInstance['isCurrentWeek']()).toBe(true);
      const todayButtonAfterClick = fixture.nativeElement.querySelector('.today-button') as HTMLButtonElement;
      expect(todayButtonAfterClick).not.toBeNull();
      expect(todayButtonAfterClick.disabled).toBe(true);
    });
  });

  describe('day selection', () => {
    it('defaults selectedDayIndex to today within the week', () => {
      const fixture = TestBed.createComponent(App);
      flushAll();
      const dayIndex = fixture.componentInstance['selectedDayIndex']();
      const todayJs = new Date().getDay();
      const expected = todayJs === 0 ? 6 : todayJs - 1;
      expect(dayIndex).toBe(expected);
    });

    it('changes selectedDay when selectDay is called', () => {
      const fixture = TestBed.createComponent(App);
      const days = fixture.componentInstance['timelineDays']();
      flushAll([
        { id: '1', date: days[3]?.date, startTime: '06:00', endTime: '08:00', availableLanes: 4, note: null }
      ]);
      fixture.detectChanges();

      fixture.componentInstance['selectDay'](3);
      fixture.detectChanges();

      expect(fixture.componentInstance['selectedDayIndex']()).toBe(3);
    });

    it('resets selectedDayIndex to 0 when navigating weeks', () => {
      const fixture = TestBed.createComponent(App);
      flushAll();
      fixture.detectChanges();

      fixture.componentInstance['selectDay'](5);
      fixture.componentInstance['nextWeek']();
      flushTimetable();

      expect(fixture.componentInstance['selectedDayIndex']()).toBe(0);
    });

    it('renders day tabs in the mobile timeline section', async () => {
      const fixture = TestBed.createComponent(App);
      flushAll();
      fixture.detectChanges();
      await fixture.whenStable();

      const tabs = fixture.nativeElement.querySelectorAll('.day-tab');
      expect(tabs.length).toBe(7);
    });

    it('marks the selected day tab as active', async () => {
      const fixture = TestBed.createComponent(App);
      const days = fixture.componentInstance['timelineDays']();
      flushAll([
        { id: '1', date: days[2]?.date, startTime: '06:00', endTime: '08:00', availableLanes: 4, note: null }
      ]);
      fixture.detectChanges();

      fixture.componentInstance['selectDay'](2);
      fixture.detectChanges();
      await fixture.whenStable();

      const tabs = fixture.nativeElement.querySelectorAll('.day-tab');
      expect(tabs[2].classList.contains('active')).toBe(true);
      expect(tabs[0].classList.contains('active')).toBe(false);
    });

    it('disables mobile day tabs that have no data', async () => {
      const fixture = TestBed.createComponent(App);
      const days = fixture.componentInstance['timelineDays']();
      const availableDate = days[1]?.date;
      flushTimetable([
        { id: '1', date: availableDate, startTime: '06:00', endTime: '08:00', availableLanes: 4, note: null }
      ]);
      flushDateRange();
      fixture.detectChanges();
      await fixture.whenStable();

      fixture.componentInstance['selectDay'](1);
      fixture.detectChanges();

      const tabs = fixture.nativeElement.querySelectorAll('.day-tab') as NodeListOf<HTMLButtonElement>;
      expect(tabs[0].disabled).toBe(true);
      expect(tabs[0].classList.contains('disabled')).toBe(true);
      expect(tabs[1].disabled).toBe(false);

      tabs[0].click();
      fixture.detectChanges();

      expect(fixture.componentInstance['selectedDayIndex']()).toBe(1);
    });

    it('disables mobile day tabs that only have zero available lanes', async () => {
      const fixture = TestBed.createComponent(App);
      const days = fixture.componentInstance['timelineDays']();
      const unavailableDate = days[0]?.date;
      const availableDate = days[1]?.date;
      flushTimetable([
        { id: '1', date: unavailableDate, startTime: '06:00', endTime: '08:00', availableLanes: 0, note: null },
        { id: '2', date: availableDate, startTime: '08:00', endTime: '10:00', availableLanes: 4, note: null }
      ]);
      flushDateRange();
      fixture.detectChanges();
      await fixture.whenStable();

      fixture.componentInstance['selectDay'](1);
      fixture.detectChanges();

      const tabs = fixture.nativeElement.querySelectorAll('.day-tab') as NodeListOf<HTMLButtonElement>;
      expect(tabs[0].disabled).toBe(true);
      expect(tabs[0].classList.contains('disabled')).toBe(true);
      expect(tabs[1].disabled).toBe(false);

      tabs[0].click();
      fixture.detectChanges();

      expect(fixture.componentInstance['selectedDayIndex']()).toBe(1);
    });

    it('shows slot rows for the selected day with data', async () => {
      const fixture = TestBed.createComponent(App);
      const days = fixture.componentInstance['timelineDays']();
      const targetDate = days[0]?.date;
      flushTimetable([
        { id: '1', date: targetDate, startTime: '06:00', endTime: '08:00', availableLanes: 4, note: null },
        { id: '2', date: targetDate, startTime: '10:00', endTime: '12:00', availableLanes: 3, note: 'Test' }
      ]);
      flushDateRange();
      fixture.detectChanges();

      fixture.componentInstance['selectDay'](0);
      fixture.detectChanges();
      await fixture.whenStable();

      const rows = fixture.nativeElement.querySelectorAll('.day-slot-row');
      expect(rows.length).toBe(8);
      expect(rows[0].querySelector('.slot-time')?.textContent).toContain('06:00 – 06:30');
      expect(rows[7].querySelector('.slot-time')?.textContent).toContain('11:30 – 12:00');
    });

    it('keeps the mobile selected-day timetable element when navigating from empty to available slots', async () => {
      const fixture = TestBed.createComponent(App);
      flushAll([], '2000-01-01', '2099-12-31');
      fixture.detectChanges();
      await fixture.whenStable();

      fixture.componentInstance['selectDay'](0);
      fixture.detectChanges();
      const initialDaySlots = fixture.nativeElement.querySelector('.day-slots');

      fixture.componentInstance['nextWeek']();
      const nextWeekDate = fixture.componentInstance['timelineDays']()[0].date;
      flushTimetable([
        { id: '1', date: nextWeekDate, startTime: '06:00', endTime: '08:00', availableLanes: 4, note: null }
      ]);
      fixture.detectChanges();
      await fixture.whenStable();

      const updatedDaySlots = fixture.nativeElement.querySelector('.day-slots');
      expect(updatedDaySlots).toBe(initialDaySlots);
      expect(fixture.nativeElement.querySelectorAll('.day-slot-row').length).toBe(4);
      expect(fixture.nativeElement.querySelector('.no-slots')).toBeNull();
    });

    it('moves to the next enabled day when swiping from left to right on mobile', () => {
      const fixture = TestBed.createComponent(App);
      const days = fixture.componentInstance['timelineDays']();
      flushAll([
        { id: '1', date: days[0]?.date, startTime: '06:00', endTime: '08:00', availableLanes: 4, note: null },
        { id: '2', date: days[1]?.date, startTime: '08:00', endTime: '10:00', availableLanes: 3, note: null }
      ]);
      fixture.detectChanges();

      fixture.componentInstance['selectDay'](0);
      swipe(fixture, 20, 120);

      expect(fixture.componentInstance['selectedDayIndex']()).toBe(1);
    });

    it('keeps the selected day when swiping from left to right toward a disabled next day', () => {
      const fixture = TestBed.createComponent(App);
      const days = fixture.componentInstance['timelineDays']();
      flushAll([
        { id: '1', date: days[0]?.date, startTime: '06:00', endTime: '08:00', availableLanes: 4, note: null },
        { id: '2', date: days[2]?.date, startTime: '10:00', endTime: '12:00', availableLanes: 4, note: null }
      ]);
      fixture.detectChanges();

      fixture.componentInstance['selectDay'](0);
      swipe(fixture, 20, 120);

      expect(fixture.componentInstance['selectedDayIndex']()).toBe(0);
    });

    it('moves to the next week when swiping from left to right from the last enabled day', () => {
      const fixture = TestBed.createComponent(App);
      const days = fixture.componentInstance['timelineDays']();
      flushAll([
        { id: '1', date: days[4]?.date, startTime: '06:00', endTime: '08:00', availableLanes: 4, note: null }
      ], '2000-01-01', '2099-12-31');
      fixture.detectChanges();

      const initialWeek = fixture.componentInstance['weekRange']();
      fixture.componentInstance['selectDay'](4);
      swipe(fixture, 20, 120);
      flushTimetable();

      expect(fixture.componentInstance['weekRange']().from).not.toBe(initialWeek.from);
      expect(fixture.componentInstance['selectedDayIndex']()).toBe(0);
    });

    it('selects the first selectable day after moving to the next week', () => {
      const fixture = TestBed.createComponent(App);
      const days = fixture.componentInstance['timelineDays']();
      flushAll([
        { id: '1', date: days[6]?.date, startTime: '06:00', endTime: '08:00', availableLanes: 4, note: null }
      ], '2000-01-01', '2099-12-31');
      fixture.detectChanges();

      fixture.componentInstance['selectDay'](6);
      swipe(fixture, 20, 120);
      const nextWeekDays = fixture.componentInstance['timelineDays']();
      flushTimetable([
        { id: '2', date: nextWeekDays[2]?.date, startTime: '10:00', endTime: '12:00', availableLanes: 4, note: null }
      ]);
      fixture.detectChanges();

      expect(fixture.componentInstance['selectedDayIndex']()).toBe(2);
    });

    it('moves to the next week when swiping from left to right from the last day', () => {
      const fixture = TestBed.createComponent(App);
      const days = fixture.componentInstance['timelineDays']();
      flushAll([
        { id: '1', date: days[6]?.date, startTime: '06:00', endTime: '08:00', availableLanes: 4, note: null }
      ], '2000-01-01', '2099-12-31');
      fixture.detectChanges();

      const initialWeek = fixture.componentInstance['weekRange']();
      fixture.componentInstance['selectDay'](6);
      swipe(fixture, 20, 120);
      flushTimetable();

      expect(fixture.componentInstance['weekRange']().from).not.toBe(initialWeek.from);
      expect(fixture.componentInstance['selectedDayIndex']()).toBe(0);
    });

    it('moves to the previous week when swiping from right to left from the first day', () => {
      const fixture = TestBed.createComponent(App);
      const days = fixture.componentInstance['timelineDays']();
      flushAll([
        { id: '1', date: days[0]?.date, startTime: '06:00', endTime: '08:00', availableLanes: 4, note: null }
      ], '2000-01-01', '2099-12-31');
      fixture.detectChanges();

      const initialWeek = fixture.componentInstance['weekRange']();
      fixture.componentInstance['selectDay'](0);
      swipe(fixture, 120, 20);
      flushTimetable();

      expect(fixture.componentInstance['weekRange']().from).not.toBe(initialWeek.from);
      expect(fixture.componentInstance['selectedDayIndex']()).toBe(6);
    });

    it('moves to the previous week when swiping from right to left from the first enabled day', () => {
      const fixture = TestBed.createComponent(App);
      const days = fixture.componentInstance['timelineDays']();
      flushAll([
        { id: '1', date: days[2]?.date, startTime: '06:00', endTime: '08:00', availableLanes: 4, note: null }
      ], '2000-01-01', '2099-12-31');
      fixture.detectChanges();

      const initialWeek = fixture.componentInstance['weekRange']();
      fixture.componentInstance['selectDay'](2);
      swipe(fixture, 120, 20);
      flushTimetable();

      expect(fixture.componentInstance['weekRange']().from).not.toBe(initialWeek.from);
      expect(fixture.componentInstance['selectedDayIndex']()).toBe(6);
    });

    it('selects the last selectable day after moving to the previous week', () => {
      const fixture = TestBed.createComponent(App);
      const days = fixture.componentInstance['timelineDays']();
      flushAll([
        { id: '1', date: days[0]?.date, startTime: '06:00', endTime: '08:00', availableLanes: 4, note: null }
      ], '2000-01-01', '2099-12-31');
      fixture.detectChanges();

      fixture.componentInstance['selectDay'](0);
      swipe(fixture, 120, 20);
      const previousWeekDays = fixture.componentInstance['timelineDays']();
      flushTimetable([
        { id: '2', date: previousWeekDays[3]?.date, startTime: '10:00', endTime: '12:00', availableLanes: 4, note: null }
      ]);
      fixture.detectChanges();

      expect(fixture.componentInstance['selectedDayIndex']()).toBe(3);
    });
  });

  describe('date range navigation', () => {
    it('keeps desktop timeline row elements when navigating weeks', async () => {
      const fixture = TestBed.createComponent(App);
      flushAll([], '2000-01-01', '2099-12-31');
      fixture.detectChanges();
      await fixture.whenStable();

      const initialRows = Array.from(
        fixture.nativeElement.querySelectorAll('.desktop-timeline .timeline-row')
      );
      fixture.componentInstance['nextWeek']();
      const nextWeekDate = fixture.componentInstance['timelineDays']()[0].date;
      flushTimetable([
        { id: '1', date: nextWeekDate, startTime: '06:00', endTime: '08:00', availableLanes: 4, note: null }
      ]);
      fixture.detectChanges();
      await fixture.whenStable();

      const updatedRows = Array.from(
        fixture.nativeElement.querySelectorAll('.desktop-timeline .timeline-row')
      );
      expect(updatedRows.length).toBe(7);
      expect(updatedRows[0]).toBe(initialRows[0]);
      expect(fixture.nativeElement.querySelectorAll('.timeline-segment').length).toBe(1);
    });

    it('disables previous button when at min date boundary', async () => {
      const fixture = TestBed.createComponent(App);
      const weekRange = fixture.componentInstance['weekRange']();
      flushAll([], weekRange.from, '2099-12-31');
      fixture.detectChanges();
      await fixture.whenStable();

      const prevButton = fixture.nativeElement.querySelector('[aria-label="Predchádzajúci týždeň"]') as HTMLButtonElement;
      expect(prevButton.disabled).toBe(true);
    });

    it('disables next button when at max date boundary', async () => {
      const fixture = TestBed.createComponent(App);
      const weekRange = fixture.componentInstance['weekRange']();
      flushAll([], '2000-01-01', weekRange.to);
      fixture.detectChanges();
      await fixture.whenStable();

      const nextButton = fixture.nativeElement.querySelector('[aria-label="Nasledujúci týždeň"]') as HTMLButtonElement;
      expect(nextButton.disabled).toBe(true);
    });

    it('enables both buttons when within date range', async () => {
      const fixture = TestBed.createComponent(App);
      flushAll([], '2000-01-01', '2099-12-31');
      fixture.detectChanges();
      await fixture.whenStable();

      const prevButton = fixture.nativeElement.querySelector('[aria-label="Predchádzajúci týždeň"]') as HTMLButtonElement;
      const nextButton = fixture.nativeElement.querySelector('[aria-label="Nasledujúci týždeň"]') as HTMLButtonElement;
      expect(prevButton.disabled).toBe(false);
      expect(nextButton.disabled).toBe(false);
    });
  });

  describe('lane count display', () => {
    it('does not display 0 lane count in desktop segments', async () => {
      const fixture = TestBed.createComponent(App);
      const days = fixture.componentInstance['timelineDays']();
      const targetDate = days[0]?.date;
      flushAll([
        { id: '1', date: targetDate, startTime: '06:00', endTime: '20:00', availableLanes: 0, note: null }
      ]);
      fixture.detectChanges();
      await fixture.whenStable();

      const segmentLabels = fixture.nativeElement.querySelectorAll('.segment-label');
      expect(segmentLabels.length).toBe(0);
    });

    it('does not display 0 lane count in mobile slot rows', async () => {
      const fixture = TestBed.createComponent(App);
      const days = fixture.componentInstance['timelineDays']();
      const targetDate = days[0]?.date;
      flushAll([
        { id: '1', date: targetDate, startTime: '06:00', endTime: '08:00', availableLanes: 0, note: null }
      ]);
      fixture.detectChanges();

      fixture.componentInstance['selectDay'](0);
      fixture.detectChanges();
      await fixture.whenStable();

      const slotLanes = fixture.nativeElement.querySelectorAll('.slot-lanes');
      expect(slotLanes.length).toBe(0);
    });
  });
});
