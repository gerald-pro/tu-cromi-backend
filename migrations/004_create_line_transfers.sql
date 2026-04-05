-- Migration: Create line_transfers table
-- Created: 2026-04-04

CREATE TABLE IF NOT EXISTS line_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_a_id UUID NOT NULL REFERENCES lines(id) ON DELETE CASCADE,
    line_b_id UUID NOT NULL REFERENCES lines(id) ON DELETE CASCADE,
    point_a_lng FLOAT NOT NULL,
    point_a_lat FLOAT NOT NULL,
    point_a_index INTEGER NOT NULL,
    point_b_lng FLOAT NOT NULL,
    point_b_lat FLOAT NOT NULL,
    point_b_index INTEGER NOT NULL,
    walk_distance FLOAT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_line_transfers_line_a_line_b 
ON line_transfers(line_a_id, line_b_id);

CREATE INDEX IF NOT EXISTS idx_line_transfers_line_b_line_a 
ON line_transfers(line_b_id, line_a_id);
