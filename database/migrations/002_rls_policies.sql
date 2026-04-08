-- ============================================================
--  FinSight IFOS — Row Level Security Policies
--  Run AFTER 001_initial_schema.sql
-- ============================================================

ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims             ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_insights    ENABLE ROW LEVEL SECURITY;

-- NOTE: FastAPI backend uses service_role key — bypasses ALL RLS.
-- These policies apply only to anon key (frontend direct queries).

CREATE POLICY "users_all"       ON users              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "claims_all"      ON claims             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "audit_all"       ON audit_log          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "policies_read"   ON policies           FOR SELECT USING (true);
CREATE POLICY "notif_all"       ON notifications      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "gamif_all"       ON gamification_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "vendor_all"      ON vendor_insights    FOR ALL USING (true) WITH CHECK (true);
