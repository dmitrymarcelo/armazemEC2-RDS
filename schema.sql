-- Schema base para LogiWMS-Pro (PostgreSQL)
-- Versao otimizada para carga real (AWS/RDS)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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

-- Indices operacionais
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

-- Seed basico
INSERT INTO warehouses (id, name, description, location, is_active)
VALUES
  ('ARMZ28', 'Armazem Principal', 'Operacoes gerais de armazenamento e distribuicao', 'Manaus - AM', true),
  ('ARMZ33', 'Conferencia de Carga em Tempo Real', 'Recebimento, conferencia e validacao de carga', 'Manaus - AM', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, name, email, role, status, password, modules, allowed_warehouses)
VALUES (
  'admin-001',
  'Administrador',
  'admin@nortetech.com',
  'admin',
  'Ativo',
  'pbkdf2$310000$c69ffaeaeaf017b7f94270ab3a61d55b$8d5b4fd072c9044b957eb432bdf26f03ff1b50a7859ca7b370b0f896356f356a',
  '["dashboard","recebimento","movimentacoes","estoque","expedicao","inventario_ciclico","compras","cadastro","relatorios","configuracoes"]'::jsonb,
  '["ARMZ28","ARMZ33"]'::jsonb
)
ON CONFLICT (id) DO NOTHING;
