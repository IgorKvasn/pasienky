import dotenv from 'dotenv';
import { resolve } from 'node:path';
import pg from 'pg';
import { createSchemaSql } from './schema.js';

dotenv.config({ path: resolve(import.meta.dirname, '../../../.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
pool.query(createSchemaSql)
  .then(() => console.log('Schema created successfully'))
  .catch((err: unknown) => console.error('Schema creation failed:', (err as Error).message))
  .finally(() => pool.end());
