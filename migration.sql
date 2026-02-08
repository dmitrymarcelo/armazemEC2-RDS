-- Migration oficial LogiWMS-Pro para PostgreSQL (AWS/RDS)
-- Objetivo: tipagem forte (TIMESTAMPTZ/JSONB), indices e compatibilidade com dados legados.
-- Execucao:
--   psql -U <usuario> -d armazem -f migration.sql

\c armazem

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Conversao segura de texto para timestamptz.
CREATE OR REPLACE FUNCTION safe_to_timestamptz(value TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
AS $$
DECLARE
  parsed TIMESTAMPTZ;
  normalized TEXT;
BEGIN
  IF value IS NULL THEN
    RETURN NULL;
  END IF;

  normalized := btrim(value);
  IF normalized = '' OR lower(normalized) IN ('n/a', 'null', 'undefined') THEN
    RETURN NULL;
  END IF;

  BEGIN
    parsed := normalized::timestamptz;
    RETURN parsed;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  BEGIN
    parsed := to_timestamp(normalized, 'DD/MM/YYYY HH24:MI:SS');
    RETURN parsed;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  BEGIN
    parsed := to_timestamp(normalized, 'DD/MM/YYYY, HH24:MI:SS');
    RETURN parsed;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  BEGIN
    parsed := to_timestamp(normalized, 'YYYY-MM-DD HH24:MI:SS');
    RETURN parsed;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  BEGIN
    parsed := to_timestamp(normalized, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    RETURN parsed;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  RETURN NULL;
END;
$$;

-- Conversao segura de texto para JSONB.
CREATE OR REPLACE FUNCTION safe_to_jsonb(value TEXT, fallback JSONB DEFAULT '[]'::JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
  IF value IS NULL OR btrim(value) = '' THEN
    RETURN fallback;
  END IF;

  RETURN value::jsonb;
EXCEPTION WHEN others THEN
  RETURN fallback;
END;
$$;

-- Estrutura principal
CREATE TABLE IF NOT EXISTS warehouses (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  location VARCHAR(255),
  manager_name VARCHAR(255),
  manager_email VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL,
  status TEXT DEFAULT 'Ativo',
  last_access TIMESTAMPTZ,
  avatar TEXT,
  password TEXT NOT NULL,
  modules JSONB NOT NULL DEFAULT '[]'::JSONB,
  allowed_warehouses JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  manager TEXT,
  budget DECIMAL(15, 2) DEFAULT 0,
  status TEXT DEFAULT 'Ativo',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cnpj TEXT,
  category TEXT,
  contact TEXT,
  email TEXT,
  status TEXT DEFAULT 'Ativo',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicles (
  plate VARCHAR(20) PRIMARY KEY,
  model TEXT,
  type TEXT,
  status TEXT DEFAULT 'Disponivel',
  last_maintenance TIMESTAMPTZ,
  cost_center TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory (
  sku VARCHAR(50) PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  batch TEXT,
  expiry TEXT,
  quantity INTEGER DEFAULT 0,
  status TEXT DEFAULT 'disponivel',
  image_url TEXT,
  category TEXT,
  min_qty INTEGER DEFAULT 0,
  max_qty INTEGER DEFAULT 0,
  unit TEXT DEFAULT 'UN',
  lead_time INTEGER DEFAULT 7,
  safety_stock INTEGER DEFAULT 5,
  abc_category TEXT,
  last_counted_at TIMESTAMPTZ,
  warehouse_id VARCHAR(50) REFERENCES warehouses(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(50) REFERENCES inventory(sku),
  product_name TEXT,
  type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  "user" TEXT,
  location TEXT,
  reason TEXT,
  order_id TEXT,
  warehouse_id VARCHAR(50) REFERENCES warehouses(id)
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  vendor TEXT,
  request_date TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'requisicao',
  priority TEXT DEFAULT 'normal',
  total DECIMAL(15, 2) DEFAULT 0,
  requester TEXT,
  items JSONB NOT NULL DEFAULT '[]'::JSONB,
  quotes JSONB NOT NULL DEFAULT '[]'::JSONB,
  selected_quote_id TEXT,
  sent_to_vendor_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  quotes_added_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  vendor_order_number TEXT,
  approval_history JSONB NOT NULL DEFAULT '[]'::JSONB,
  plate TEXT,
  cost_center TEXT,
  warehouse_id VARCHAR(50) REFERENCES warehouses(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS material_requests (
  id TEXT PRIMARY KEY,
  sku VARCHAR(50) REFERENCES inventory(sku),
  name TEXT,
  qty INTEGER NOT NULL,
  plate TEXT,
  dept TEXT,
  priority TEXT,
  status TEXT DEFAULT 'aprovacao',
  cost_center TEXT,
  warehouse_id VARCHAR(50) REFERENCES warehouses(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cyclic_batches (
  id TEXT PRIMARY KEY,
  status TEXT DEFAULT 'aberto',
  scheduled_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  accuracy_rate DECIMAL(5, 2),
  total_items INTEGER DEFAULT 0,
  divergent_items INTEGER DEFAULT 0,
  warehouse_id VARCHAR(50) REFERENCES warehouses(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cyclic_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id TEXT REFERENCES cyclic_batches(id),
  sku VARCHAR(50) REFERENCES inventory(sku),
  expected_qty INTEGER NOT NULL,
  counted_qty INTEGER,
  status TEXT DEFAULT 'pendente',
  notes TEXT,
  counted_at TIMESTAMPTZ,
  warehouse_id VARCHAR(50) REFERENCES warehouses(id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  read BOOLEAN DEFAULT false,
  user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity TEXT NOT NULL,
  entity_id TEXT,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT,
  actor_id TEXT,
  warehouse_id VARCHAR(50),
  before_data JSONB,
  after_data JSONB,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversao de ambientes legados (colunas antigas em TEXT)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'last_access' AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE users ALTER COLUMN last_access TYPE TIMESTAMPTZ USING safe_to_timestamptz(last_access);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'modules' AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE users ALTER COLUMN modules TYPE JSONB USING safe_to_jsonb(modules, '[]'::JSONB);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'allowed_warehouses' AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE users ALTER COLUMN allowed_warehouses TYPE JSONB USING safe_to_jsonb(allowed_warehouses, '[]'::JSONB);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory' AND column_name = 'last_counted_at' AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE inventory ALTER COLUMN last_counted_at TYPE TIMESTAMPTZ USING safe_to_timestamptz(last_counted_at);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'last_maintenance' AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE vehicles ALTER COLUMN last_maintenance TYPE TIMESTAMPTZ USING safe_to_timestamptz(last_maintenance);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_orders' AND column_name = 'request_date' AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE purchase_orders ALTER COLUMN request_date TYPE TIMESTAMPTZ USING safe_to_timestamptz(request_date);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_orders' AND column_name = 'sent_to_vendor_at' AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE purchase_orders ALTER COLUMN sent_to_vendor_at TYPE TIMESTAMPTZ USING safe_to_timestamptz(sent_to_vendor_at);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_orders' AND column_name = 'received_at' AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE purchase_orders ALTER COLUMN received_at TYPE TIMESTAMPTZ USING safe_to_timestamptz(received_at);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_orders' AND column_name = 'quotes_added_at' AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE purchase_orders ALTER COLUMN quotes_added_at TYPE TIMESTAMPTZ USING safe_to_timestamptz(quotes_added_at);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_orders' AND column_name = 'approved_at' AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE purchase_orders ALTER COLUMN approved_at TYPE TIMESTAMPTZ USING safe_to_timestamptz(approved_at);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_orders' AND column_name = 'rejected_at' AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE purchase_orders ALTER COLUMN rejected_at TYPE TIMESTAMPTZ USING safe_to_timestamptz(rejected_at);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_orders' AND column_name = 'items' AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE purchase_orders ALTER COLUMN items TYPE JSONB USING safe_to_jsonb(items, '[]'::JSONB);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_orders' AND column_name = 'quotes' AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE purchase_orders ALTER COLUMN quotes TYPE JSONB USING safe_to_jsonb(quotes, '[]'::JSONB);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_orders' AND column_name = 'approval_history' AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE purchase_orders ALTER COLUMN approval_history TYPE JSONB USING safe_to_jsonb(approval_history, '[]'::JSONB);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cyclic_batches' AND column_name = 'scheduled_date' AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE cyclic_batches ALTER COLUMN scheduled_date TYPE TIMESTAMPTZ USING safe_to_timestamptz(scheduled_date);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cyclic_batches' AND column_name = 'completed_at' AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE cyclic_batches ALTER COLUMN completed_at TYPE TIMESTAMPTZ USING safe_to_timestamptz(completed_at);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cyclic_counts' AND column_name = 'counted_at' AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE cyclic_counts ALTER COLUMN counted_at TYPE TIMESTAMPTZ USING safe_to_timestamptz(counted_at);
  END IF;
END
$$;

-- Defaults e NOT NULL para JSONB critico
ALTER TABLE users ALTER COLUMN modules SET DEFAULT '[]'::JSONB;
ALTER TABLE users ALTER COLUMN allowed_warehouses SET DEFAULT '[]'::JSONB;
UPDATE users SET modules = '[]'::JSONB WHERE modules IS NULL;
UPDATE users SET allowed_warehouses = '[]'::JSONB WHERE allowed_warehouses IS NULL;
ALTER TABLE users ALTER COLUMN modules SET NOT NULL;
ALTER TABLE users ALTER COLUMN allowed_warehouses SET NOT NULL;

ALTER TABLE purchase_orders ALTER COLUMN items SET DEFAULT '[]'::JSONB;
ALTER TABLE purchase_orders ALTER COLUMN quotes SET DEFAULT '[]'::JSONB;
ALTER TABLE purchase_orders ALTER COLUMN approval_history SET DEFAULT '[]'::JSONB;
UPDATE purchase_orders SET items = '[]'::JSONB WHERE items IS NULL;
UPDATE purchase_orders SET quotes = '[]'::JSONB WHERE quotes IS NULL;
UPDATE purchase_orders SET approval_history = '[]'::JSONB WHERE approval_history IS NULL;
ALTER TABLE purchase_orders ALTER COLUMN items SET NOT NULL;
ALTER TABLE purchase_orders ALTER COLUMN quotes SET NOT NULL;
ALTER TABLE purchase_orders ALTER COLUMN approval_history SET NOT NULL;

-- Indices
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);
CREATE INDEX IF NOT EXISTS idx_users_last_access ON users(last_access DESC);
CREATE INDEX IF NOT EXISTS idx_users_modules_gin ON users USING GIN (modules);
CREATE INDEX IF NOT EXISTS idx_users_allowed_warehouses_gin ON users USING GIN (allowed_warehouses);

CREATE INDEX IF NOT EXISTS idx_inventory_warehouse ON inventory(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory(status);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category);

CREATE INDEX IF NOT EXISTS idx_movements_warehouse_timestamp ON movements(warehouse_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_movements_sku_timestamp ON movements(sku, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_po_warehouse_request_date ON purchase_orders(warehouse_id, request_date DESC);
CREATE INDEX IF NOT EXISTS idx_po_status_priority ON purchase_orders(status, priority);
CREATE INDEX IF NOT EXISTS idx_po_items_gin ON purchase_orders USING GIN (items);
CREATE INDEX IF NOT EXISTS idx_po_quotes_gin ON purchase_orders USING GIN (quotes);
CREATE INDEX IF NOT EXISTS idx_po_approval_history_gin ON purchase_orders USING GIN (approval_history);

CREATE INDEX IF NOT EXISTS idx_requests_warehouse_created ON material_requests(warehouse_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_status_priority ON material_requests(status, priority);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created ON notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cyclic_batches_warehouse_created ON cyclic_batches(warehouse_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cyclic_counts_batch ON cyclic_counts(batch_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module_created ON audit_logs(module, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created ON audit_logs(actor, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON audit_logs(action, created_at DESC);

-- Seed principal
INSERT INTO warehouses (id, name, description, location, manager_name, is_active)
VALUES
  ('ARMZ28', 'Armazem Principal', 'Operacoes gerais de armazenamento e distribuicao', 'Manaus - AM', 'Administrador', true),
  ('ARMZ33', 'Conferencia de Carga em Tempo Real', 'Recebimento, conferencia e validacao de carga', 'Manaus - AM', 'Administrador', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, name, email, role, status, password, modules, allowed_warehouses)
VALUES
  (
    '1',
    'Administrador',
    'admin@nortetech.com',
    'admin',
    'Ativo',
    'pbkdf2$310000$c69ffaeaeaf017b7f94270ab3a61d55b$8d5b4fd072c9044b957eb432bdf26f03ff1b50a7859ca7b370b0f896356f356a',
    '["dashboard","recebimento","movimentacoes","estoque","expedicao","inventario_ciclico","compras","cadastro","relatorios","configuracoes"]'::jsonb,
    '["ARMZ28","ARMZ33"]'::jsonb
  ),
  (
    'ocv3aoy40',
    'MATIAS',
    'MATIAS@G.COM',
    'manager',
    'Ativo',
    'pbkdf2$310000$899714a53cee2b0abc6ff8370582e339$77f07c5a4c32bc93fbc7187efe33ffe0df35591f518ff54da92e7e1be1b997f6',
    '["dashboard","recebimento","movimentacoes","estoque","expedicao","compras","inventario_ciclico","cadastro","relatorios","configuracoes"]'::jsonb,
    '["ARMZ33"]'::jsonb
  )
ON CONFLICT (email) DO NOTHING;

INSERT INTO cost_centers (code, name, manager, budget, status)
VALUES
  ('CC-LOG', 'Logistica', 'Administrador', 500000.00, 'Ativo'),
  ('CC-OPS', 'Operacoes', 'MATIAS', 300000.00, 'Ativo'),
  ('CC-MAN', 'Manutencao', 'Administrador', 150000.00, 'Ativo')
ON CONFLICT (code) DO NOTHING;

\echo 'Migration concluida com sucesso.'
\echo 'Teste rapido: SELECT count(*) FROM users;'
