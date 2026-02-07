
export type Module = 'dashboard' | 'recebimento' | 'movimentacoes' | 'estoque' | 'expedicao' | 'inventario_ciclico' | 'compras' | 'gestao_compras' | 'cadastro' | 'relatorios' | 'configuracoes';

export const ALL_MODULES: { id: Module; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'recebimento', label: 'Recebimento' },
  { id: 'movimentacoes', label: 'Movimentações' },
  { id: 'estoque', label: 'Estoque' },
  { id: 'expedicao', label: 'Solicitações SA' },
  { id: 'compras', label: 'Compras' },
  { id: 'inventario_ciclico', label: 'Inventário Cíclico' },
  { id: 'cadastro', label: 'Cadastro' },
  { id: 'relatorios', label: 'Relatórios' },
  { id: 'configuracoes', label: 'Configurações' },
];

export const ROLE_LABELS = {
  admin: 'Administrador',
  buyer: 'Comprador',
  manager: 'Gerente',
  driver: 'Motorista',
  operator: 'Operador',
  checker: 'Conferente'
};

export const PO_STATUS_LABELS = {
  rascunho: 'Rascunho',
  requisicao: 'Requisição',
  cotacao: 'Cotação',
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  enviado: 'Enviado',
  recebido: 'Recebido',
  cancelado: 'Cancelado'
};

export const INVENTORY_STATUS_LABELS = {
  disponivel: 'Disponível',
  vencimento: 'Vencimento',
  transito: 'Trânsito',
  divergente: 'Divergente',
  excesso: 'Excesso'
};

export interface KPI {
  label: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: string;
  color: string;
}

export interface Activity {
  id: string;
  type: 'recebimento' | 'movimentacao' | 'expedicao' | 'alerta' | 'compra';
  title: string;
  subtitle: string;
  time: string;
}

export interface Warehouse {
  id: string;
  name: string;
  description?: string;
  location?: string;
  managerName?: string;
  managerEmail?: string;
  isActive: boolean;
}

export interface Movement {
  id: string;
  sku: string;
  productName: string; // Restored for compatibility
  type: 'entrada' | 'saida' | 'ajuste';
  quantity: number;
  timestamp: string;
  user: string; // Restored for compatibility
  location: string;
  reason: string;
  orderId?: string;
  warehouseId: string; // NOVO: Armazém onde ocorreu a movimentação
}

export interface InventoryItem {
  sku: string;
  name: string;
  location: string;
  batch: string;
  expiry: string;
  quantity: number;
  status: 'disponivel' | 'vencimento' | 'transito' | 'divergente' | 'excesso';
  imageUrl: string;
  category: string;
  unit: string;
  minQty: number;
  maxQty: number;
  leadTime: number;
  safetyStock: number;
  abcCategory?: 'A' | 'B' | 'C';
  lastCountedAt?: string;
  warehouseId: string; // NOVO: Armazém onde o item está localizado
}

export interface Quote {
  id: string;
  vendorId: string;
  vendorName: string;
  items: { sku: string; unitPrice: number; leadTime: string }[];
  totalValue: number;
  validUntil: string;
  notes?: string;
  quotedBy: string;
  quotedAt: string;
  isSelected: boolean;
}

export interface ApprovalRecord {
  id: string;
  action: 'approved' | 'rejected';
  by: string;
  at: string;
  reason?: string;
}

export interface PurchaseOrder {
  id: string;
  vendor: string;
  requestDate: string;
  items: { sku: string; name: string; qty: number; price: number }[];
  status: 'rascunho' | 'requisicao' | 'cotacao' | 'pendente' | 'aprovado' | 'enviado' | 'recebido' | 'cancelado';
  total: number;
  priority: 'normal' | 'urgente';
  requester?: string;
  quotes?: Quote[];
  selectedQuoteId?: string;
  quotesAddedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  sentToVendorAt?: string;
  receivedAt?: string;
  vendorOrderNumber?: string;
  approvalHistory?: ApprovalRecord[];
  plate?: string;
  costCenter?: string;
  warehouseId: string; // NOVO: Armazém de destino do pedido
}

export interface Vendor {
  id: string;
  name: string;
  cnpj: string;
  category: string;
  contact: string;
  email: string;
  status: 'Ativo' | 'Bloqueado';
}

export interface Vehicle {
  plate: string;
  model: string;
  type: string; // Expanded to support API types like LANCHA, PASSEIO, etc.
  lastMaintenance: string;
  status: 'Disponível' | 'Em Viagem' | 'Manutenção' | string;
  costCenter?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'buyer' | 'manager' | 'driver' | 'operator' | 'checker';
  status: 'Ativo' | 'Inativo';
  lastAccess: string;
  avatar: string;
  modules: Module[];
  password?: string;
  allowedWarehouses: string[]; // NOVO: Armazéns que o usuário pode acessar
}
export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  read: boolean;
  createdAt: string;
  userId?: string;
}

export interface CyclicBatch {
  id: string;
  status: 'aberto' | 'concluido' | 'cancelado';
  scheduledDate: string;
  completedAt?: string;
  accuracyRate?: number;
  totalItems: number;
  divergentItems: number;
  warehouseId: string; // NOVO: Armazém onde o inventário está sendo realizado
}

export interface CyclicCount {
  id: string;
  batchId: string;
  sku: string;
  expectedQty: number;
  countedQty?: number;
  status: 'pendente' | 'contado' | 'ajustado';
  notes?: string;
  countedAt?: string;
}

export interface CostCenter {
  id: string;
  code: string;
  name: string;
  manager: string;
  budget: number;
  status: 'Ativo' | 'Inativo';
}
