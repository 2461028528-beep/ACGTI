CREATE TABLE IF NOT EXISTS test_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id TEXT NOT NULL UNIQUE,
  character_name TEXT NOT NULL,
  mbti TEXT NOT NULL,
  matching_score REAL,
  e_i_score REAL NOT NULL,
  s_n_score REAL NOT NULL,
  t_f_score REAL NOT NULL,
  j_p_score REAL NOT NULL,
  dignity_score REAL,
  youth_score REAL,
  stability_score REAL,
  morality_score REAL,
  origin_score REAL,
  scheming_score REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_test_results_character_name
  ON test_results (character_name);

CREATE INDEX IF NOT EXISTS idx_test_results_mbti
  ON test_results (mbti);

CREATE INDEX IF NOT EXISTS idx_test_results_created_at
  ON test_results (created_at);
