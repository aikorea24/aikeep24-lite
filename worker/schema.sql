-- 사용자 테이블
CREATE TABLE IF NOT EXISTS ext_users (
  user_id    TEXT PRIMARY KEY,
  email      TEXT UNIQUE,
  plan       TEXT NOT NULL DEFAULT 'free',
  api_key    TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT
);

-- 세션 테이블
CREATE TABLE IF NOT EXISTS ext_sessions (
  session_id  TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  platform    TEXT NOT NULL DEFAULT '',
  url         TEXT NOT NULL DEFAULT '',
  title       TEXT NOT NULL DEFAULT '',
  total_turns INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON ext_sessions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_url  ON ext_sessions(url);

-- 청크 테이블
CREATE TABLE IF NOT EXISTS ext_chunks (
  chunk_id    TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  platform    TEXT NOT NULL DEFAULT '',
  raw_content TEXT NOT NULL DEFAULT '',
  raw_ngrams  TEXT NOT NULL DEFAULT '',
  turn_start  INTEGER NOT NULL DEFAULT 0,
  turn_end    INTEGER NOT NULL DEFAULT 0,
  session_url TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES ext_sessions(session_id)
);
CREATE INDEX IF NOT EXISTS idx_chunks_user    ON ext_chunks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chunks_session ON ext_chunks(session_id);

-- FTS5 전문 검색 (한국어 n-gram + 영문)
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  raw_content,
  raw_ngrams,
  content='ext_chunks',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 1'
);

-- FTS 트리거: 청크 insert/update/delete 시 자동 동기화
CREATE TRIGGER IF NOT EXISTS chunks_fts_insert AFTER INSERT ON ext_chunks BEGIN
  INSERT INTO chunks_fts(rowid, raw_content, raw_ngrams)
  VALUES (new.rowid, new.raw_content, new.raw_ngrams);
END;

CREATE TRIGGER IF NOT EXISTS chunks_fts_delete AFTER DELETE ON ext_chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, raw_content, raw_ngrams)
  VALUES ('delete', old.rowid, old.raw_content, old.raw_ngrams);
END;

CREATE TRIGGER IF NOT EXISTS chunks_fts_update AFTER UPDATE ON ext_chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, raw_content, raw_ngrams)
  VALUES ('delete', old.rowid, old.raw_content, old.raw_ngrams);
  INSERT INTO chunks_fts(rowid, raw_content, raw_ngrams)
  VALUES (new.rowid, new.raw_content, new.raw_ngrams);
END;
