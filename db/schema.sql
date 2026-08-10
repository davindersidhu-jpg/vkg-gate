-- VKG Gate Management Database Schema

CREATE TABLE IF NOT EXISTS sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  location TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

-- A Wing groups Flats within a Site (e.g. "Wing A" at "VKG Park Estate")
CREATE TABLE IF NOT EXISTS wings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

-- A Flat belongs to a Wing. owner_name/owner_phone are just record-keeping;
-- an actual login (in users, role='owner') is optional and separate, created
-- from the Wings & Flats admin page once you want the owner to log in and
-- approve visitor entries themselves.
CREATE TABLE IF NOT EXISTS flats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wing_id INTEGER NOT NULL REFERENCES wings(id),
  flat_number TEXT NOT NULL,
  owner_name TEXT,
  owner_phone TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','guard','owner')),
  site_id INTEGER REFERENCES sites(id),   -- used for admin/guard
  flat_id INTEGER REFERENCES flats(id),   -- used for role='owner'
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  entry_type TEXT NOT NULL CHECK(entry_type IN ('staff','visitor')),
  category TEXT NOT NULL,          -- Security, Housekeeping, MST, Pantry | Maid, Driver, Delivery, Guest
  person_name TEXT NOT NULL,
  phone TEXT,
  host_department TEXT,            -- department for staff, or free-text host note for visitors
  flat_id INTEGER REFERENCES flats(id), -- set when the visitor is going to a specific flat
  approval_status TEXT CHECK(approval_status IN ('pending','approved','rejected') OR approval_status IS NULL),
  approved_by INTEGER REFERENCES users(id),
  approved_at TEXT,
  has_vehicle INTEGER NOT NULL DEFAULT 0,
  vehicle_number TEXT,
  vehicle_type TEXT CHECK(vehicle_type IN ('2W','4W', NULL)),
  purpose TEXT,
  in_time TEXT NOT NULL DEFAULT (datetime('now')),
  out_time TEXT,
  status TEXT NOT NULL DEFAULT 'Inside' CHECK(status IN ('Inside','Checked-out')),
  created_by INTEGER REFERENCES users(id),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_entries_site ON entries(site_id);
CREATE INDEX IF NOT EXISTS idx_entries_status ON entries(status);
CREATE INDEX IF NOT EXISTS idx_entries_intime ON entries(in_time);
CREATE INDEX IF NOT EXISTS idx_entries_flat ON entries(flat_id);
CREATE INDEX IF NOT EXISTS idx_flats_wing ON flats(wing_id);
CREATE INDEX IF NOT EXISTS idx_wings_site ON wings(site_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
