-- Migration: Create lines table
-- Created: 2026-04-04

DO $$ BEGIN
    CREATE TYPE line_sense_enum AS ENUM ('OUTBOUND', 'RETURN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS lines (
    id SERIAL PRIMARY KEY,
    code VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    color VARCHAR(255),
    geo_json JSONB,
    geom geometry(MultiLineString, 4326),
    sense line_sense_enum DEFAULT 'OUTBOUND',
    parent_line_id INTEGER REFERENCES lines(id) ON DELETE SET NULL,
    syndicate VARCHAR(255),
    objectid INTEGER,
    average_rating DECIMAL(3,2) DEFAULT NULL,
    total_reviews INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lines_code ON lines(code);
CREATE INDEX IF NOT EXISTS idx_lines_parent_line_id ON lines(parent_line_id);

-- PostGIS geometry column for spatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

UPDATE lines SET geom = ST_GeomFromGeoJSON(geo_json::text) WHERE geo_json IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lines_geom ON lines USING GIST(geom);
