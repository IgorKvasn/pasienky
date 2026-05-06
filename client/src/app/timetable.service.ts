import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { TimetableResponse } from './timetable.types';

@Injectable({ providedIn: 'root' })
export class TimetableService {
  private readonly httpClient = inject(HttpClient);

  getTimetable(from: string, to: string): Observable<TimetableResponse> {
    return this.httpClient.get<TimetableResponse>('/api/timetable', {
      params: { from, to }
    });
  }
}
