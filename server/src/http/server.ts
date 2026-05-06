import 'dotenv/config';
import { loadConfig } from '../config.js';
import { createPool } from '../database/pool.js';
import { TimetableRepository } from '../database/timetableRepository.js';
import { importTimetable } from '../import/importTimetable.js';
import { createApp } from './app.js';

const config = loadConfig();
const pool = createPool(config.databaseUrl);
const repository = new TimetableRepository(pool);

const app = createApp({
  parseTriggerToken: config.parseTriggerToken,
  repository,
  importTimetable: () =>
    importTimetable({
      pageUrl: config.bratislavaPageUrl,
      repository
    })
});

app.listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`);
});
