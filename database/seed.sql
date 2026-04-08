-- ============================================================
--  FinSight IFOS — Demo Seed Data
--  Run AFTER signing up in the app (so real user IDs exist)
-- ============================================================

DO $$
DECLARE
  mgr_id   UUID;
  emp1_id  UUID;
  emp2_id  UUID;
BEGIN
  SELECT id INTO mgr_id  FROM users WHERE role = 'manager' LIMIT 1;
  SELECT id INTO emp1_id FROM users WHERE role = 'employee' ORDER BY created_at ASC   LIMIT 1;
  SELECT id INTO emp2_id FROM users WHERE role = 'employee' ORDER BY created_at DESC  LIMIT 1;

  IF mgr_id  IS NULL THEN SELECT id INTO mgr_id  FROM users ORDER BY created_at LIMIT 1; END IF;
  IF emp1_id IS NULL THEN emp1_id := mgr_id; END IF;
  IF emp2_id IS NULL THEN emp2_id := mgr_id; END IF;

  -- Approved claims
  INSERT INTO claims (employee_id, merchant_name, expense_date, category, subtotal, tax_rate, tax_amount, total_amount, status, authenticity_score, fraud_score, carbon_kg) VALUES
    (emp1_id, 'Taj Hotels Mumbai',      CURRENT_DATE - 5,  'accommodation', 8474.58, 0.18, 1525.42, 10000.00, 'approved', 'green', 0.02, 31.50),
    (emp1_id, 'IndiGo Airlines',        CURRENT_DATE - 12, 'travel',        3389.83, 0.18,  610.17,  4000.00, 'approved', 'green', 0.05, 51.00),
    (emp2_id, 'Cafe Coffee Day',        CURRENT_DATE - 3,  'meals',          423.73, 0.18,   76.27,   500.00, 'approved', 'green', 0.00,  1.25),
    (emp2_id, 'Amazon Business India',  CURRENT_DATE - 8,  'supplies',      1694.92, 0.18,  305.08,  2000.00, 'approved', 'green', 0.01,  0.50),
    (emp1_id, 'Uber Technologies',      CURRENT_DATE - 2,  'travel',         211.86, 0.18,   38.14,   250.00, 'approved', 'green', 0.00,  0.84),
    (emp2_id, 'Apollo Pharmacy',        CURRENT_DATE - 6,  'medical',        847.46, 0.12,  102.54,   950.00, 'approved', 'green', 0.00,  0.19);

  -- Pending claims
  INSERT INTO claims (employee_id, merchant_name, expense_date, category, subtotal, tax_rate, tax_amount, total_amount, status, authenticity_score, fraud_score) VALUES
    (emp1_id, 'Air India',             CURRENT_DATE - 1, 'travel',        5084.75, 0.18, 915.25,  6000.00, 'validated', 'green',  0.05),
    (emp2_id, 'OYO Rooms Bangalore',   CURRENT_DATE - 4, 'accommodation', 2542.37, 0.18, 457.63,  3000.00, 'validated', 'green',  0.08),
    (emp1_id, 'Zomato Business',       CURRENT_DATE - 1, 'meals',          677.97, 0.18, 122.03,   800.00, 'validated', 'yellow', 0.18);

  -- High-risk fraud demo claims
  INSERT INTO claims (employee_id, merchant_name, expense_date, category, subtotal, tax_rate, tax_amount, total_amount, status, authenticity_score, fraud_score, fraud_flags) VALUES
    (emp1_id, 'Unknown Vendor Ltd',
     CURRENT_DATE - 45, 'other', 5000.00, 0.18, 500.00, 5000.00,
     'review', 'red', 0.85,
     '[{"signal":"DUPLICATE_RECEIPT","score":0.70,"detail":"Hash matches existing claim"},{"signal":"OLD_RECEIPT","score":0.10,"detail":"45 days old"},{"signal":"MATH_MISMATCH","score":0.25,"detail":"500+5000≠5000"}]'::jsonb),

    (emp2_id, 'Cash Refund Services',
     CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::int),
     'other', 3000.00, 0.18, 540.00, 3540.00,
     'review', 'yellow', 0.65,
     '[{"signal":"WEEKEND_EXPENSE","score":0.20,"detail":"Expense on Sunday"},{"signal":"SPENDING_SPIKE","score":0.30,"detail":"3.2x average"},{"signal":"ROUND_NUMBER","score":0.15,"detail":"₹3000 round"}]'::jsonb);

  RAISE NOTICE 'Demo data seeded. Manager: %, Emp1: %, Emp2: %', mgr_id, emp1_id, emp2_id;
END $$;
