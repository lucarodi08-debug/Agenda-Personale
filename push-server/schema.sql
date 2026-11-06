CREATE TABLE IF NOT EXISTS subs (
  id TEXT PRIMARY KEY,            -- SHA-256 dell'indirizzo di notifica del dispositivo
  endpoint TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS reminders (
  sub_id TEXT NOT NULL, rid TEXT NOT NULL, at INTEGER NOT NULL,
  title TEXT NOT NULL, body TEXT NOT NULL, tag TEXT NOT NULL, sent INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (sub_id, rid, at));
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders (sent, at);
