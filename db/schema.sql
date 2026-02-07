CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS regattas (
  uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  url TEXT NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  slug TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS regattas_slug_idx ON regattas (slug);

CREATE TABLE IF NOT EXISTS regatta_events (
  id BIGSERIAL PRIMARY KEY,
  regatta_uuid UUID NOT NULL REFERENCES regattas(uuid) ON DELETE CASCADE,
  event_id INTEGER NOT NULL,
  event_name TEXT NOT NULL,
  UNIQUE (regatta_uuid, event_id)
);

CREATE TABLE IF NOT EXISTS regatta_races (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES regatta_events(id) ON DELETE CASCADE,
  race_label TEXT NOT NULL,
  race_date DATE,
  race_time TIME,
  status TEXT,
  progression TEXT,
  details_url TEXT,
  details_type TEXT,
  UNIQUE (event_id, race_label)
);

CREATE TABLE IF NOT EXISTS regatta_lane_draw_rows (
  id BIGSERIAL PRIMARY KEY,
  race_id BIGINT NOT NULL REFERENCES regatta_races(id) ON DELETE CASCADE,
  lane TEXT,
  crew TEXT,
  school TEXT,
  data JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS regatta_results_rows (
  id BIGSERIAL PRIMARY KEY,
  race_id BIGINT NOT NULL REFERENCES regatta_races(id) ON DELETE CASCADE,
  position TEXT,
  athlete TEXT,
  school TEXT,
  data JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS regatta_races_event_id_idx ON regatta_races(event_id);
CREATE INDEX IF NOT EXISTS regatta_lane_draw_race_idx ON regatta_lane_draw_rows(race_id);
CREATE INDEX IF NOT EXISTS regatta_results_race_idx ON regatta_results_rows(race_id);
CREATE INDEX IF NOT EXISTS regatta_results_athlete_idx ON regatta_results_rows (lower(athlete));
CREATE INDEX IF NOT EXISTS regatta_results_school_idx ON regatta_results_rows (lower(school));
CREATE INDEX IF NOT EXISTS regatta_lane_draw_crew_idx ON regatta_lane_draw_rows (lower(crew));
CREATE INDEX IF NOT EXISTS regatta_lane_draw_school_idx ON regatta_lane_draw_rows (lower(school));
