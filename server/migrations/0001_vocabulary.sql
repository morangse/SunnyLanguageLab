-- seq advances for every winning insert/update, including deletions.
-- Tombstones are retained so long-offline devices cannot resurrect deleted words.
CREATE TABLE IF NOT EXISTS vocabulary (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  clock INTEGER NOT NULL CHECK(clock > 0),
  device_id TEXT NOT NULL,
  deleted INTEGER NOT NULL CHECK(deleted IN (0, 1)),
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS archive_state (
  singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
  revision INTEGER NOT NULL DEFAULT 0,
  archived_at INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT '',
  lock_id TEXT NOT NULL DEFAULT '',
  lock_until INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO archive_state(singleton) VALUES (1);
