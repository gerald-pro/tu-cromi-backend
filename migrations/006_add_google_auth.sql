-- Migration: Add Google auth support
-- Created: 2026-06-14

ALTER TABLE users ADD COLUMN google_id VARCHAR(255) UNIQUE;
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;
