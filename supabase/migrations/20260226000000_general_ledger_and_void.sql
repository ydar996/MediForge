-- General Ledger and Void/Reversal support
-- Adds: gl_accounts, cost_centers, journal_entries, payment status 'voided'

-- 1. Cost centers (departments)
CREATE TABLE IF NOT EXISTS gl_cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, code)
);

-- 2. GL accounts (chart of accounts)
CREATE TABLE IF NOT EXISTS gl_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL, -- income, expense, asset, liability, equity
  cost_center_id UUID REFERENCES gl_cost_centers(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, code)
);

-- 3. Journal entries
CREATE TABLE IF NOT EXISTS gl_journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  entry_date DATE NOT NULL,
  reference_type TEXT, -- payment, invoice, manual, adjustment
  reference_id TEXT,   -- payment_id, invoice_id, etc.
  description TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Journal entry lines (debit/credit)
CREATE TABLE IF NOT EXISTS gl_journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES gl_journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES gl_accounts(id),
  debit DECIMAL(10,2) DEFAULT 0,
  credit DECIMAL(10,2) DEFAULT 0,
  description TEXT,
  cost_center_id UUID REFERENCES gl_cost_centers(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_debit_credit CHECK ((debit >= 0 AND credit >= 0) AND (debit = 0 OR credit = 0))
);

-- 5. Add voided_at to billing_payments if not exists (for void tracking)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'billing_payments' AND column_name = 'voided_at'
  ) THEN
    ALTER TABLE billing_payments ADD COLUMN voided_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'billing_payments' AND column_name = 'voided_by'
  ) THEN
    ALTER TABLE billing_payments ADD COLUMN voided_by TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'billing_payments' AND column_name = 'void_reason'
  ) THEN
    ALTER TABLE billing_payments ADD COLUMN void_reason TEXT;
  END IF;
END $$;

-- RLS
ALTER TABLE gl_cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl_journal_lines ENABLE ROW LEVEL SECURITY;

-- Policies: org-scoped access (users.id or users.auth_user_id)
CREATE POLICY "gl_cost_centers_org" ON gl_cost_centers FOR ALL USING (
  organization_id IN (SELECT organization_id FROM users WHERE users.id = auth.uid() OR users.auth_user_id = auth.uid())
);
CREATE POLICY "gl_accounts_org" ON gl_accounts FOR ALL USING (
  organization_id IN (SELECT organization_id FROM users WHERE users.id = auth.uid() OR users.auth_user_id = auth.uid())
);
CREATE POLICY "gl_journal_entries_org" ON gl_journal_entries FOR ALL USING (
  organization_id IN (SELECT organization_id FROM users WHERE users.id = auth.uid() OR users.auth_user_id = auth.uid())
);
CREATE POLICY "gl_journal_lines_via_entry" ON gl_journal_lines FOR ALL USING (
  journal_entry_id IN (
    SELECT je.id FROM gl_journal_entries je
    JOIN users u ON u.organization_id = je.organization_id
    WHERE u.id = auth.uid() OR u.auth_user_id = auth.uid()
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gl_journal_entries_org_date ON gl_journal_entries(organization_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_gl_journal_lines_entry ON gl_journal_lines(journal_entry_id);
