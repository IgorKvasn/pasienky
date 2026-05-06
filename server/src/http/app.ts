import express from 'express';
import type { TimetableRepository } from '../database/timetableRepository.js';

export interface AppDependencies {
  parseTriggerToken: string;
  importTimetable: () => Promise<{ id?: string; slotCount: number; finishedAt?: string | null }>;
  repository: Pick<TimetableRepository, 'findSlots' | 'getLastSuccessfulImport'>;
}

export function createApp(dependencies: AppDependencies) {
  const app = express();
  app.use(express.json());

  app.post('/api/admin/parse', async (request, response, next) => {
    try {
      if (request.header('X-Parse-Token') !== dependencies.parseTriggerToken) {
        response.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const result = await dependencies.importTimetable();
      response.json({
        importRunId: result.id,
        slotCount: result.slotCount,
        importedAt: result.finishedAt
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/timetable', async (request, response, next) => {
    try {
      const from = String(request.query.from ?? '');
      const to = String(request.query.to ?? '');

      if (!isIsoDate(from) || !isIsoDate(to)) {
        response.status(400).json({ error: 'from and to must be YYYY-MM-DD dates' });
        return;
      }

      const [slots, lastImport] = await Promise.all([
        dependencies.repository.findSlots(from, to),
        dependencies.repository.getLastSuccessfulImport()
      ]);

      response.json({ slots, lastImport });
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    const status = message.includes('fetch') ? 502 : message.includes('No timetable slots') ? 422 : 500;
    response.status(status).json({ error: message });
  });

  return app;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
