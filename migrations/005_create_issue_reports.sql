CREATE TABLE IF NOT EXISTS issue_reports (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  line_id INTEGER REFERENCES lines(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  location JSONB,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  admin_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX idx_issue_reports_user_id ON issue_reports(user_id);
CREATE INDEX idx_issue_reports_line_id ON issue_reports(line_id);
CREATE INDEX idx_issue_reports_status ON issue_reports(status);
CREATE INDEX idx_issue_reports_type ON issue_reports(type);
