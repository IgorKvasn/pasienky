import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';

describe('App', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  function flushTimetable(slots: any[] = []) {
    const req = httpTesting.expectOne(r => r.url === '/api/timetable');
    req.flush({ slots, lastImport: null });
  }

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    flushTimetable();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render heading', async () => {
    const fixture = TestBed.createComponent(App);
    flushTimetable();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Voľné plavecké dráhy');
  });

  describe('current week button', () => {
    it('hides the today button when viewing current week', async () => {
      const fixture = TestBed.createComponent(App);
      flushTimetable();
      fixture.detectChanges();
      await fixture.whenStable();
      const todayButton = fixture.nativeElement.querySelector('.today-button');
      expect(todayButton).toBeNull();
    });

    it('shows the today button after navigating to a different week', async () => {
      const fixture = TestBed.createComponent(App);
      flushTimetable();
      fixture.detectChanges();

      fixture.componentInstance['previousWeek']();
      flushTimetable();
      fixture.detectChanges();
      await fixture.whenStable();

      const todayButton = fixture.nativeElement.querySelector('.today-button');
      expect(todayButton).not.toBeNull();
      expect(todayButton.textContent).toContain('Dnes');
    });

    it('navigates back to current week when today button is clicked', async () => {
      const fixture = TestBed.createComponent(App);
      flushTimetable();
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
      expect(fixture.nativeElement.querySelector('.today-button')).toBeNull();
    });
  });

  describe('day selection', () => {
    it('defaults selectedDayIndex to today within the week', () => {
      const fixture = TestBed.createComponent(App);
      flushTimetable();
      const dayIndex = fixture.componentInstance['selectedDayIndex']();
      const todayJs = new Date().getDay();
      const expected = todayJs === 0 ? 6 : todayJs - 1;
      expect(dayIndex).toBe(expected);
    });

    it('changes selectedDay when selectDay is called', () => {
      const fixture = TestBed.createComponent(App);
      flushTimetable();
      fixture.detectChanges();

      fixture.componentInstance['selectDay'](3);
      fixture.detectChanges();

      expect(fixture.componentInstance['selectedDayIndex']()).toBe(3);
    });

    it('resets selectedDayIndex to 0 when navigating weeks', () => {
      const fixture = TestBed.createComponent(App);
      flushTimetable();
      fixture.detectChanges();

      fixture.componentInstance['selectDay'](5);
      fixture.componentInstance['nextWeek']();
      flushTimetable();

      expect(fixture.componentInstance['selectedDayIndex']()).toBe(0);
    });

    it('renders day tabs in the mobile timeline section', async () => {
      const fixture = TestBed.createComponent(App);
      flushTimetable();
      fixture.detectChanges();
      await fixture.whenStable();

      const tabs = fixture.nativeElement.querySelectorAll('.day-tab');
      expect(tabs.length).toBe(7);
    });

    it('marks the selected day tab as active', async () => {
      const fixture = TestBed.createComponent(App);
      flushTimetable();
      fixture.detectChanges();

      fixture.componentInstance['selectDay'](2);
      fixture.detectChanges();
      await fixture.whenStable();

      const tabs = fixture.nativeElement.querySelectorAll('.day-tab');
      expect(tabs[2].classList.contains('active')).toBe(true);
      expect(tabs[0].classList.contains('active')).toBe(false);
    });

    it('shows slot rows for the selected day with data', async () => {
      const fixture = TestBed.createComponent(App);
      const days = fixture.componentInstance['timelineDays']();
      const targetDate = days[0]?.date;
      flushTimetable([
        { id: '1', date: targetDate, startTime: '06:00', endTime: '08:00', availableLanes: 4, note: null },
        { id: '2', date: targetDate, startTime: '10:00', endTime: '12:00', availableLanes: 3, note: 'Test' }
      ]);
      fixture.detectChanges();

      fixture.componentInstance['selectDay'](0);
      fixture.detectChanges();
      await fixture.whenStable();

      const rows = fixture.nativeElement.querySelectorAll('.day-slot-row');
      expect(rows.length).toBe(2);
    });
  });
});
