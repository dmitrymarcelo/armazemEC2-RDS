
export type Module = 'dashboard' | 'recebimento' | 'movimentacoes' | 'auditoria_geral' | 'estoque' | 'expedicao' | 'inventario_ciclico' | 'compras' | 'gestao_compras' | 'cadastro' | 'relatorios' | 'configuracoes';

export const ALL_MODULES: { id: Module; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'recebimento', label: 'Recebimento' },
  { id: 'movimentacoes', label: 'Movimentações' },
  { id: 'auditoria_geral', label: 'Auditoria Geral' },
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
  warehouseId: string; // NOVO: ArmazÃ©m onde ocorreu a movimentaÃ§Ã£o
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
  warehouseId: string; // NOVO: ArmazÃ©m onde o item estÃ¡ localizado
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
  action: 'approved' | 'rejected' | 'status_changed';
  by: string;
  at: string;
  reason?: string;
  description?: string;
  status?: PurchaseOrderStatus;
}

export type PurchaseOrderStatus =
  | 'rascunho'
  | 'requisicao'
  | 'cotacao'
  | 'pendente'
  | 'aprovado'
  | 'enviado'
  | 'recebido'
  | 'cancelado';

export interface PurchaseOrder {
  id: string;
  vendor: string;
  requestDate: string;
  items: { sku: string; name: string; qty: number; price: number }[];
  status: PurchaseOrderStatus;
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
  warehouseId: string; // NOVO: ArmazÃ©m de destino do pedido
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
  hasWorkshopAccess?: boolean; // NOVO: Acesso ao módulo Oficina
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
  warehouseId: string; // NOVO: ArmazÃ©m onde o inventÃ¡rio estÃ¡ sendo realizado
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

// ===== SISTEMA DE MÓDULOS =====
export type SystemModule = 'warehouse' | 'workshop';

// ===== MÓDULO OFICINA =====
export type WorkOrderStatus = 'aguardando' | 'em_execucao' | 'aguardando_pecas' | 'finalizada' | 'cancelada';
export type WorkOrderType = 'preventiva' | 'corretiva' | 'urgente' | 'revisao' | 'garantia';
export type ServiceCategory = 'motor' | 'suspensao' | 'freios' | 'eletrica' | 'lubrificacao' | 'pneus' | 'carroceria' | 'outros';

export interface WorkOrder {
  id: string;
  vehiclePlate: string;
  vehicleModel?: string;
  status: WorkOrderStatus;
  type: WorkOrderType;
  priority: 'baixa' | 'normal' | 'alta' | 'urgente';
  mechanicId?: string;
  mechanicName?: string;
  description: string;
  services: ServiceItem[];
  parts: PartRequest[];
  openedAt: string;
  closedAt?: string;
  estimatedHours: number;
  actualHours?: number;
  costCenter?: string;
  cost: {
    labor: number;
    parts: number;
    thirdParty: number;
    total: number;
  };
  createdBy: string;
  warehouseId: string;
}

export interface ServiceItem {
  id: string;
  description: string;
  category: ServiceCategory;
  estimatedHours: number;
  actualHours?: number;
  completed: boolean;
}

export interface PartRequest {
  id: string;
  sku: string;
  name: string;
  qtyRequested: number;
  qtyUsed?: number;
  status: 'pendente' | 'separacao' | 'entregue' | 'nao_utilizada';
  unitCost?: number;
}

export interface Mechanic {
  id: string;
  name: string;
  specialty: string;
  shift: 'manha' | 'tarde' | 'noite';
  status: 'disponivel' | 'ocupado' | 'ferias' | 'afastado';
  currentWorkOrders: string[];
  productivity: {
    ordersCompleted: number;
    avgHoursPerOrder: number;
    onTimeRate: number;
  };
}

export interface MaintenancePlan {
  id: string;
  name: string;
  vehicleType: string;
  vehicleModel?: string;
  operationType: 'normal' | 'severa' | 'muito_severa';
  triggers: MaintenanceTrigger[];
  parts: MaintenancePart[];
  checklistSections: ChecklistSection[];
  estimatedHours: number;
  estimatedCost: number;
  services: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface MaintenanceTrigger {
  type: 'km' | 'hours' | 'months';
  value: number;
  currentValue?: number;
  remaining?: number;
}

export interface MaintenancePart {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  unit: string;
  estimatedCost: number;
  supplier?: string;
}

export interface ChecklistField {
  id: string;
  type: 'text' | 'number' | 'select' | 'date' | 'photo' | 'signature' | 'checkbox';
  label: string;
  required: boolean;
  options?: string[];
  conditional?: {
    fieldId: string;
    operator: 'equals' | 'less_than' | 'greater_than';
    value: string | number;
    action: 'show' | 'hide' | 'mark_critical' | 'generate_os';
  };
}

export interface ChecklistSection {
  id: string;
  title: string;
  description?: string;
  fields: ChecklistField[];
  order: number;
}

export interface InspectionTemplate {
  id: string;
  name: string;
  version: string;
  vehicleModel?: string;
  description?: string;
  sections: ChecklistSection[];
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  createdBy: string;
}

export interface ScheduledMaintenance {
  id: string;
  vehiclePlate: string;
  planId: string;
  planName: string;
  dueKm?: number;
  dueDate?: string;
  status: 'pendente' | 'agendado' | 'atrasado' | 'executado';
  workOrderId?: string;
}

export interface InspectionChecklist {
  id: string;
  vehiclePlate: string;
  type: 'diario_motorista' | 'recepcao_oficina' | 'preventiva';
  date: string;
  inspector: string;
  items: InspectionItem[];
  status: 'aprovado' | 'reprovado' | 'aprovado_com_ressalvas';
  notes?: string;
  photos?: string[];
}

export interface InspectionItem {
  id: string;
  description: string;
  status: 'ok' | 'nao_ok' | 'nao_aplicavel';
  notes?: string;
  critical: boolean;
}

export interface WorkshopKPIs {
  mttr: number;
  mtbf: number;
  availability: number;
  totalCost: number;
  costPerKm: number;
  preventivePercentage: number;
  correctivePercentage: number;
  urgentPercentage: number;
  openOrders: number;
  lateOrders: number;
  avgRepairTime: number;
  mechanicsAvailable: number;
  mechanicsOccupied: number;
}

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  aguardando: 'Aguardando',
  em_execucao: 'Em Execução',
  aguardando_pecas: 'Aguardando Peças',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada'
};

export const WORK_ORDER_TYPE_LABELS: Record<WorkOrderType, string> = {
  preventiva: 'Preventiva',
  corretiva: 'Corretiva',
  urgente: 'Urgente',
  revisao: 'Revisão',
  garantia: 'Garantia'
};

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  motor: 'Motor',
  suspensao: 'Suspensão',
  freios: 'Freios',
  eletrica: 'Elétrica',
  lubrificacao: 'Lubrificação',
  pneus: 'Pneus',
  carroceria: 'Carroceria',
  outros: 'Outros'
};

