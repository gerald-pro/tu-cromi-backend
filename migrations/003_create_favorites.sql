-- Migration: Create favorites and reviews tables
-- Created: 2026-04-04

DROP TABLE IF EXISTS favorites CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;

CREATE TABLE favorites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    line_id INTEGER NOT NULL REFERENCES lines(id) ON DELETE CASCADE,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_favorites_user_id ON favorites(user_id);
CREATE INDEX idx_favorites_line_id ON favorites(line_id);
CREATE UNIQUE INDEX idx_favorites_user_line ON favorites(user_id, line_id);

CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    line_id INTEGER NOT NULL REFERENCES lines(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL,
    comment VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP DEFAULT NULL
);

CREATE UNIQUE INDEX idx_reviews_user_line ON reviews(user_id, line_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_reviews_line_id ON reviews(line_id);
