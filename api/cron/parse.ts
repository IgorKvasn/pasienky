import type { RequestContext } from '@vercel/functions';
import { loadConfig } from '../../server/src/config.js';
import { createPool } from '../../server/src/database/pool.js';
import { TimetableRepository } from '../../server/src/database/timetableRepository.js';
import { importTimetable } from '../../server/src/import/importTimetable.js';

export default function handler(request: Request, context: RequestContext) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = loadConfig();
  const pool = createPool(config.databaseUrl);
  const repository = new TimetableRepository(pool);

  context.waitUntil(
    importTimetable({
      pageUrl: config.bratislavaPageUrl,
      repository
    }).catch(() => {})
  );

  return Response.json({ status: 'accepted' });
}