export const MECHANIC_STATUS_LABELS = {
  disponivel: 'Disponível',
  ocupado: 'Ocupado',
  ferias: 'Férias',
  afastado: 'Afastado'
};

// ===== TIPOS EXPANDIDOS PARA MÓDULO DE OFICINA AVANÇADO =====

// Documentos do veículo
export interface VehicleDocument {
  type: 'ipva' | 'seguro' | 'licenciamento' | 'circulacao';
  status: 'pago' | 'ativo' | 'pendente' | 'vencido';
  expiryDate?: string;
  notes?: string;
}

// Componente do veículo com saúde
export interface VehicleComponent {
  id: string;
  name: string;
  category: 'oleo_motor' | 'pneus' | 'bateria' | 'freios' | 'suspensao' | 'motor' | 'transmissao' | 'ar' | 'outros';
  health: number; // 0-100%
  status: 'bom' | 'atencao' | 'critico';
  lastService?: string;
  nextServiceKm?: number;
  nextServiceDate?: string;
  currentValue?: string;
  unit?: string;
}

// Evento do histórico
export interface VehicleEvent {
  id: string;
  type: 'manutencao' | 'alerta' | 'checklist' | 'servico' | 'revisao' | 'parada';
  title: string;
  description: string;
  date: string;
  mechanic?: string;
  workshop?: string;
  osId?: string;
  status?: 'concluido' | 'andamento' | 'aprovado' | 'critico' | 'finalizado';
  cost?: number;
  parts?: { name: string; qty: number; cost: number }[];
}

