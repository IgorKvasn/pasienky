export const createSchemaSql = `
CREATE TABLE IF NOT EXISTS import_runs (
  id BIGSERIAL PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  source_page_url TEXT NOT NULL,
  workbook_url TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  slot_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS timetable_slots (
  id BIGSERIAL PRIMARY KEY,
  slot_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  available_lanes INTEGER NOT NULL CHECK (available_lanes >= 0),
  note TEXT,
  source_sheet TEXT,
  source_row INTEGER,
  import_run_id BIGINT NOT NULL REFERENCES import_runs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS timetable_slots_slot_date_idx ON timetable_slots (slot_date);
CREATE INDEX IF NOT EXISTS timetable_slots_import_run_id_idx ON timetable_slots (import_run_id);
`;
