-- Schema for Smart Profiling and Complaint Management System
-- Run via: npm run migrate  (see backend/db/migrate.js)

CREATE TABLE IF NOT EXISTS admins (
  id                TEXT PRIMARY KEY,
  institutional_id  TEXT UNIQUE NOT NULL,
  full_name         TEXT NOT NULL,
  email             TEXT UNIQUE NOT NULL,
  department        TEXT,
  password_hash     TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending',
  role              TEXT NOT NULL DEFAULT 'Administrator',
  photo_url         TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS access_requests (
  id                TEXT PRIMARY KEY,
  full_name         TEXT NOT NULL,
  email             TEXT UNIQUE NOT NULL,
  department        TEXT,
  employee_id       TEXT NOT NULL,
  password_hash     TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending',
  requested_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS residents (
  id                    TEXT PRIMARY KEY,
  full_name             TEXT NOT NULL,
  birth_date            DATE,
  age                   INT,
  gender                TEXT,
  occupation            TEXT,
  address               TEXT NOT NULL,
  zone                  TEXT,
  residency_years       INT DEFAULT 0,
  contact               TEXT,
  email                 TEXT,
  status                TEXT NOT NULL DEFAULT 'Pending',
  category              JSONB NOT NULL DEFAULT '[]',
  education             TEXT,
  blood_type            TEXT,
  place_of_birth        TEXT,
  spouse                TEXT,
  household             JSONB NOT NULL DEFAULT '[]',
  photo_url             TEXT,
  -- Resident portal self-service account fields
  password_hash         TEXT,
  civil_status           TEXT,
  id_document_url       TEXT,
  community_points      INT NOT NULL DEFAULT 0,
  tier                  TEXT NOT NULL DEFAULT 'Member',
  push_notifications    BOOLEAN NOT NULL DEFAULT true,
  email_announcements   BOOLEAN NOT NULL DEFAULT true,
  two_factor_enabled    BOOLEAN NOT NULL DEFAULT false,
  language              TEXT NOT NULL DEFAULT 'English (US)',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS complaints (
  id                    TEXT PRIMARY KEY,
  resident              TEXT NOT NULL,
  category              TEXT,
  status                TEXT NOT NULL DEFAULT 'Pending',
  filing_date           DATE NOT NULL DEFAULT CURRENT_DATE,
  description           TEXT,
  priority              TEXT NOT NULL DEFAULT 'Normal',
  ai_scan_status        TEXT NOT NULL DEFAULT 'not_scanned',
  ai_scan_score         NUMERIC,
  ai_scan_checked_at    TIMESTAMPTZ,
  -- Formal blotter / resident-portal fields
  respondent            TEXT,
  respondent_address    TEXT,
  complainant_address   TEXT,
  narrative             TEXT,
  relief_sought         TEXT,
  attachment_url        TEXT,
  filed_by_resident_id  TEXT REFERENCES residents(id) ON DELETE SET NULL,
  under_review_at       TIMESTAMPTZ,
  resolved_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS announcements (
  id                TEXT PRIMARY KEY,
  title             TEXT NOT NULL,
  tag               TEXT,
  body              TEXT,
  event_date        DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meetings (
  id                TEXT PRIMARY KEY,
  title             TEXT NOT NULL,
  date              DATE,
  time              TEXT,
  location          TEXT,
  attendees         JSONB NOT NULL DEFAULT '[]',
  agenda            JSONB NOT NULL DEFAULT '[]',
  minutes           TEXT DEFAULT '',
  resolutions       JSONB NOT NULL DEFAULT '[]',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS escalations (
  id                TEXT PRIMARY KEY,
  category          TEXT,
  reason            TEXT,
  priority          TEXT NOT NULL DEFAULT 'Medium',
  overseer          TEXT NOT NULL DEFAULT 'Unassigned',
  status            TEXT NOT NULL DEFAULT 'Under Review',
  escalated         DATE NOT NULL DEFAULT CURRENT_DATE,
  to_department     TEXT,
  to_recipient      TEXT,
  subject           TEXT,
  body              TEXT,
  case_ref          TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