// Detalhes completos do veículo
export interface VehicleDetail extends Vehicle {
  chassis: string;
  year: number;
  mileage: number;
  engineHours?: number;
  costCenter: string;
  documents: VehicleDocument[];
  components: VehicleComponent[];
  events: VehicleEvent[];
  maintenancePlan?: string;
  nextServiceKm?: number;
  nextServiceDate?: string;
  statusOperacional: 'operacional' | 'manutencao' | 'parado' | 'em_viagem';
}

// Progresso do plano
export interface PlanProgress {
  currentKm: number;
  targetKm: number;
  percentage: number;
  remainingKm: number;
  status: 'em_conformidade' | 'acao_necessaria' | 'critico' | 'atrasado';
}

// Plano ativo do veículo
export interface ActivePlan {
  id: string;
  vehiclePlate: string;
  planId: string;
  planName: string;
  progress: PlanProgress;
  nextService: {
    description: string;
    dueKm: number;
    dueDate: string;
    daysRemaining: number;
  };
  status: 'em_conformidade' | 'acao_necessaria' | 'critico';
}

// Milestone de manutenção
export interface MaintenanceMilestone {
  km: number;
  date: string;
  description: string;
  status: 'concluido' | 'proximo' | 'planejado';
  type: 'revisao' | 'troca' | 'inspecao';
  cost?: number;
}

// Análise preditiva
export interface PredictiveAnalysis {
  downtimeProbability: number;
  riskLevel: 'baixa' | 'media' | 'alta';
  recommendations: string[];
  estimatedSavings?: number;
}

// Saúde dos sistemas
export interface SystemHealth {
  name: string;
  health: number;
  status: 'bom' | 'atencao' | 'critico';
}

// Cronograma preventivo detalhado
export interface PreventiveSchedule {
  id: string;
  vehiclePlate: string;
  vehicleModel: string;
  planId: string;
  planName: string;
  milestones: MaintenanceMilestone[];
  nextService: {
    description: string;
    km: number;
    estimatedDate: string;
    priority: 'baixa' | 'media' | 'alta';
    parts: MaintenancePart[];
    totalCost: number;
    estimatedDuration: string;
  };
  predictiveAnalysis: PredictiveAnalysis;
  systemHealth: SystemHealth[];
  costPerKm: number;
  availability: number;
}

// KPIs de preventiva
export interface PreventiveKPIs {
  complianceRate: number;
  complianceChange: number;
  vehiclesNearService: number;
  urgentCount: number;
  mtbs: number; // Mean Time Between Services
  mtbsTrend: 'up' | 'down' | 'stable';
  savings: number;
  savingsTrend: number;
}

// Alerta de manutenção
export interface MaintenanceAlert {
  id: string;
  type: 'licenciamento' | 'parada_nao_programada' | 'vencimento' | 'revisao' | 'critico';
  title: string;
  description: string;
  vehiclePlate?: string;
  severity: 'info' | 'warning' | 'critical';
  createdAt: string;
  resolvedAt?: string;
  action?: string;
}

// Status da OS
export const MAINTENANCE_STATUS_LABELS = {
  em_conformidade: 'Em Conformidade',
  acao_necessaria: 'Ação Necessária',
  critico: 'Crítico',
  atrasado: 'Atrasado',
  concluido: 'Concluído',
  proximo: 'Próximo',
  planejado: 'Planejado'
};

// Labels de eventos
export const EVENT_TYPE_LABELS = {
  manutencao: 'Manutenção',
  alerta: 'Alerta',
  checklist: 'Checklist',
  servico: 'Serviço',
  revisao: 'Revisão',
  parada: 'Parada'
};

// Labels de componentes
export const COMPONENT_CATEGORY_LABELS = {
  oleo_motor: 'Óleo Motor',
  pneus: 'Pneus',
  bateria: 'Bateria',
  freios: 'Freios',
  suspensao: 'Suspensão',
  motor: 'Motor',
  transmissao: 'Transmissão',
  ar: 'Ar',
  outros: 'Outros'
};
