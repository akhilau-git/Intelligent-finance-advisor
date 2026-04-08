-- ============================================================
--  FinSight IFOS — Database Schema
--  Run in Supabase SQL Editor: Settings → SQL Editor → New query
--  Run 001 first, then 002
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── USERS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_id            TEXT UNIQUE NOT NULL,
  email               TEXT UNIQUE NOT NULL,
  full_name           TEXT NOT NULL,
  role                TEXT NOT NULL DEFAULT 'employee'
                        CHECK (role IN ('employee','manager','auditor','cfo','admin')),
  department          TEXT,
  employee_id         TEXT UNIQUE,
  manager_id          UUID REFERENCES users(id),
  biometric_enrolled  BOOLEAN DEFAULT FALSE,
  gamification_points INTEGER DEFAULT 0,
  integrity_level     TEXT DEFAULT 'bronze'
                        CHECK (integrity_level IN ('bronze','silver','gold','platinum')),
  slack_user_id       TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── CLAIMS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS claims (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receipt_image_url   TEXT,
  receipt_hash        TEXT,
  merchant_name       TEXT,
  merchant_id         TEXT,
  expense_date        DATE,
  category            TEXT DEFAULT 'other'
                        CHECK (category IN ('travel','meals','accommodation','supplies','tech','medical','utilities','other')),
  subtotal            NUMERIC(12,2),
  tax_rate            NUMERIC(5,4),
  tax_amount          NUMERIC(12,2),
  total_amount        NUMERIC(12,2),
  currency            TEXT DEFAULT 'INR',
  status              TEXT DEFAULT 'draft'
                        CHECK (status IN ('draft','submitted','validated','review','approved','rejected','paid')),
  ocr_confidence      NUMERIC(5,4),
  authenticity_score  TEXT DEFAULT 'yellow'
                        CHECK (authenticity_score IN ('green','yellow','red')),
  fraud_score         NUMERIC(5,4) DEFAULT 0,
  fraud_flags         JSONB DEFAULT '[]',
  carbon_kg           NUMERIC(8,4) DEFAULT 0,
  notes               TEXT,
  rejection_reason    TEXT,
  policy_violations   JSONB DEFAULT '[]',
  approved_by         UUID REFERENCES users(id),
  approved_at         TIMESTAMPTZ,
  paid_at             TIMESTAMPTZ,
  smart_contract_tx   TEXT,
  audit_hash          TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── AUDIT LOG (SHA-256 hash chain) ───────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id        UUID REFERENCES claims(id) ON DELETE CASCADE,
  action          TEXT NOT NULL,
  performed_by    UUID REFERENCES users(id),
  old_value       JSONB,
  new_value       JSONB,
  hash            TEXT,
  previous_hash   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── EXPENSE POLICIES (Regulatory-as-Code) ────────────────────
CREATE TABLE IF NOT EXISTS policies (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                      TEXT NOT NULL,
  category                  TEXT,
  max_amount                NUMERIC(12,2),
  requires_approval_above   NUMERIC(12,2),
  allowed_currencies        TEXT[] DEFAULT ARRAY['INR'],
  weekend_claims_allowed    BOOLEAN DEFAULT FALSE,
  advance_submission_days   INTEGER DEFAULT 30,
  is_active                 BOOLEAN DEFAULT TRUE,
  created_at                TIMESTAMPTZ DEFAULT NOW()
);

-- ── NOTIFICATIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  claim_id    UUID REFERENCES claims(id),
  is_read     BOOLEAN DEFAULT FALSE,
  channel     TEXT DEFAULT 'app',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── GAMIFICATION ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gamification_events (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type     TEXT NOT NULL,
  points_awarded INTEGER NOT NULL,
  claim_id       UUID REFERENCES claims(id),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── VENDOR INSIGHTS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_insights (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_name          TEXT NOT NULL,
  merchant_id            TEXT,
  total_spend            NUMERIC(12,2) DEFAULT 0,
  claim_count            INTEGER DEFAULT 0,
  avg_claim_amount       NUMERIC(12,2),
  negotiation_potential  TEXT,
  last_updated           TIMESTAMPTZ DEFAULT NOW()
);

-- ── AUTO-UPDATE updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS claims_updated_at ON claims;
CREATE TRIGGER claims_updated_at
  BEFORE UPDATE ON claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── DEFAULT EXPENSE POLICIES (Regulatory-as-Code) ────────────
INSERT INTO policies (name, category, max_amount, requires_approval_above, weekend_claims_allowed) VALUES
  ('Travel Policy',        'travel',        50000, 10000, FALSE),
  ('Meals Policy',         'meals',          2000,  1000, FALSE),
  ('Accommodation Policy', 'accommodation', 10000,  5000, FALSE),
  ('Supplies Policy',      'supplies',       5000,  2000, FALSE),
  ('Tech / Software',      'tech',          25000, 10000, FALSE),
  ('Medical Policy',       'medical',       10000,  3000, TRUE),
  ('Utilities Policy',     'utilities',      5000,  2000, FALSE),
  ('General Policy',       'other',         10000,  5000, FALSE)
ON CONFLICT DO NOTHING;
