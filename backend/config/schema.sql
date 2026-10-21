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
  items JSONB DEFAULT '[]'::jsonb,
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
  items JSONB DEFAULT '[]'::jsonb,
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
ALTER TABLE oil_purchases ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;

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

-- Sales Module Tables
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  customer_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  customer_type VARCHAR(50) DEFAULT 'Business',
  phone VARCHAR(50) NOT NULL,
  alternate_phone VARCHAR(50) DEFAULT '',
  email VARCHAR(255) DEFAULT '',
  company_name VARCHAR(255) DEFAULT '',
  gstin VARCHAR(50) DEFAULT '',
  pan VARCHAR(50) DEFAULT '',
  customer_category VARCHAR(50) DEFAULT 'Regular',
  billing_address JSONB DEFAULT '{"addressLine":"","city":"","state":"","pincode":"","country":"India"}'::jsonb,
  shipping_address JSONB DEFAULT '{"addressLine":"","city":"","state":"","pincode":"","country":"India"}'::jsonb,
  same_as_billing BOOLEAN DEFAULT TRUE,
  opening_balance NUMERIC(14,2) DEFAULT 0,
  opening_balance_type VARCHAR(10) DEFAULT 'Debit',
  credit_limit NUMERIC(14,2) DEFAULT 0,
  payment_terms VARCHAR(50) DEFAULT '30 Days',
  price_list VARCHAR(50) DEFAULT 'Standard',
  notes TEXT DEFAULT '',
  tags JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(20) DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_customer_id ON customers(customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_gstin ON customers(gstin);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);

CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  invoice_no VARCHAR(100) UNIQUE NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  reference_no VARCHAR(100) DEFAULT '',
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_code VARCHAR(50) DEFAULT '',
  customer_name VARCHAR(255) DEFAULT '',
  customer_snapshot JSONB DEFAULT '{}'::jsonb,
  vehicle_no VARCHAR(50) DEFAULT '',
  po_number VARCHAR(100) DEFAULT '',
  challan_no VARCHAR(100) DEFAULT '',
  delivery_date DATE,
  salesperson VARCHAR(100) DEFAULT '',
  dispatch_no VARCHAR(100) DEFAULT '',
  items JSONB DEFAULT '[]'::jsonb,
  subtotal NUMERIC(14,2) DEFAULT 0,
  item_discount NUMERIC(14,2) DEFAULT 0,
  extra_discount NUMERIC(14,2) DEFAULT 0,
  taxable_amount NUMERIC(14,2) DEFAULT 0,
  cgst_amount NUMERIC(14,2) DEFAULT 0,
  sgst_amount NUMERIC(14,2) DEFAULT 0,
  igst_amount NUMERIC(14,2) DEFAULT 0,
  gst_amount NUMERIC(14,2) DEFAULT 0,
  round_off NUMERIC(6,2) DEFAULT 0,
  grand_total NUMERIC(14,2) DEFAULT 0,
  amount_paid NUMERIC(14,2) DEFAULT 0,
  balance_due NUMERIC(14,2) DEFAULT 0,
  payment_status VARCHAR(30) DEFAULT 'Unpaid',
  invoice_status VARCHAR(30) DEFAULT 'Draft',
  notes TEXT DEFAULT '',
  terms TEXT DEFAULT '',
  bank_details JSONB DEFAULT '{"bankName":"State Bank of India","accountName":"NSS TOWELS & TEXTILES","accountNumber":"38920194829","ifscCode":"SBIN0001234","branch":"Coimbatore Main"}'::jsonb,
  payments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_invoice_no ON invoices(invoice_no);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_status ON invoices(invoice_status);

CREATE TABLE IF NOT EXISTS sales_payments (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
  invoice_no VARCHAR(100) NOT NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_mode VARCHAR(50) DEFAULT 'Bank Transfer',
  reference VARCHAR(100) DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_payments_invoice_id ON sales_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_sales_payments_payment_date ON sales_payments(payment_date);

-- Master Types Table for Centralized Dynamic Types Management
CREATE TABLE IF NOT EXISTS master_types (
  id SERIAL PRIMARY KEY,
  category VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100) DEFAULT '',
  description TEXT DEFAULT '',
  extra_data JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_master_types_cat_name UNIQUE (category, name)
);

CREATE INDEX IF NOT EXISTS idx_master_types_cat ON master_types(category);
CREATE INDEX IF NOT EXISTS idx_master_types_cat_active ON master_types(category, is_active);

-- Populate initial master types from genuine existing transaction data (if any exists in DB)
INSERT INTO master_types (category, name)
SELECT DISTINCT 'thread_type', TRIM(thread_type) FROM thread_purchases WHERE thread_type IS NOT NULL AND TRIM(thread_type) != ''
ON CONFLICT (category, name) DO NOTHING;

INSERT INTO master_types (category, name)
SELECT DISTINCT 'oil_type', TRIM(oil_type) FROM oil_purchases WHERE oil_type IS NOT NULL AND TRIM(oil_type) != ''
ON CONFLICT (category, name) DO NOTHING;

INSERT INTO master_types (category, name)
SELECT DISTINCT 'machine_name', TRIM(machine) FROM machinery_expenses WHERE machine IS NOT NULL AND TRIM(machine) != ''
ON CONFLICT (category, name) DO NOTHING;

INSERT INTO master_types (category, name)
SELECT DISTINCT 'expense_category', TRIM(category) FROM machinery_expenses WHERE category IS NOT NULL AND TRIM(category) != ''
ON CONFLICT (category, name) DO NOTHING;

