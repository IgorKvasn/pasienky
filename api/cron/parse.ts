import type { VercelRequest, VercelResponse } from '@vercel/node';
import { loadConfig } from '../../server/src/config.js';
import { createPool } from '../../server/src/database/pool.js';
import { TimetableRepository } from '../../server/src/database/timetableRepository.js';
import { importTimetable } from '../../server/src/import/importTimetable.js';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.authorization !== `Bearer ${cronSecret}`) {
    response.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const config = loadConfig();
  const pool = createPool(config.databaseUrl);
  const repository = new TimetableRepository(pool);

  try {
    const result = await importTimetable({
      pageUrl: config.bratislavaPageUrl,
      repository
    });

    response.json({
      importRunId: result.id,
      slotCount: result.slotCount,
      importedAt: result.finishedAt
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    response.status(500).json({ error: message });
  }
}
