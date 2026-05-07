import { waitUntil } from '@vercel/functions';
import { loadConfig } from '../server/src/config.js';
import { createPool } from '../server/src/database/pool.js';
import { TimetableRepository } from '../server/src/database/timetableRepository.js';
import { importTimetable } from '../server/src/import/importTimetable.js';
import { createApp } from '../server/src/http/app.js';

const config = loadConfig();
const pool = createPool(config.databaseUrl);
const repository = new TimetableRepository(pool);

export default createApp({
  parseTriggerToken: config.parseTriggerToken,
  repository,
  waitUntil,
  importTimetable: () =>
    importTimetable({
      pageUrl: config.bratislavaPageUrl,
      repository
    })
});
