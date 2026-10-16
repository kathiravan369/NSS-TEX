-- NSS TOWELS / TexMan ERP Database Schema for PostgreSQL
-- Database: nss_towels
-- Owner: postgres

CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  emp_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  join_date DATE NOT NULL DEFAULT CURRENT_DATE,
  work_type VARCHAR(100) DEFAULT 'Day Salary',
  work_types JSONB DEFAULT '["Day Salary"]'::jsonb,
  daily_rate NUMERIC(12,2) DEFAULT 0,
  piece_rate NUMERIC(12,2) DEFAULT 0,
  product_type VARCHAR(100) DEFAULT '',
  size_rates JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(20) DEFAULT 'Active',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_emp_id ON employees(emp_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);

CREATE TABLE IF NOT EXISTS thread_purchases (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  supplier VARCHAR(255) NOT NULL,
  thread_type VARCHAR(100) NOT NULL,
  qty NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit VARCHAR(20) DEFAULT 'Kg',
  rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  gst_mode VARCHAR(30) DEFAULT 'WITH_GST',
  gst_rate NUMERIC(6,2) DEFAULT 0,
  subtotal NUMERIC(12,2) DEFAULT 0,
  gst_amount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  paid_amount NUMERIC(12,2) DEFAULT 0,
  balance_amount NUMERIC(12,2) DEFAULT 0,
  paid_at TIMESTAMPTZ,
  invoice_no VARCHAR(100) DEFAULT '',
  status VARCHAR(30) DEFAULT 'Paid',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_thread_purchases_date ON thread_purchases(date);
CREATE INDEX IF NOT EXISTS idx_thread_purchases_supplier ON thread_purchases(supplier);

CREATE TABLE IF NOT EXISTS oil_purchases (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  oil_type VARCHAR(100) NOT NULL,
  supplier VARCHAR(255) NOT NULL,
  qty NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit VARCHAR(20) DEFAULT 'Litre',
  rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost NUMERIC(12,2) DEFAULT 0,
  include_gst BOOLEAN DEFAULT TRUE,
  gst_rate NUMERIC(6,2) DEFAULT 5,
  gst NUMERIC(12,2) DEFAULT 0,
  final NUMERIC(12,2) DEFAULT 0,
  paid_amount NUMERIC(12,2) DEFAULT 0,
  balance_amount NUMERIC(12,2) DEFAULT 0,
  paid_at TIMESTAMPTZ,
  invoice_no VARCHAR(100) DEFAULT '',
  status VARCHAR(30) DEFAULT 'Pending',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oil_purchases_date ON oil_purchases(date);

CREATE TABLE IF NOT EXISTS oil_stock (
  id SERIAL PRIMARY KEY,
  type VARCHAR(100) UNIQUE NOT NULL,
  stock NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit VARCHAR(20) DEFAULT 'Ltr',
  low_stock_threshold NUMERIC(12,2) DEFAULT 50,
  is_low BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS machinery_expenses (
  id SERIAL PRIMARY KEY,
  machine VARCHAR(255) NOT NULL,
  machine_id VARCHAR(100) DEFAULT '',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  category VARCHAR(100) NOT NULL DEFAULT 'Maintenance',
  description TEXT NOT NULL DEFAULT '',
  qty NUMERIC(12,2) DEFAULT 1,
  unit VARCHAR(20) DEFAULT 'Nos',
  cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) DEFAULT 0,
  include_gst BOOLEAN DEFAULT TRUE,
  gst_rate NUMERIC(6,2) DEFAULT 18,
  gst NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  paid_amount NUMERIC(12,2) DEFAULT 0,
  balance_amount NUMERIC(12,2) DEFAULT 0,
  paid_at TIMESTAMPTZ,
  vendor VARCHAR(255) DEFAULT '',
  invoice_no VARCHAR(100) DEFAULT '',
  status VARCHAR(30) DEFAULT 'Pending',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_machinery_expenses_date ON machinery_expenses(date);

CREATE TABLE IF NOT EXISTS electricity_expenses (
  id SERIAL PRIMARY KEY,
  month VARCHAR(50) NOT NULL,
  bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  prev NUMERIC(12,2) NOT NULL DEFAULT 0,
  curr NUMERIC(12,2) NOT NULL DEFAULT 0,
  units NUMERIC(12,2) DEFAULT 0,
  rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  fixed NUMERIC(12,2) DEFAULT 0,
  additional NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  paid_amount NUMERIC(12,2) DEFAULT 0,
  balance_amount NUMERIC(12,2) DEFAULT 0,
  paid_at TIMESTAMPTZ,
  status VARCHAR(30) DEFAULT 'Pending',
  pay_date DATE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_electricity_expenses_bill_date ON electricity_expenses(bill_date);

CREATE TABLE IF NOT EXISTS weekly_payroll (
  id SERIAL PRIMARY KEY,
  emp_id VARCHAR(50) NOT NULL,
  employee_name VARCHAR(255) NOT NULL,
  work_type VARCHAR(100) NOT NULL DEFAULT 'Day Salary',
  product_name VARCHAR(100) DEFAULT 'Towel',
  work_date DATE DEFAULT CURRENT_DATE,
  price_per_item NUMERIC(12,2) DEFAULT 0,
  count_quantity NUMERIC(12,2) DEFAULT 0,
  large_quantity NUMERIC(12,2) DEFAULT 0,
  large_price NUMERIC(12,2) DEFAULT 5,
  medium_quantity NUMERIC(12,2) DEFAULT 0,
  medium_price NUMERIC(12,2) DEFAULT 4,
  small_quantity NUMERIC(12,2) DEFAULT 0,
  small_price NUMERIC(12,2) DEFAULT 3,
  size_wise_rates JSONB DEFAULT '[]'::jsonb,
  size_wise_production JSONB DEFAULT '[]'::jsonb,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  daily_records JSONB DEFAULT '[]'::jsonb,
  days_worked NUMERIC(6,2) DEFAULT 0,
  leave_days NUMERIC(6,2) DEFAULT 0,
  hours_worked NUMERIC(6,2) DEFAULT 0,
  products_produced NUMERIC(12,2) DEFAULT 0,
  rate NUMERIC(12,2) DEFAULT 0,
  gross_pay NUMERIC(12,2) DEFAULT 0,
  deductions NUMERIC(12,2) DEFAULT 0,
  adjustments NUMERIC(12,2) DEFAULT 0,
  net_pay NUMERIC(12,2) DEFAULT 0,
  paid_amount NUMERIC(12,2) DEFAULT 0,
  balance_amount NUMERIC(12,2) DEFAULT 0,
  paid_at TIMESTAMPTZ,
  remarks TEXT DEFAULT '',
  status VARCHAR(30) DEFAULT 'Pending',
  payment_date DATE,
  is_finalized BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weekly_payroll_emp_id ON weekly_payroll(emp_id);
CREATE INDEX IF NOT EXISTS idx_weekly_payroll_week_start ON weekly_payroll(week_start);
CREATE INDEX IF NOT EXISTS idx_weekly_payroll_week_end ON weekly_payroll(week_end);

-- Migrations for existing tables
ALTER TABLE thread_purchases ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE thread_purchases ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE thread_purchases ADD COLUMN IF NOT EXISTS balance_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE thread_purchases ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE oil_purchases ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE oil_purchases ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE oil_purchases ADD COLUMN IF NOT EXISTS balance_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE oil_purchases ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE oil_purchases ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'Pending';

ALTER TABLE machinery_expenses ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE machinery_expenses ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE machinery_expenses ADD COLUMN IF NOT EXISTS balance_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE machinery_expenses ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE machinery_expenses ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'Pending';

ALTER TABLE electricity_expenses ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE electricity_expenses ADD COLUMN IF NOT EXISTS balance_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE electricity_expenses ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE weekly_payroll ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE weekly_payroll ADD COLUMN IF NOT EXISTS balance_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE weekly_payroll ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
