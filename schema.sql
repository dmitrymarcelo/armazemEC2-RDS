
-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tabela de Armazéns
CREATE TABLE IF NOT EXISTS warehouses (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255),
    manager_name VARCHAR(255),
    manager_email VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de Usuários
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL,
    status TEXT DEFAULT 'Ativo',
    last_access TEXT,
    avatar TEXT,
    password TEXT NOT NULL,
    modules TEXT, -- Armazenado como JSON string
    allowed_warehouses TEXT, -- Armazenado como JSON string
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabela de Centros de Custo
CREATE TABLE IF NOT EXISTS cost_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    manager TEXT,
    budget DECIMAL(15, 2) DEFAULT 0,
    status TEXT DEFAULT 'Ativo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabela de Fornecedores
CREATE TABLE IF NOT EXISTS vendors (
    id TEXT PRIMARY KEY, -- Mantendo TEXT para compatibilidade com IDs do frontend
    name TEXT NOT NULL,
    cnpj TEXT,
    category TEXT,
    contact TEXT,
    email TEXT,
    status TEXT DEFAULT 'Ativo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabela de Veículos
CREATE TABLE IF NOT EXISTS vehicles (
    plate VARCHAR(20) PRIMARY KEY,
    model TEXT,
    type TEXT,
    status TEXT DEFAULT 'Disponível',
    last_maintenance TEXT,
    cost_center TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Tabela de Inventário (Estoque)
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
    last_counted_at TEXT,
    warehouse_id VARCHAR(50) REFERENCES warehouses(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Tabela de Movimentações
CREATE TABLE IF NOT EXISTS movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(50) REFERENCES inventory(sku),
    product_name TEXT,
    type TEXT NOT NULL, -- entrada, saida, ajuste
    quantity INTEGER NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "user" TEXT,
    location TEXT,
    reason TEXT,
    order_id TEXT,
    warehouse_id VARCHAR(50) REFERENCES warehouses(id)
);

-- 8. Tabela de Pedidos de Compra
CREATE TABLE IF NOT EXISTS purchase_orders (
    id TEXT PRIMARY KEY,
    vendor TEXT,
    request_date TEXT,
    status TEXT DEFAULT 'requisicao',
    priority TEXT DEFAULT 'normal',
    total DECIMAL(15, 2) DEFAULT 0,
    requester TEXT,
    items TEXT, -- Armazenado como JSON string
    quotes TEXT, -- Armazenado como JSON string
    selected_quote_id TEXT,
    sent_to_vendor_at TEXT,
    received_at TEXT,
    quotes_added_at TEXT,
    approved_at TEXT,
    rejected_at TEXT,
    vendor_order_number TEXT,
    approval_history TEXT, -- Armazenado como JSON string
    plate TEXT,
    cost_center TEXT,
    warehouse_id VARCHAR(50) REFERENCES warehouses(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Tabela de Requisições de Materiais
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Lotes de Inventário Cíclico
CREATE TABLE IF NOT EXISTS cyclic_batches (
    id TEXT PRIMARY KEY,
    status TEXT DEFAULT 'aberto',
    scheduled_date TEXT,
    completed_at TEXT,
    accuracy_rate DECIMAL(5, 2),
    total_items INTEGER DEFAULT 0,
    divergent_items INTEGER DEFAULT 0,
    warehouse_id VARCHAR(50) REFERENCES warehouses(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Contagens do Inventário Cíclico
CREATE TABLE IF NOT EXISTS cyclic_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id TEXT REFERENCES cyclic_batches(id),
    sku VARCHAR(50) REFERENCES inventory(sku),
    expected_qty INTEGER NOT NULL,
    counted_qty INTEGER,
    status TEXT DEFAULT 'pendente',
    notes TEXT,
    counted_at TEXT,
    warehouse_id VARCHAR(50) REFERENCES warehouses(id)
);

-- 12. Tabela de Notificações
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    read BOOLEAN DEFAULT false,
    user_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dados Iniciais (Seed)
INSERT INTO warehouses (id, name, description, location, is_active)
VALUES 
('ARMZ28', 'Armazém Principal', 'Operações gerais de armazenamento e distribuição', 'Manaus - AM', true),
('ARMZ33', 'Conferência de Carga em Tempo Real', 'Recebimento, conferência e validação de carga', 'Manaus - AM', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, name, email, role, status, password, modules, allowed_warehouses)
VALUES (
    'admin-001', 
    'Administrador', 
    'admin@nortetech.com', 
    'admin', 
    'Ativo', 
    'admin', 
    '["dashboard","recebimento","movimentacoes","estoque","expedicao","inventario_ciclico","compras","cadastro","relatorios","configuracoes"]', 
    '["ARMZ28","ARMZ33"]'
) ON CONFLICT (id) DO NOTHING;
