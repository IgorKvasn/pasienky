export interface TimetableSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  availableLanes: number;
  note: string | null;
}

export interface ImportRunSummary {
  id: string;
  status: 'succeeded';
  sourcePageUrl: string;
  workbookUrl: string | null;
  startedAt: string;
  finishedAt: string | null;
  slotCount: number;
  errorMessage: string | null;
}

export interface TimetableResponse {
  slots: TimetableSlot[];
  lastImport: ImportRunSummary | null;
}
