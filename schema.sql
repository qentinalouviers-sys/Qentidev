CREATE TABLE players (
  email          TEXT PRIMARY KEY,
  pseudo         TEXT NOT NULL,
  best           INTEGER NOT NULL DEFAULT 0,
  best_pizzas    INTEGER NOT NULL DEFAULT 0,
  best_at        TEXT,
  newsletter     INTEGER NOT NULL DEFAULT 0,
  tiramisu_code  TEXT,
  hidden         INTEGER NOT NULL DEFAULT 0,
  plays          INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL,
  last_play_at   TEXT
);
CREATE UNIQUE INDEX players_pseudo ON players (pseudo COLLATE NOCASE);
CREATE INDEX players_rank ON players (hidden, best DESC, best_at);

CREATE TABLE plays (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT NOT NULL,
  score       INTEGER NOT NULL,
  pizzas      INTEGER NOT NULL,
  day         TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX plays_day ON plays (day, score DESC);

CREATE TABLE wheel_spins (
  email       TEXT PRIMARY KEY,
  result      TEXT NOT NULL,
  code        TEXT,
  newsletter  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);
CREATE INDEX wheel_result ON wheel_spins (result);

CREATE TABLE wheel_lots (
  id        INTEGER PRIMARY KEY,
  kind      TEXT NOT NULL,
  instant   TEXT NOT NULL,
  drawn_at  TEXT NOT NULL,
  email     TEXT,
  won_at    TEXT
);
