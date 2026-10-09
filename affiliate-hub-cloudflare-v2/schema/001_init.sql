PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  host TEXT UNIQUE COLLATE NOCASE,
  theme_color TEXT NOT NULL DEFAULT '#4f46e5',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  market TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  image TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  why TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  sub_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('published','draft')),
  clicks INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_products_site_status_date ON products(site_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_site_cat ON products(site_id,category);
CREATE INDEX IF NOT EXISTS idx_products_site_market ON products(site_id,market);
CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  public_id TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  bytes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  site_id TEXT,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  item_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT OR IGNORE INTO sites (id,slug,name,tagline) VALUES ('site_main','main','Affiliate Hub','รวมลิงก์สินค้าโปรโมชัน');
