
import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { WarehouseSelector } from './components/WarehouseSelector';
import type { MaterialRequest } from './pages/Expedition';
type RequestStatus = 'aprovacao' | 'separacao' | 'entregue';
import { Module, InventoryItem, Activity, Movement, Vendor, Vehicle, PurchaseOrder, Quote, ApprovalRecord, User, AppNotification, CyclicBatch, CyclicCount, Warehouse, PurchaseOrderStatus, SystemModule, WorkOrder, Mechanic, WorkshopKPIs, WorkOrderStatus } from './types';
import { LoginPage } from './components/LoginPage';
import { ModuleSelector } from './components/ModuleSelector';
import { api, AUTH_TOKEN_KEY } from './api-client';
import { formatDateTimePtBR, formatTimePtBR, parseDateLike } from './utils/dateTime';
import {
  normalizeAllowedWarehouses,
  normalizeUserModules,
  normalizeUserRole,
  normalizeWorkshopAccess,
} from './utils/userAccess';

const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })));
const Receiving = lazy(() => import('./pages/Receiving').then((module) => ({ default: module.Receiving })));
const Movements = lazy(() => import('./pages/Movements').then((module) => ({ default: module.Movements })));
const Inventory = lazy(() => import('./pages/Inventory').then((module) => ({ default: module.Inventory })));
const Expedition = lazy(() => import('./pages/Expedition').then((module) => ({ default: module.Expedition })));
const CyclicInventory = lazy(() =>
  import('./pages/CyclicInventory').then((module) => ({ default: module.CyclicInventory }))
);
const PurchaseOrders = lazy(() =>
  import('./pages/PurchaseOrders').then((module) => ({ default: module.PurchaseOrders }))
);
const MasterData = lazy(() => import('./pages/MasterData').then((module) => ({ default: module.MasterData })));
const Reports = lazy(() => import('./pages/Reports').then((module) => ({ default: module.Reports })));
const GeneralAudit = lazy(() =>
  import('./pages/GeneralAudit').then((module) => ({ default: module.GeneralAudit }))
);
const Settings = lazy(() => import('./pages/Settings').then((module) => ({ default: module.Settings })));

// Workshop Module Imports
const WorkshopDashboard = lazy(() => import('./pages/workshop').then((module) => ({ default: module.WorkshopDashboard })));
const WorkOrderKanban = lazy(() => import('./pages/workshop').then((module) => ({ default: module.WorkOrderKanban })));
const MechanicsManagement = lazy(() => import('./pages/workshop').then((module) => ({ default: module.MechanicsManagement })));
const VehicleDetailView = lazy(() => import('./pages/workshop').then((module) => ({ default: module.VehicleDetailView })));
const PreventiveDashboard = lazy(() => import('./pages/workshop').then((module) => ({ default: module.PreventiveDashboard })));
const MaintenancePlanWizard = lazy(() => import('./pages/workshop').then((module) => ({ default: module.MaintenancePlanWizard })));
const ScheduleDetail = lazy(() => import('./pages/workshop').then((module) => ({ default: module.ScheduleDetail })));
const InspectionChecklistEditor = lazy(() => import('./pages/workshop').then((module) => ({ default: module.InspectionChecklistEditor })));
const VehicleManagement = lazy(() => import('./pages/workshop').then((module) => ({ default: module.VehicleManagement })));

import type { VehicleDetail, PreventiveKPIs, ActivePlan, MaintenanceAlert, MaintenancePlan, PreventiveSchedule, InspectionTemplate } from './types';


// localStorage helpers for mock data persistence
const STORAGE_KEYS = {
  INVENTORY: 'logiwms_inventory',
  REQUESTS: 'logiwms_requests',
  VEHICLES: 'logiwms_vehicles',
  WAREHOUSES: 'logiwms_warehouses',
  USERS: 'logiwms_users',
  MOVEMENTS: 'logiwms_movements',
  PURCHASE_ORDERS: 'logiwms_purchase_orders',
  NOTIFICATIONS: 'logiwms_notifications',
  ACTIVITIES: 'logiwms_activities',
};

const saveToStorage = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Error saving to localStorage:', e);
  }
};

const loadFromStorage = (key: string, defaultValue: any = null) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (e) {
    console.error('Error loading from localStorage:', e);
    return defaultValue;
  }
};

export const App: React.FC = () => {

  const [activeModule, setActiveModule] = useState<Module>('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryWarehouseScope, setInventoryWarehouseScope] = useState<string>('');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [appNotifications, setAppNotifications] = useState<AppNotification[]>([]);
  const [cyclicBatches, setCyclicBatches] = useState<CyclicBatch[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' | 'warning' | 'info' } | null>(null);
  const [user, setUser] = useState<User | null>(null);

  // System Module Selection (Warehouse vs Workshop)
  const [currentSystemModule, setCurrentSystemModule] = useState<SystemModule | null>(null);
  const [workshopActiveModule, setWorkshopActiveModule] = useState<'dashboard' | 'orders' | 'mechanics' | 'preventive' | 'vehicles' | 'plans' | 'schedules' | 'checklists' | 'frota'>('dashboard');

  // Workshop States
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [vehicleDetails, setVehicleDetails] = useState<VehicleDetail[]>([]);
  const [activePlans, setActivePlans] = useState<ActivePlan[]>([]);
  const [maintenanceAlerts, setMaintenanceAlerts] = useState<MaintenanceAlert[]>([]);
  const [preventiveSchedules, setPreventiveSchedules] = useState<PreventiveSchedule[]>([]);
  const [inspectionTemplates, setInspectionTemplates] = useState<InspectionTemplate[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleDetail | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<PreventiveSchedule | null>(null);
  const [preventiveKPIs, setPreventiveKPIs] = useState<PreventiveKPIs>({
    complianceRate: 94.2,
    complianceChange: 2.4,
    vehiclesNearService: 12,
    urgentCount: 2,
    mtbs: 45,
    mtbsTrend: 'stable',
    savings: 12500,
    savingsTrend: 8.5
  });
  const [workshopKPIs, setWorkshopKPIs] = useState<WorkshopKPIs>({
    mttr: 14.5,
    mtbf: 45,
    availability: 94.2,
    totalCost: 45200,
    costPerKm: 2.35,
    preventivePercentage: 65,
    correctivePercentage: 30,
    urgentPercentage: 5,
    openOrders: 12,
    lateOrders: 3,
    avgRepairTime: 8.5,
    mechanicsAvailable: 2,
    mechanicsOccupied: 3
  });

  const normalizeVehiclePlate = (value: unknown) => {
    const raw = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!raw) return '';
    if (/^[A-Z]{3}\d{4}$/.test(raw) || /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(raw)) {
      return `${raw.slice(0, 3)}-${raw.slice(3)}`;
    }
    return raw;
  };

  const normalizeVehicleStatus = (value: unknown): Vehicle['status'] => {
    const token = String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

    if (token.includes('inativ') || token.includes('bloque')) return 'Inativo';
    if (token.includes('manut') || token.includes('vencid') || token.includes('oficina')) return 'Manutencao';
    if (token.includes('viagem') || token.includes('transito')) return 'Em Viagem';
    return 'Disponivel';
  };

  const toVehiclePayload = (vehicle: Vehicle) => ({
    plate: vehicle.plate,
    model: vehicle.model,
    type: vehicle.type,
    status: vehicle.status,
    cost_center: vehicle.costCenter || null,
    last_maintenance: toIsoDateTime(vehicle.lastMaintenance),
  });

  const mapVehicleRowToState = (row: any): Vehicle => ({
    plate: normalizeVehiclePlate(row?.plate),
    model: String(row?.model || ''),
    type: String(row?.type || 'PROPRIO'),
    status: normalizeVehicleStatus(row?.status),
    lastMaintenance: toPtBrDateTime(row?.last_maintenance, ''),
    costCenter: String(row?.cost_center || ''),
  });

  const normalizeVehicleInput = (vehicle: Partial<Vehicle>): Vehicle | null => {
    const plate = normalizeVehiclePlate(vehicle.plate);
    const model = String(vehicle.model || '').trim();

    if (!plate || !model) return null;

    return {
      plate,
      model,
      type: String(vehicle.type || 'PROPRIO').trim() || 'PROPRIO',
      status: normalizeVehicleStatus(vehicle.status),
      costCenter: String(vehicle.costCenter || '').trim(),
      lastMaintenance: toIsoDateTime(vehicle.lastMaintenance) || nowIso(),
    };
  };

  // Expanded Workshop Handlers
  const handleViewVehicle = (plate: string) => {
    const vehicle = vehicleDetails.find(v => v.plate === plate);
    if (vehicle) {
      setSelectedVehicle(vehicle);
      setWorkshopActiveModule('vehicles');
    }
  };

  const handleCreateMaintenancePlan = async (plan: Omit<MaintenancePlan, 'id' | 'createdAt' | 'updatedAt'>) => {
    const id = `PLAN-${Date.now()}`;
    const { error } = await api.from('maintenance_plans_expanded').insert({
      id,
      name: plan.name,
      vehicle_type: plan.vehicleType,
      vehicle_model: plan.vehicleModel,
      operation_type: plan.operationType,
      triggers: plan.triggers,
      parts: plan.parts,
      checklist_sections: plan.checklistSections,
      estimated_hours: plan.estimatedHours,
      estimated_cost: plan.estimatedCost,
      services: plan.services,
      is_active: true,
      created_by: user?.name || 'Sistema'
    });

    if (!error) {
      showNotification('Plano de manutenção criado com sucesso!', 'success');
      setWorkshopActiveModule('preventive');
    } else {
      showNotification('Erro ao criar plano', 'error');
    }
  };

  const handleSaveInspectionTemplate = async (template: Omit<InspectionTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
    const id = `TMPL-${Date.now()}`;
    const { error } = await api.from('inspection_templates').insert({
      id,
      name: template.name,
      version: template.version,
      vehicle_model: template.vehicleModel,
      description: template.description,
      sections: template.sections,
      is_active: template.isActive,
      created_by: user?.name || 'Sistema'
    });

    if (!error) {
      showNotification('Template salvo com sucesso!', 'success');
      setWorkshopActiveModule('checklists');
    } else {
      showNotification('Erro ao salvar template', 'error');
    }
  };

  // Vehicle Management Handlers
  const handleAddVehicle = async (vehicleData: Vehicle) => {
    const normalizedVehicle = normalizeVehicleInput(vehicleData);
    if (!normalizedVehicle) {
      showNotification('Preencha placa e modelo para cadastrar o veiculo.', 'error');
      return;
    }

    const { data, error } = await api.from('vehicles').insert(toVehiclePayload(normalizedVehicle));

    if (!error) {
      const persisted = data ? mapVehicleRowToState(data) : normalizedVehicle;
      setVehicles((prev) => [persisted, ...prev.filter((item) => item.plate !== persisted.plate)]);
      showNotification('Veiculo cadastrado com sucesso!', 'success');
    } else {
      showNotification(error || 'Erro ao cadastrar veiculo', 'error');
    }
  };

  const handleUpdateVehicle = async (updatedVehicle: Vehicle) => {
    const normalizedVehicle = normalizeVehicleInput(updatedVehicle);
    if (!normalizedVehicle) {
      showNotification('Dados de veiculo invalidos para atualizacao.', 'error');
      return;
    }

    const { data, error } = await api.from('vehicles').eq('plate', normalizedVehicle.plate).update({
      model: normalizedVehicle.model,
      type: normalizedVehicle.type,
      status: normalizedVehicle.status,
      cost_center: normalizedVehicle.costCenter || null,
      last_maintenance: toIsoDateTime(normalizedVehicle.lastMaintenance),
    });

    if (!error) {
      const persisted = Array.isArray(data) && data.length > 0 ? mapVehicleRowToState(data[0]) : normalizedVehicle;
      setVehicles((prev) => prev.map((item) => (item.plate === normalizedVehicle.plate ? persisted : item)));
      showNotification('Veiculo atualizado com sucesso!', 'success');
    } else {
      showNotification(error || 'Erro ao atualizar veiculo', 'error');
    }
  };

  const handleDeleteVehicle = async (plate: string) => {
    const { error } = await api.from('vehicles').eq('plate', plate).delete();
    if (!error) {
      setVehicles(prev => prev.filter(v => v.plate !== plate));
      showNotification('Veiculo removido com sucesso!', 'success');
    } else {
      showNotification('Erro ao remover veiculo', 'error');
    }
  };

  const handleImportVehicles = async (incomingVehicles: Vehicle[]) => {
    if (!Array.isArray(incomingVehicles) || incomingVehicles.length === 0) {
      showNotification('Nenhum veiculo valido para importar.', 'warning');
      return;
    }

    const dedupedByPlate = new Map<string, Vehicle>();
    let ignored = 0;

    incomingVehicles.forEach((vehicle) => {
      const normalized = normalizeVehicleInput(vehicle);
      if (!normalized) {
        ignored += 1;
        return;
      }
      dedupedByPlate.set(normalized.plate, normalized);
    });

    const normalizedVehicles = Array.from(dedupedByPlate.values());
    if (normalizedVehicles.length === 0) {
      showNotification('Nenhum registro aproveitavel na planilha.', 'error');
      return;
    }

    const { data: dbVehicles, error: listError } = await api.from('vehicles').select('plate');
    if (listError) {
      showNotification('Falha ao carregar frota atual para importar.', 'error');
      return;
    }

    const existingPlates = new Set(
      (dbVehicles || [])
        .map((row: any) => normalizeVehiclePlate(row?.plate))
        .filter(Boolean)
    );

    const toInsert: Vehicle[] = [];
    const toUpdate: Vehicle[] = [];

    normalizedVehicles.forEach((vehicle) => {
      if (existingPlates.has(vehicle.plate)) {
        toUpdate.push(vehicle);
      } else {
        toInsert.push(vehicle);
      }
    });

    let inserted = 0;
    let updated = 0;
    let failed = 0;

    if (toInsert.length > 0) {
      const { data, error } = await api
        .from('vehicles')
        .insert(toInsert.map((vehicle) => toVehiclePayload(vehicle)));

      if (error) {
        failed += toInsert.length;
      } else {
        inserted = Array.isArray(data) ? data.length : toInsert.length;
      }
    }

    for (const vehicle of toUpdate) {
      const { error } = await api.from('vehicles').eq('plate', vehicle.plate).update({
        model: vehicle.model,
        type: vehicle.type,
        status: vehicle.status,
        cost_center: vehicle.costCenter || null,
        last_maintenance: toIsoDateTime(vehicle.lastMaintenance),
      });

      if (error) {
        failed += 1;
      } else {
        updated += 1;
      }
    }

    const { data: refreshedVehicles } = await api.from('vehicles').select('*');
    if (refreshedVehicles) {
      setVehicles(refreshedVehicles.map((row: any) => mapVehicleRowToState(row)));
    }

    const summary = `Importacao concluida: ${inserted} novos, ${updated} atualizados${ignored > 0 ? `, ${ignored} ignorados` : ''}${failed > 0 ? `, ${failed} falharam` : ''}.`;
    showNotification(summary, failed > 0 ? (inserted > 0 || updated > 0 ? 'warning' : 'error') : 'success');
  };

  // Integration: Request Parts from Workshop to Warehouse
  const handleRequestPartsFromWorkshop = async (vehiclePlate: string, items: { sku: string; name: string; qty: number }[]) => {
    const dept = 'OFICINA';
    const priority = 'normal';
    
    for (const item of items) {
      const requestId = `SA-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const { error } = await api.from('material_requests').insert({
        id: requestId,
        sku: item.sku,
        name: item.name,
        qty: item.qty,
        plate: vehiclePlate,
        dept: dept,
        priority: priority,
        status: 'aprovacao',
        cost_center: `OFICINA-${vehiclePlate}`,
        warehouse_id: activeWarehouse,
        created_by: user?.name || 'Sistema'
      });

      if (!error) {
        const newRequest: MaterialRequest = {
          id: requestId,
          sku: item.sku,
          name: item.name,
          qty: item.qty,
          plate: vehiclePlate,
          dept: dept,
          priority: priority,
          status: 'aprovacao',
          timestamp: new Date().toLocaleTimeString('pt-BR'),
          costCenter: `OFICINA-${vehiclePlate}`,
          warehouseId: activeWarehouse
        };
        setMaterialRequests(prev => [newRequest, ...prev]);
      }
    }

    showNotification(`Solicitação SA criada para ${items.length} item(s) do veículo ${vehiclePlate}!`, 'success');
    addActivity('expedicao', 'Solicitação SA da Oficina', `Veículo ${vehiclePlate} solicitou ${items.length} peça(s)`);
  };

  // Multi-Warehouse States
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [activeWarehouse, setActiveWarehouse] = useState<string>('ARMZ28');
  const [userWarehouses, setUserWarehouses] = useState<string[]>(['ARMZ28', 'ARMZ33']); // Default for admin
  const [isLoading, setIsLoading] = useState(true);
  const [materialRequests, setMaterialRequests] = useState<MaterialRequest[]>([]);
  const [isPurchaseOrdersFullyLoaded, setIsPurchaseOrdersFullyLoaded] = useState(false);
  const [isMovementsFullyLoaded, setIsMovementsFullyLoaded] = useState(false);
  const [isMaterialRequestsFullyLoaded, setIsMaterialRequestsFullyLoaded] = useState(false);
  const [isInventoryFullyLoaded, setIsInventoryFullyLoaded] = useState(false);
  const [isDeferredModuleLoading, setIsDeferredModuleLoading] = useState(false);
  const [movementsPage, setMovementsPage] = useState(1);
  const [purchaseOrdersPage, setPurchaseOrdersPage] = useState(1);
  const [materialRequestsPage, setMaterialRequestsPage] = useState(1);
  const [masterDataItemsPage, setMasterDataItemsPage] = useState(1);
  const [vendorsPage, setVendorsPage] = useState(1);
  const [pagedMovements, setPagedMovements] = useState<Movement[]>([]);
  const [pagedPurchaseOrders, setPagedPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [pagedMaterialRequests, setPagedMaterialRequests] = useState<MaterialRequest[]>([]);
  const [pagedMasterDataItems, setPagedMasterDataItems] = useState<InventoryItem[]>([]);
  const [pagedVendors, setPagedVendors] = useState<Vendor[]>([]);
  const [hasMoreMovements, setHasMoreMovements] = useState(false);
  const [hasMorePurchaseOrders, setHasMorePurchaseOrders] = useState(false);
  const [hasMoreMaterialRequests, setHasMoreMaterialRequests] = useState(false);
  const [hasMoreMasterDataItems, setHasMoreMasterDataItems] = useState(false);
  const [hasMoreVendors, setHasMoreVendors] = useState(false);
  const [isMovementsPageLoading, setIsMovementsPageLoading] = useState(false);
  const [isPurchaseOrdersPageLoading, setIsPurchaseOrdersPageLoading] = useState(false);
  const [isMaterialRequestsPageLoading, setIsMaterialRequestsPageLoading] = useState(false);
  const [isMasterDataItemsPageLoading, setIsMasterDataItemsPageLoading] = useState(false);
  const [masterDataItemsTotal, setMasterDataItemsTotal] = useState(0);
  const [isVendorsPageLoading, setIsVendorsPageLoading] = useState(false);
  const [vendorsTotal, setVendorsTotal] = useState(0);

  const fullLoadInFlight = useRef<Set<string>>(new Set());
  const loadBootstrapDataRef = useRef<((warehouseId?: string) => Promise<void>) | null>(null);
  const pageFetchSequence = useRef({
    movements: 0,
    purchaseOrders: 0,
    materialRequests: 0,
    masterDataItems: 0,
    vendors: 0
  });

  const INITIAL_INVENTORY_LIMIT = 100; // Reduzido de 500 para melhorar desempenho
  const INITIAL_PURCHASE_ORDERS_LIMIT = 100; // Reduzido de 300
  const INITIAL_MOVEMENTS_LIMIT = 100; // Reduzido de 300
  const INITIAL_MATERIAL_REQUESTS_LIMIT = 100; // Reduzido de 300
  const MOVEMENTS_PAGE_SIZE = 50; // Reduzido de 120
  const PURCHASE_ORDERS_PAGE_SIZE = 30; // Reduzido de 60
  const MATERIAL_REQUESTS_PAGE_SIZE = 30; // Reduzido de 60
  const MASTER_DATA_ITEMS_PAGE_SIZE = 50;
  const VENDORS_PAGE_SIZE = 50;

  const toPtBrDateTime = (value: unknown, fallback = ''): string => {
    const parsed = formatDateTimePtBR(value, fallback);
    if (parsed) return parsed;
    if (typeof value === 'string' && value.trim().length > 0) return value;
    return fallback;
  };

  const toIsoDateTime = (value: unknown): string | null => {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();

    const text = String(value).trim();
    if (!text) return null;

    const parsed = parseDateLike(text);
    if (!parsed) return null;
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
  };

  const nowIso = () => new Date().toISOString();

  const normalizeUserSession = (rawUser: any): User => {
    const normalizedRole = normalizeUserRole(rawUser?.role);
    const normalizedModules = normalizeUserModules(rawUser?.modules, normalizedRole);
    const normalizedWarehouses = normalizeAllowedWarehouses(
      rawUser?.allowedWarehouses ?? rawUser?.allowed_warehouses,
      ['ARMZ28']
    );

    return {
      id: String(rawUser?.id || `usr-${Date.now()}`),
      name: String(rawUser?.name || 'Usuário'),
      email: String(rawUser?.email || ''),
      role: normalizedRole,
      status: String(rawUser?.status || '').toLowerCase() === 'inativo' ? 'Inativo' : 'Ativo',
      lastAccess: toPtBrDateTime(rawUser?.lastAccess ?? rawUser?.last_access, formatDateTimePtBR(new Date(), '')),
      avatar:
        String(rawUser?.avatar || '').trim() ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(String(rawUser?.name || 'Usuario'))}&background=0D8ABC&color=fff`,
      modules: normalizedModules,
      allowedWarehouses: normalizedWarehouses,
      hasWorkshopAccess: normalizeWorkshopAccess(
        rawUser?.modules,
        rawUser?.hasWorkshopAccess ?? rawUser?.has_workshop_access,
        normalizedRole
      ),
    };
  };

  const buildUserModulesPayload = (
    modules: Module[] | undefined,
    hasWorkshopAccess: boolean | undefined,
    role: User['role']
  ): string[] => {
    const cleaned = (Array.isArray(modules) ? modules.map((moduleId) => String(moduleId)) : [])
      .map((token) => token.trim())
      .filter(Boolean)
      .filter((token) => {
        const normalized = token
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();
        return normalized !== 'workshop' && normalized !== 'oficina';
      });

    if (role === 'admin' || hasWorkshopAccess) {
      cleaned.push('workshop');
    }

    return [...new Set(cleaned)];
  };

  const generateUuid = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    // Fallback RFC4122-ish UUID for environments without crypto.randomUUID.
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
      const rand = Math.floor(Math.random() * 16);
      const value = char === 'x' ? rand : (rand & 0x3) | 0x8;
      return value.toString(16);
    });
  };

  const createPOStatusHistoryEntry = (
    status: PurchaseOrderStatus,
    description: string,
    actor = user?.name || 'Sistema'
  ): ApprovalRecord => ({
    id: generateUuid(),
    action: 'status_changed',
    by: actor,
    at: nowIso(),
    status,
    description
  });

  const appendPOHistory = (
    history: ApprovalRecord[] | undefined,
    entry: ApprovalRecord
  ): ApprovalRecord[] => [...(history || []), entry];

  const mapPurchaseOrders = (rows: any[]): PurchaseOrder[] => rows.map((po: any) => ({
    id: po.id,
    vendor: po.vendor,
    requestDate: toPtBrDateTime(po.request_date),
    status: po.status,
    priority: po.priority,
    total: po.total,
    requester: po.requester,
    items: po.items,
    quotes: po.quotes,
    selectedQuoteId: po.selected_quote_id,
    sentToVendorAt: toPtBrDateTime(po.sent_to_vendor_at),
    receivedAt: toPtBrDateTime(po.received_at),
    quotesAddedAt: toPtBrDateTime(po.quotes_added_at),
    approvedAt: toPtBrDateTime(po.approved_at),
    rejectedAt: toPtBrDateTime(po.rejected_at),
    vendorOrderNumber: po.vendor_order_number,
    approvalHistory: Array.isArray(po.approval_history)
      ? po.approval_history.map((entry: any) => ({
        id: entry.id,
        action: entry.action,
        by: entry.by || 'Sistema',
        at: toPtBrDateTime(entry.at),
        reason: entry.reason,
        description: entry.description,
        status: entry.status
      }))
      : [],
    warehouseId: po.warehouse_id || 'ARMZ28'
  }));

  const mapMovements = (rows: any[]): Movement[] => rows.map((m: any) => ({
    id: m.id,
    sku: m.sku,
    productName: m.product_name || m.name || 'Produto Indefinido',
    type: m.type as Movement['type'],
    quantity: m.quantity,
    timestamp: toPtBrDateTime(m.timestamp, formatDateTimePtBR(new Date(), '')),
    user: m.user || 'Sistema',
    location: m.location || 'N/A',
    reason: m.reason || 'Sem motivo registrado',
    orderId: m.order_id,
    warehouseId: m.warehouse_id || 'ARMZ28'
  }));

  const mapMaterialRequests = (rows: any[]): MaterialRequest[] => rows.map((r: any) => ({
    id: r.id,
    sku: r.sku,
    name: r.name,
    qty: r.qty,
    plate: r.plate,
    dept: r.dept,
    priority: r.priority,
    status: r.status,
    timestamp: formatTimePtBR(r.created_at, '--:--'),
    costCenter: r.cost_center,
    warehouseId: r.warehouse_id
  }));

  const mapInventoryRows = (rows: any[]): InventoryItem[] => rows.map((item: any) => ({
    sku: item.sku,
    name: item.name,
    location: item.location,
    batch: item.batch,
    expiry: item.expiry,
    quantity: item.quantity,
    status: item.status,
    imageUrl: item.image_url,
    category: item.category,
    abcCategory: item.abc_category,
    lastCountedAt: item.last_counted_at,
    unit: item.unit || 'UN',
    minQty: item.min_qty,
    maxQty: item.max_qty,
    leadTime: item.lead_time || 7,
    safetyStock: item.safety_stock || 5,
    warehouseId: item.warehouse_id || 'ARMZ28'
  }));

  const mapVendorRows = (rows: any[]): Vendor[] =>
    rows.map((vendor: any) => ({
      id: String(vendor?.id || ''),
      name: String(vendor?.name || ''),
      cnpj: String(vendor?.cnpj || ''),
      category: String(vendor?.category || ''),
      contact: String(vendor?.contact || ''),
      email: String(vendor?.email || ''),
      status: String(vendor?.status || 'Ativo').toLowerCase() === 'bloqueado' ? 'Bloqueado' : 'Ativo',
    }));

  const loadInventoryForWarehouse = async (warehouseId: string, limit = INITIAL_INVENTORY_LIMIT) => {
    const safeLimit = Math.max(1, limit);
    const { data } = await api
      .from('inventory')
      .select('*')
      .eq('warehouse_id', warehouseId)
      .order('created_at', { ascending: false })
      .limit(safeLimit + 1);

    if (!data) {
      setInventory([]);
      setInventoryWarehouseScope(warehouseId);
      setIsInventoryFullyLoaded(true);
      return;
    }

    setInventory(mapInventoryRows(data.slice(0, safeLimit)));
    setInventoryWarehouseScope(warehouseId);
    setIsInventoryFullyLoaded(data.length <= safeLimit);
  };

  const loadDeferredDataset = async (
    key: 'purchase_orders' | 'movements' | 'material_requests',
    loader: () => Promise<void>
  ) => {
    if (fullLoadInFlight.current.has(key)) return;

    fullLoadInFlight.current.add(key);
    setIsDeferredModuleLoading(true);
    try {
      await loader();
    } finally {
      fullLoadInFlight.current.delete(key);
      if (fullLoadInFlight.current.size === 0) {
        setIsDeferredModuleLoading(false);
      }
    }
  };

  const loadPurchaseOrdersFull = async () => {
    if (isPurchaseOrdersFullyLoaded) return;

    await loadDeferredDataset('purchase_orders', async () => {
      const { data: poData } = await api.from('purchase_orders').select('*').order('request_date', { ascending: false });
      if (!poData) return;

      setPurchaseOrders(mapPurchaseOrders(poData));
      setIsPurchaseOrdersFullyLoaded(true);
    });
  };

  const loadMovementsFull = async () => {
    if (isMovementsFullyLoaded) return;

    await loadDeferredDataset('movements', async () => {
      const { data: movData } = await api.from('movements').select('*').order('timestamp', { ascending: false });
      if (!movData) return;

      setMovements(mapMovements(movData));
      setIsMovementsFullyLoaded(true);
    });
  };

  const loadMaterialRequestsFull = async () => {
    if (isMaterialRequestsFullyLoaded) return;

    await loadDeferredDataset('material_requests', async () => {
      const { data: reqData } = await api.from('material_requests').select('*').order('created_at', { ascending: false });
      if (!reqData) return;

      setMaterialRequests(mapMaterialRequests(reqData));
      setIsMaterialRequestsFullyLoaded(true);
    });
  };

  const fetchMovementsPage = async (page: number) => {
    if (!user) return;

    const safePage = Math.max(1, page);
    const requestId = ++pageFetchSequence.current.movements;
    setIsMovementsPageLoading(true);
    try {
      const { data } = await api
        .from('movements')
        .select('*')
        .eq('warehouse_id', activeWarehouse)
        .order('timestamp', { ascending: false })
        .limit(MOVEMENTS_PAGE_SIZE + 1)
        .offset((safePage - 1) * MOVEMENTS_PAGE_SIZE);

      if (requestId !== pageFetchSequence.current.movements) return;

      if (!data) {
        setHasMoreMovements(false);
        setPagedMovements([]);
        return;
      }

      const mapped = mapMovements(data);
      setHasMoreMovements(mapped.length > MOVEMENTS_PAGE_SIZE);
      setPagedMovements(mapped.slice(0, MOVEMENTS_PAGE_SIZE));
    } catch (error) {
      if (requestId !== pageFetchSequence.current.movements) return;
      console.error('Erro ao carregar pagina de movimentacoes:', error);
      setHasMoreMovements(false);
      setPagedMovements([]);
    } finally {
      if (requestId === pageFetchSequence.current.movements) {
        setIsMovementsPageLoading(false);
      }
    }
  };

  const fetchPurchaseOrdersPage = async (page: number) => {
    if (!user) return;

    const safePage = Math.max(1, page);
    const requestId = ++pageFetchSequence.current.purchaseOrders;
    setIsPurchaseOrdersPageLoading(true);
    try {
      const { data } = await api
        .from('purchase_orders')
        .select('*')
        .eq('warehouse_id', activeWarehouse)
        .order('request_date', { ascending: false })
        .limit(PURCHASE_ORDERS_PAGE_SIZE + 1)
        .offset((safePage - 1) * PURCHASE_ORDERS_PAGE_SIZE);

      if (requestId !== pageFetchSequence.current.purchaseOrders) return;

      if (!data) {
        setHasMorePurchaseOrders(false);
        setPagedPurchaseOrders([]);
        return;
      }

      const mapped = mapPurchaseOrders(data);
      setHasMorePurchaseOrders(mapped.length > PURCHASE_ORDERS_PAGE_SIZE);
      setPagedPurchaseOrders(mapped.slice(0, PURCHASE_ORDERS_PAGE_SIZE));
    } catch (error) {
      if (requestId !== pageFetchSequence.current.purchaseOrders) return;
      console.error('Erro ao carregar pagina de pedidos:', error);
      setHasMorePurchaseOrders(false);
      setPagedPurchaseOrders([]);
    } finally {
      if (requestId === pageFetchSequence.current.purchaseOrders) {
        setIsPurchaseOrdersPageLoading(false);
      }
    }
  };

  const fetchMaterialRequestsPage = async (page: number) => {
    if (!user) return;

    const safePage = Math.max(1, page);
    const requestId = ++pageFetchSequence.current.materialRequests;
    setIsMaterialRequestsPageLoading(true);
    try {
      const { data } = await api
        .from('material_requests')
        .select('*')
        .eq('warehouse_id', activeWarehouse)
        .order('created_at', { ascending: false })
        .limit(MATERIAL_REQUESTS_PAGE_SIZE + 1)
        .offset((safePage - 1) * MATERIAL_REQUESTS_PAGE_SIZE);

      if (requestId !== pageFetchSequence.current.materialRequests) return;

      if (!data) {
        setHasMoreMaterialRequests(false);
        setPagedMaterialRequests([]);
        return;
      }

      const mapped = mapMaterialRequests(data);
      setHasMoreMaterialRequests(mapped.length > MATERIAL_REQUESTS_PAGE_SIZE);
      setPagedMaterialRequests(mapped.slice(0, MATERIAL_REQUESTS_PAGE_SIZE));
    } catch (error) {
      if (requestId !== pageFetchSequence.current.materialRequests) return;
      console.error('Erro ao carregar pagina de requisicoes:', error);
      setHasMoreMaterialRequests(false);
      setPagedMaterialRequests([]);
    } finally {
      if (requestId === pageFetchSequence.current.materialRequests) {
        setIsMaterialRequestsPageLoading(false);
      }
    }
  };

  const fetchMasterDataItemsPage = async (page: number) => {
    if (!user) return;

    const safePage = Math.max(1, page);
    const requestId = ++pageFetchSequence.current.masterDataItems;
    setIsMasterDataItemsPageLoading(true);

    try {
      const [countResponse, rowsResponse] = await Promise.all([
        api.from('inventory/count').eq('warehouse_id', activeWarehouse).execute(),
        api
          .from('inventory')
          .select('*')
          .eq('warehouse_id', activeWarehouse)
          .order('created_at', { ascending: false })
          .limit(MASTER_DATA_ITEMS_PAGE_SIZE + 1)
          .offset((safePage - 1) * MASTER_DATA_ITEMS_PAGE_SIZE),
      ]);

      if (requestId !== pageFetchSequence.current.masterDataItems) return;

      const total = Number((countResponse as any)?.data?.total || 0);
      setMasterDataItemsTotal(Number.isFinite(total) ? total : 0);

      const rows = Array.isArray((rowsResponse as any)?.data) ? (rowsResponse as any).data : [];
      const mapped = mapInventoryRows(rows);
      setHasMoreMasterDataItems(mapped.length > MASTER_DATA_ITEMS_PAGE_SIZE);
      setPagedMasterDataItems(mapped.slice(0, MASTER_DATA_ITEMS_PAGE_SIZE));
    } catch (error) {
      if (requestId !== pageFetchSequence.current.masterDataItems) return;
      console.error('Erro ao carregar pagina do cadastro de itens:', error);
      setMasterDataItemsTotal(0);
      setHasMoreMasterDataItems(false);
      setPagedMasterDataItems([]);
    } finally {
      if (requestId === pageFetchSequence.current.masterDataItems) {
        setIsMasterDataItemsPageLoading(false);
      }
    }
  };

  const fetchVendorsPage = async (page: number) => {
    if (!user) return;

    const safePage = Math.max(1, page);
    const requestId = ++pageFetchSequence.current.vendors;
    setIsVendorsPageLoading(true);

    try {
      const [countResponse, rowsResponse] = await Promise.all([
        api.from('vendors/count').execute(),
        api
          .from('vendors')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(VENDORS_PAGE_SIZE + 1)
          .offset((safePage - 1) * VENDORS_PAGE_SIZE),
      ]);

      if (requestId !== pageFetchSequence.current.vendors) return;

      const total = Number((countResponse as any)?.data?.total || 0);
      setVendorsTotal(Number.isFinite(total) ? total : 0);

      const rows = Array.isArray((rowsResponse as any)?.data) ? (rowsResponse as any).data : [];
      const mapped = mapVendorRows(rows);
      setHasMoreVendors(mapped.length > VENDORS_PAGE_SIZE);
      setPagedVendors(mapped.slice(0, VENDORS_PAGE_SIZE));
    } catch (error) {
      if (requestId !== pageFetchSequence.current.vendors) return;
      console.error('Erro ao carregar pagina do cadastro de fornecedores:', error);
      setVendorsTotal(0);
      setHasMoreVendors(false);
      setPagedVendors([]);
    } finally {
      if (requestId === pageFetchSequence.current.vendors) {
        setIsVendorsPageLoading(false);
      }
    }
  };

  // Function to seed mock data for testing without backend
  const seedMockData = () => {
    console.log('=== SEEDING MOCK DATA ===');
    
    // Seed Warehouses
    const mockWarehouses: Warehouse[] = [
      { id: 'ARMZ28', name: 'CD Manaus', description: 'Centro de Distribuição Manaus', location: 'Manaus - AM', isActive: true, managerName: 'João Silva', managerEmail: 'joao@logiwms.com' },
      { id: 'ARMZ33', name: 'CD São Paulo', description: 'Centro de Distribuição São Paulo', location: 'São Paulo - SP', isActive: true, managerName: 'Maria Santos', managerEmail: 'maria@logiwms.com' }
    ];
    setWarehouses(mockWarehouses);
    saveToStorage(STORAGE_KEYS.WAREHOUSES, mockWarehouses);

    // Seed Inventory
    const mockInventory: InventoryItem[] = [
      { sku: 'SKU-000028', name: 'Item Teste 28', location: 'A-01-01', batch: 'B001', expiry: '2026-12-31', quantity: 50, status: 'disponivel', imageUrl: '', category: 'Teste', unit: 'UN', minQty: 10, maxQty: 100, leadTime: 7, safetyStock: 5, warehouseId: 'ARMZ28' },
      { sku: 'SKU-000030', name: 'Item Teste 30', location: 'A-01-02', batch: 'B002', expiry: '2026-12-31', quantity: 25, status: 'disponivel', imageUrl: '', category: 'Teste', unit: 'UN', minQty: 5, maxQty: 50, leadTime: 7, safetyStock: 5, warehouseId: 'ARMZ28' },
      { sku: 'SKU-000011', name: 'Item Teste 11', location: 'B-02-01', batch: 'B003', expiry: '2026-12-31', quantity: 100, status: 'disponivel', imageUrl: '', category: 'Pneus', unit: 'UN', minQty: 20, maxQty: 200, leadTime: 14, safetyStock: 10, warehouseId: 'ARMZ28' },
      { sku: 'OLEO-15W40', name: 'Óleo Motor 15W40', location: 'C-01-01', batch: 'B004', expiry: '2027-06-30', quantity: 200, status: 'disponivel', imageUrl: '', category: 'Óleo', unit: 'L', minQty: 50, maxQty: 500, leadTime: 10, safetyStock: 25, warehouseId: 'ARMZ28' },
      { sku: 'FILT-001', name: 'Filtro de Óleo', location: 'C-01-02', batch: 'B005', expiry: '2027-12-31', quantity: 80, status: 'disponivel', imageUrl: '', category: 'Filtros', unit: 'UN', minQty: 15, maxQty: 150, leadTime: 10, safetyStock: 10, warehouseId: 'ARMZ28' }
    ];
    setInventory(mockInventory);
    saveToStorage(STORAGE_KEYS.INVENTORY, mockInventory);
    setInventoryWarehouseScope('ARMZ28');
    setIsInventoryFullyLoaded(true);

    // Seed Vehicles
    const mockVehicles: Vehicle[] = [
      { plate: 'BGM-1001', model: 'Volvo FH 540', type: 'Caminhão', status: 'Disponível', lastMaintenance: '15/01/2026', costCenter: 'OPS-CD' },
      { plate: 'CHN-1002', model: 'Mercedes Actros', type: 'Carreta', status: 'Disponível', lastMaintenance: '20/01/2026', costCenter: 'MAN-OFI' },
      { plate: 'DIO-1003', model: 'Volvo FH 460', type: 'Utilitário', status: 'Em Viagem', lastMaintenance: '10/01/2026', costCenter: 'OPS-CD' },
      { plate: 'ELQ-1004', model: 'Scania R450', type: 'Caminhão', status: 'Manutenção', lastMaintenance: '25/01/2026', costCenter: 'OPS-CD' }
    ];
    setVehicles(mockVehicles);
    saveToStorage(STORAGE_KEYS.VEHICLES, mockVehicles);

    // Seed Material Requests
    const mockRequests: MaterialRequest[] = [
      { id: 'REQ-6037', sku: 'SKU-000028', name: 'Item Teste 28', qty: 2, plate: 'BGM-1001', dept: 'OF-OPERAÇÕES', priority: 'normal', status: 'aprovacao', timestamp: '14:05', costCenter: 'OPS-CD', warehouseId: 'ARMZ28' },
      { id: 'REQ-TEST-000041', sku: 'SKU-000030', name: 'Item Teste 30', qty: 1, plate: 'CHN-1002', dept: 'MAN-OFICINA', priority: 'alta', status: 'separacao', timestamp: '13:30', costCenter: 'MAN-OFI', warehouseId: 'ARMZ28' },
      { id: 'REQ-OLD-0001', sku: 'SKU-000011', name: 'Item Teste 11', qty: 5, plate: 'DIO-1003', dept: 'OF-OPERAÇÕES', priority: 'normal', status: 'entregue', timestamp: '12:00', costCenter: 'OPS-CD', warehouseId: 'ARMZ28' }
    ];
    setMaterialRequests(mockRequests);
    saveToStorage(STORAGE_KEYS.REQUESTS, mockRequests);
    setPagedMaterialRequests(mockRequests.slice(0, MATERIAL_REQUESTS_PAGE_SIZE));
    setIsMaterialRequestsFullyLoaded(true);
    setHasMoreMaterialRequests(false);

    // Seed Purchase Orders
    const mockPOs: PurchaseOrder[] = [
      { id: 'PO-001', vendor: 'Fornecedor A', requestDate: '09/02/2026', status: 'requisicao', priority: 'urgente', total: 5000, requester: 'Sistema', items: [{ sku: 'SKU-000028', name: 'Item Teste 28', qty: 20, price: 100 }], warehouseId: 'ARMZ28', approvalHistory: [] },
      { id: 'PO-002', vendor: 'Fornecedor B', requestDate: '08/02/2026', status: 'aprovado', priority: 'normal', total: 3000, requester: 'João Silva', items: [{ sku: 'OLEO-15W40', name: 'Óleo Motor 15W40', qty: 50, price: 30 }], warehouseId: 'ARMZ28', approvalHistory: [] }
    ];
    setPurchaseOrders(mockPOs);
    saveToStorage(STORAGE_KEYS.PURCHASE_ORDERS, mockPOs);
    setPagedPurchaseOrders(mockPOs.slice(0, PURCHASE_ORDERS_PAGE_SIZE));

    // Seed Users
    const mockUsers: User[] = [
      {
        id: 'admin',
        name: 'Administrador',
        email: 'admin@logiwms.com',
        role: 'admin',
        status: 'Ativo',
        modules: normalizeUserModules(['warehouse', 'workshop'], 'admin'),
        allowedWarehouses: ['ARMZ28', 'ARMZ33'],
        lastAccess: formatDateTimePtBR(new Date(), ''),
        avatar: 'https://ui-avatars.com/api/?name=Administrador&background=0D8ABC&color=fff',
        hasWorkshopAccess: true,
      },
      {
        id: 'oper',
        name: 'Operador',
        email: 'oper@logiwms.com',
        role: 'operator',
        status: 'Ativo',
        modules: normalizeUserModules(['warehouse'], 'operator'),
        allowedWarehouses: ['ARMZ28'],
        lastAccess: formatDateTimePtBR(new Date(), ''),
        avatar: 'https://ui-avatars.com/api/?name=Operador&background=0D8ABC&color=fff',
        hasWorkshopAccess: false,
      }
    ];
    setUsers(mockUsers);
    saveToStorage(STORAGE_KEYS.USERS, mockUsers);

    // Seed Movements
    const mockMovements: Movement[] = [
      { id: 'M001', sku: 'SKU-000028', productName: 'Item Teste 28', type: 'entrada', quantity: 50, timestamp: '09/02/2026 14:00', user: 'Sistema', location: 'A-01-01', reason: 'Carga inicial de teste', warehouseId: 'ARMZ28' },
      { id: 'M002', sku: 'SKU-000030', productName: 'Item Teste 30', type: 'entrada', quantity: 25, timestamp: '09/02/2026 14:00', user: 'Sistema', location: 'A-01-02', reason: 'Carga inicial de teste', warehouseId: 'ARMZ28' }
    ];
    setMovements(mockMovements);
    saveToStorage(STORAGE_KEYS.MOVEMENTS, mockMovements);
    setPagedMovements(mockMovements.slice(0, MOVEMENTS_PAGE_SIZE));

    console.log('=== MOCK DATA SEEDED SUCCESSFULLY ===');
    showNotification('Dados de teste carregados com sucesso!', 'success');
  };

  // API Data Fetching
  useEffect(() => {
    const fetchData = async (warehouseId = activeWarehouse) => {
      try {
        const { data: whData } = await api.from('warehouses').select('*').eq('is_active', true);
        if (whData) setWarehouses(whData.map((w: any) => ({
          id: w.id,
          name: w.name,
          description: w.description,
          location: w.location,
          isActive: w.is_active,
          managerName: w.manager_name,
          managerEmail: w.manager_email
        })));

        await loadInventoryForWarehouse(warehouseId, INITIAL_INVENTORY_LIMIT);

        const { data: batchesData } = await api.from('cyclic_batches').select('*').order('created_at', { ascending: false });
        if (batchesData) setCyclicBatches(batchesData.map((b: any) => ({
          id: b.id,
          status: b.status,
          scheduledDate: toPtBrDateTime(b.scheduled_date),
          completedAt: toPtBrDateTime(b.completed_at),
          accuracyRate: b.accuracy_rate,
          totalItems: b.total_items,
          divergentItems: b.divergent_items,
          warehouseId: b.warehouse_id || 'ARMZ28'
        })));

        const { data: venData } = await api.from('vendors').select('*');
        if (venData) setVendors(mapVendorRows(venData));

        const { data: vehData } = await api.from('vehicles').select('*');
        if (vehData) setVehicles(vehData.map((row: any) => mapVehicleRowToState(row)));

        const { data: userData } = await api.from('users').select('*');
        if (userData) {
          const mappedUsers = userData.map((u: any) => normalizeUserSession(u));
          setUsers(mappedUsers);
        }

        const { data: poData } = await api
          .from('purchase_orders')
          .select('*')
          .order('request_date', { ascending: false })
          .limit(INITIAL_PURCHASE_ORDERS_LIMIT);
        if (poData) {
          setPurchaseOrders(mapPurchaseOrders(poData));
          setIsPurchaseOrdersFullyLoaded(poData.length < INITIAL_PURCHASE_ORDERS_LIMIT);
        }

        const { data: movData } = await api
          .from('movements')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(INITIAL_MOVEMENTS_LIMIT);
        if (movData) {
          setMovements(mapMovements(movData));
          setIsMovementsFullyLoaded(movData.length < INITIAL_MOVEMENTS_LIMIT);
        }

        const { data: notifData } = await api.from('notifications').select('*').order('created_at', { ascending: false }).limit(20);
        if (notifData) setAppNotifications(notifData.map((n: any) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          type: n.type as AppNotification['type'],
          read: n.read,
          createdAt: n.created_at,
          userId: n.user_id
        })));




        const { data: reqData } = await api
          .from('material_requests')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(INITIAL_MATERIAL_REQUESTS_LIMIT);
        if (reqData) {
          setMaterialRequests(mapMaterialRequests(reqData));
          setIsMaterialRequestsFullyLoaded(reqData.length < INITIAL_MATERIAL_REQUESTS_LIMIT);
        }

      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    loadBootstrapDataRef.current = fetchData;

    const initAuth = async () => {
      setIsLoading(true);
      try {
        const savedToken = localStorage.getItem(AUTH_TOKEN_KEY);
        if (savedToken) {
          api.setAuthToken(savedToken);
          // Carrega dados apenas quando há sessão autenticada.
          await fetchData(activeWarehouse);
        } else {
          localStorage.removeItem('logged_user');
        }

        const savedUser = localStorage.getItem('logged_user');
        if (savedUser && savedToken) {
          const parsedUser = JSON.parse(savedUser);
          handleLogin(parsedUser, undefined, false);
        }
      } catch (e) {
        console.error('Session recovery failed', e);
        localStorage.removeItem('logged_user');
        api.clearAuthToken();
      } finally {
        setIsLoading(false);
      }
    };

    // Chamamos o initAuth que agora gerencia o carregamento total
    initAuth();

    // Subscribe removed - using refresh on action
    return () => {
      loadBootstrapDataRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    // Relatorios usa dataset completo para consolidacao e indicadores.
    if (activeModule === 'relatorios' && !isPurchaseOrdersFullyLoaded) {
      void loadPurchaseOrdersFull();
    }
  }, [activeModule, user, isPurchaseOrdersFullyLoaded]);

  useEffect(() => {
    if (activeModule !== 'movimentacoes') return;
    if (!user) return;
    void fetchMovementsPage(movementsPage);
  }, [activeModule, user, activeWarehouse, movementsPage]);

  useEffect(() => {
    if (activeModule !== 'compras') return;
    if (!user) return;
    void fetchPurchaseOrdersPage(purchaseOrdersPage);
  }, [activeModule, user, activeWarehouse, purchaseOrdersPage]);

  useEffect(() => {
    if (activeModule !== 'expedicao') return;
    if (!user) return;
    void fetchMaterialRequestsPage(materialRequestsPage);
  }, [activeModule, user, activeWarehouse, materialRequestsPage]);

  useEffect(() => {
    if (activeModule !== 'cadastro') return;
    if (!user) return;
    void fetchMasterDataItemsPage(masterDataItemsPage);
  }, [activeModule, user, activeWarehouse, masterDataItemsPage]);

  useEffect(() => {
    if (activeModule !== 'cadastro') return;
    if (!user) return;
    void fetchVendorsPage(vendorsPage);
  }, [activeModule, user, vendorsPage]);

  useEffect(() => {
    if (!user) return;
    if (inventoryWarehouseScope === activeWarehouse) return;
    void loadInventoryForWarehouse(activeWarehouse, INITIAL_INVENTORY_LIMIT);
  }, [user, activeWarehouse, inventoryWarehouseScope]);

  useEffect(() => {
    if (!user) return;

    pageFetchSequence.current.movements += 1;
    pageFetchSequence.current.purchaseOrders += 1;
    pageFetchSequence.current.materialRequests += 1;
    pageFetchSequence.current.masterDataItems += 1;
    pageFetchSequence.current.vendors += 1;

    setMovementsPage(1);
    setPurchaseOrdersPage(1);
    setMaterialRequestsPage(1);
    setMasterDataItemsPage(1);
    setVendorsPage(1);

    setPagedMovements([]);
    setPagedPurchaseOrders([]);
    setPagedMaterialRequests([]);
    setPagedMasterDataItems([]);
    setPagedVendors([]);
    setHasMoreMovements(false);
    setHasMorePurchaseOrders(false);
    setHasMoreMaterialRequests(false);
    setHasMoreMasterDataItems(false);
    setHasMoreVendors(false);
    setMasterDataItemsTotal(0);
    setVendorsTotal(0);
  }, [activeWarehouse, user]);

  // Auto-logout after 10 minutes of inactivity
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (user) {
        timeoutId = setTimeout(() => {
          logout();
          showNotification('Sessão encerrada por inatividade (10 min)', 'warning');
        }, 10 * 60 * 1000); // 10 minutes
      }
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];

    if (user) {
      resetTimer();
      events.forEach(event => document.addEventListener(event, resetTimer));
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => document.removeEventListener(event, resetTimer));
    };
  }, [user]);

  const handleAddUser = async (newUser: User) => {
    const modulesPayload = buildUserModulesPayload(newUser.modules, newUser.hasWorkshopAccess, newUser.role);
    const { error } = await api.from('users').insert({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      status: newUser.status,
      last_access: toIsoDateTime(newUser.lastAccess),
      avatar: newUser.avatar,
      password: newUser.password,
      modules: modulesPayload,
      allowed_warehouses: newUser.allowedWarehouses
    });

    if (!error) {
      const persistedUser = normalizeUserSession({ ...newUser, modules: modulesPayload });
      setUsers(prev => [...prev, persistedUser]);
      addActivity('alerta', 'Novo Usuário', `Usuário ${newUser.name} cadastrado`);
      showNotification(`Usuário ${newUser.name} cadastrado com sucesso!`, 'success');
    } else {
      showNotification('Erro ao cadastrar usuário', 'error');
    }
  };

  const handleUpdateUser = async (updatedUser: User) => {
    const modulesPayload = buildUserModulesPayload(
      updatedUser.modules,
      updatedUser.hasWorkshopAccess,
      updatedUser.role
    );
    const { error } = await api.from('users').eq('id', updatedUser.id).update({
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      status: updatedUser.status,
      avatar: updatedUser.avatar,
      password: updatedUser.password,
      modules: modulesPayload,
      allowed_warehouses: updatedUser.allowedWarehouses
    });

    if (!error) {
      const persistedUser = normalizeUserSession({ ...updatedUser, modules: modulesPayload });
      setUsers(prev => prev.map(u => u.id === updatedUser.id ? persistedUser : u));
      if (user?.id === persistedUser.id) {
        setUser(persistedUser);
        localStorage.setItem('logged_user', JSON.stringify(persistedUser));
        if (currentSystemModule === 'workshop' && persistedUser.role !== 'admin' && !persistedUser.hasWorkshopAccess) {
          setCurrentSystemModule(null);
          showNotification('Acesso à Oficina removido para este usuário.', 'warning');
          return;
        }
      }
      showNotification('Usuário atualizado com sucesso!', 'success');
    } else {
      showNotification('Erro ao atualizar usuário', 'error');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const { error } = await api.from('users').eq('id', userId).delete();
    if (!error) {
      setUsers(prev => prev.filter(u => u.id !== userId));
      showNotification('Usuário removido.', 'success');
    } else {
      showNotification('Erro ao remover usuário', 'error');
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const addActivity = (type: Activity['type'], title: string, subtitle: string) => {
    const newActivity: Activity = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      title,
      subtitle,
      time: formatTimePtBR(new Date(), '--:--')
    };
    setActivities(prev => [newActivity, ...prev.slice(0, 19)]);
  };

  const addNotification = async (title: string, message: string, type: AppNotification['type']) => {
    const { data: newNotifs, error } = await api.from('notifications').insert({
      title,
      message,
      type,
      read: false
    });
    const insertedNotif = Array.isArray(newNotifs) ? newNotifs[0] : newNotifs;

    if (!error && insertedNotif) {
      setAppNotifications(prev => [{
        id: insertedNotif.id,
        title: insertedNotif.title,
        message: insertedNotif.message,
        type: insertedNotif.type as AppNotification['type'],
        read: insertedNotif.read,
        createdAt: insertedNotif.created_at || new Date().toISOString(),
        userId: insertedNotif.user_id
      }, ...prev.slice(0, 19)]);
      showNotification(title, type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'success');
    }
  };

  const markNotificationAsRead = async (id: string) => {
    const { error } = await api.from('notifications').eq('id', id).update({ read: true });
    if (!error) {
      setAppNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    }
  };

  const markAllNotificationsAsRead = async () => {
    const { error } = await api.from('notifications').eq('read', false).update({ read: true });
    if (!error) {
      setAppNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  };

  const recordMovement = async (
    type: Movement['type'],
    item: InventoryItem,
    quantity: number,
    reason: string,
    orderId?: string,
    warehouseId?: string
  ) => {
    const movementTimestampIso = nowIso();
    const movementId = generateUuid();
    const movementWarehouseId = warehouseId || item.warehouseId || activeWarehouse;
    const newMovement: Movement = {
      id: movementId,
      timestamp: toPtBrDateTime(movementTimestampIso, formatDateTimePtBR(new Date(), '')),
      type,
      sku: item.sku,
      productName: item.name,
      quantity: quantity,
      user: user?.name || 'Sistema',
      location: item.location,
      reason: reason,
      orderId: orderId,
      warehouseId: movementWarehouseId // NOVO
    };

    const { error } = await api.from('movements').insert({
      id: movementId,
      timestamp: movementTimestampIso,
      type: newMovement.type,
      sku: newMovement.sku,
      product_name: newMovement.productName,
      quantity: newMovement.quantity,
      user: newMovement.user,
      location: newMovement.location,
      reason: newMovement.reason,
      order_id: newMovement.orderId,
      warehouse_id: movementWarehouseId
    });

    if (!error) {
      setMovements(prev => [newMovement, ...prev]);
      if (movementWarehouseId === activeWarehouse && movementsPage === 1) {
        setPagedMovements(prev => [newMovement, ...prev].slice(0, MOVEMENTS_PAGE_SIZE));
      }
    } else {
      console.error('Error recording movement:', error);
    }
  };

  const evaluateStockLevels = async (updatedInventory: InventoryItem[]) => {
    for (const item of updatedInventory) {
      if (item.quantity < item.minQty) {
        const alreadyRequested = purchaseOrders.some(po =>
          (po.status === 'pendente' || po.status === 'rascunho' || po.status === 'requisicao') &&
          po.items.some(i => i.sku === item.sku)
        );

        const neededQty = Math.max(0, item.maxQty - item.quantity);
        if (neededQty <= 0) continue;
        const createdAtIso = nowIso();
        const initialHistory = [
          createPOStatusHistoryEntry('requisicao', 'Pedido automático gerado por regra de estoque crítico')
        ];

        const autoPO: PurchaseOrder = {
          id: `AUTO-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          vendor: 'A definir via cotações',
          requestDate: toPtBrDateTime(createdAtIso, formatDateTimePtBR(new Date(), '')),
          status: 'requisicao',
          priority: 'urgente',
          total: 0,
          requester: 'Norte Tech AI (Estoque Crítico)',
          items: [{
            sku: item.sku,
            name: item.name,
            qty: neededQty,
            price: 0
          }],
          approvalHistory: initialHistory,
          warehouseId: activeWarehouse // NOVO
        };

        const { error } = await api.from('purchase_orders').insert({
          id: autoPO.id,
          vendor: autoPO.vendor,
          request_date: createdAtIso,
          status: autoPO.status,
          priority: autoPO.priority,
          total: autoPO.total,
          requester: autoPO.requester,
          items: autoPO.items,
          approval_history: initialHistory,
          warehouse_id: activeWarehouse
        });

        if (!error) {
          setPurchaseOrders(prev => [autoPO, ...prev]);
          setPagedPurchaseOrders(prev => [autoPO, ...prev].slice(0, PURCHASE_ORDERS_PAGE_SIZE));
          addActivity('alerta', 'Reposição Automática', `Pedido gerado para ${item.sku} (Saldo: ${item.quantity})`);
          addNotification(
            `Estoque Crítico: ${item.sku}`,
            `Saldo de ${item.quantity} está abaixo do mínimo (${item.minQty}). Requisição de compra ${autoPO.id} gerada.`,
            'warning'
          );
        }
      }
    }
  };

  const handleApprovePO = async (id: string) => {
    const po = purchaseOrders.find(o => o.id === id);
    if (!po) return;

    const approvedAtIso = nowIso();
    const approvedAtDisplay = toPtBrDateTime(approvedAtIso, formatDateTimePtBR(new Date(), ''));
    const approvalRecord: ApprovalRecord = {
      id: generateUuid(),
      action: 'approved',
      by: user?.name || 'Gestor de Compras',
      at: approvedAtIso,
      status: 'aprovado',
      description: 'Aprovado por gestor'
    };
    const statusRecord = createPOStatusHistoryEntry('aprovado', 'Aprovação financeira e operacional concluída');

    const newApprovalHistory = appendPOHistory(
      appendPOHistory(po.approvalHistory, approvalRecord),
      statusRecord
    );

    const { error } = await api.from('purchase_orders').eq('id', id).update({
      status: 'aprovado',
      approval_history: newApprovalHistory,
      approved_at: approvedAtIso
    });

    if (!error) {
      setPurchaseOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'aprovado', approvalHistory: newApprovalHistory, approvedAt: approvedAtDisplay } : o));
      setPagedPurchaseOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'aprovado', approvalHistory: newApprovalHistory, approvedAt: approvedAtDisplay } : o));
      addActivity('compra', 'Aprovação de Pedido', `Requisição ${id} aprovada - pronta para envio`);
      addNotification(
        `Aprovação: ${id}`,
        `Pedido aprovado e pronto para envio ao fornecedor.`,
        'success'
      );
      showNotification(`Pedido ${id} aprovado! Marque como enviado quando despachar.`, 'success');
    }
  };

  const handleRejectPO = async (id: string, reason?: string) => {
    const po = purchaseOrders.find(o => o.id === id);
    if (!po) return;

    const rejectedAtIso = nowIso();
    const rejectedAtDisplay = toPtBrDateTime(rejectedAtIso, formatDateTimePtBR(new Date(), ''));
    const rejectionRecord: ApprovalRecord = {
      id: generateUuid(),
      action: 'rejected',
      by: user?.name || 'Gestor de Compras',
      at: rejectedAtIso,
      reason: reason || 'Sem justificativa',
      status: 'requisicao',
      description: 'Rejeitado e retornado para nova cotação'
    };
    const statusRecord = createPOStatusHistoryEntry('requisicao', `Pedido retornado para cotação. Motivo: ${reason || 'Sem justificativa'}`);

    const newApprovalHistory = appendPOHistory(
      appendPOHistory(po.approvalHistory, rejectionRecord),
      statusRecord
    );

    const { error } = await api.from('purchase_orders').eq('id', id).update({
      status: 'requisicao', // Volta para o início do fluxo
      approval_history: newApprovalHistory,
      rejected_at: rejectedAtIso
    });

    if (!error) {
      setPurchaseOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'requisicao', approvalHistory: newApprovalHistory, rejectedAt: rejectedAtDisplay } : o));
      setPagedPurchaseOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'requisicao', approvalHistory: newApprovalHistory, rejectedAt: rejectedAtDisplay } : o));

      // Criar log de movimentação para métricas (auditoria de fluxo)
      await recordMovement('ajuste', { sku: 'N/A', name: `PEDIDO ${id}`, location: 'ADMIN' } as any, 0, `Rejeição: ${reason || 'Sem justificativa'}`, id);

      addActivity('alerta', 'Pedido Rejeitado', `Requisição ${id} retornou para cotação`);
      addNotification(
        `Rejeição: ${id}`,
        `Pedido rejeitado. Justificativa: ${reason || 'Sem justificativa'}.`,
        'error'
      );
      showNotification(`Pedido ${id} rejeitado. Refaça as cotações.`, 'warning');
    }
  };

  const handleDeletePO = async (id: string) => {
    if (!user || user.role !== 'admin') {
      showNotification('Somente administrador pode remover pedidos de compra.', 'error');
      return;
    }

    const order = purchaseOrders.find((po) => po.id === id);
    if (!order) {
      showNotification('Pedido não encontrado.', 'error');
      return;
    }

    if (order.status === 'recebido') {
      showNotification('Não é permitido remover pedido já recebido.', 'warning');
      return;
    }

    const { error } = await api.from('purchase_orders').eq('id', id).delete();
    if (error) {
      showNotification('Erro ao remover pedido de compra.', 'error');
      return;
    }

    setPurchaseOrders((prev) => prev.filter((po) => po.id !== id));
    setPagedPurchaseOrders((prev) => prev.filter((po) => po.id !== id));
    addActivity('compra', 'Pedido Removido', `Pedido ${id} removido por ${user.name}`);
    showNotification(`Pedido ${id} removido com sucesso.`, 'success');
  };

  const handleRecalculateROP = async () => {
    showNotification('Iniciando recálculo dinâmico de ROP...', 'warning');

    // 1. Filtrar saídas dos últimos 30 dias
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const relevantMovements = movements.filter(m => {
      const movementDate = parseDateLike(m.timestamp);
      if (!movementDate) return false;
      return m.type === 'saida' && movementDate >= thirtyDaysAgo;
    });

    // 2. Calcular Uso Diário Médio (ADU) por SKU
    const usageBySku: Record<string, number> = {};
    relevantMovements.forEach(m => {
      usageBySku[m.sku] = (usageBySku[m.sku] || 0) + m.quantity;
    });

    const updatedItems: InventoryItem[] = [];
    let updateCount = 0;

    for (const item of inventory) {
      const totalUsage = usageBySku[item.sku] || 0;
      const adu = totalUsage / 30; // Média diária nos últimos 30 dias

      // ROP = (ADU * LeadTime) + SafetyStock
      // Fallback para leadTime=7 e safetyStock=5 se estiverem indefinidos
      const leadTime = item.leadTime || 7;
      const safetyStock = item.safetyStock || 5;
      const newMinQty = Math.ceil((adu * leadTime) + safetyStock);

      if (newMinQty !== item.minQty) {
        const { error } = await api.from('inventory').eq('sku', item.sku).update({ min_qty: newMinQty });
        if (!error) {
          updatedItems.push({ ...item, minQty: newMinQty });
          updateCount++;
        } else {
          updatedItems.push(item);
        }
      } else {
        updatedItems.push(item);
      }
    }

    if (updateCount > 0) {
      setInventory(updatedItems);
      showNotification(`ROP atualizado para ${updateCount} itens com base no histórico.`, 'success');
      addActivity('alerta', 'ROP Recalculado', `${updateCount} itens tiveram seus níveis mínimos ajustados dinamicamente.`);
      // Re-avaliar níveis de estoque com os novos mínimos
      evaluateStockLevels(updatedItems);
    } else {
      showNotification('Nenhuma alteração de ROP necessária no momento.', 'success');
    }
  };

  const handleSyncAutoPOs = async (manualItems: { sku: string; qty: number }[]) => {
    // Filtra pedidos automáticos ativos (não recebidos ou rejeitados)
    const autoPOs = purchaseOrders.filter(po =>
      po.id.startsWith('AUTO-') &&
      ['requisicao', 'cotacao', 'pendente', 'aprovado'].includes(po.status)
    );

    for (const manual of manualItems) {
      for (const auto of autoPOs) {
        const itemIdx = auto.items.findIndex(i => i.sku === manual.sku);
        if (itemIdx > -1) {
          const currentQty = auto.items[itemIdx].qty;
          const newQty = Math.max(0, currentQty - manual.qty);

          let updatedItems;
          if (newQty === 0) {
            updatedItems = auto.items.filter(i => i.sku !== manual.sku);
          } else {
            updatedItems = auto.items.map(i => i.sku === manual.sku ? { ...i, qty: newQty } : i);
          }

          if (updatedItems.length === 0) {
            // Rejeita/Cancela o pedido se ficar vazio
            await api.from('purchase_orders').eq('id', auto.id).update({ status: 'cancelado' });
            setPurchaseOrders(prev => prev.map(p => p.id === auto.id ? { ...p, status: 'cancelado' as const } : p));
            setPagedPurchaseOrders(prev => prev.map(p => p.id === auto.id ? { ...p, status: 'cancelado' as const } : p));
            showNotification(`Pedido AUTO ${auto.id} cancelado: suprido por manual.`, 'success');
          } else {
            // Atualiza quantidades
            await api.from('purchase_orders').eq('id', auto.id).update({ items: updatedItems });
            setPurchaseOrders(prev => prev.map(p => p.id === auto.id ? { ...p, items: updatedItems } : p));
            setPagedPurchaseOrders(prev => prev.map(p => p.id === auto.id ? { ...p, items: updatedItems } : p));
          }
        }
      }
    }
  };

  const handleCreatePO = async (newOrder: PurchaseOrder) => {
    const createdAtIso = nowIso();
    const initialHistory = appendPOHistory(
      newOrder.approvalHistory,
      createPOStatusHistoryEntry('requisicao', 'Pedido criado via painel LogiWMS')
    );
    const orderWithStatus: PurchaseOrder = {
      ...newOrder,
      status: 'requisicao',
      warehouseId: activeWarehouse,
      requestDate: toPtBrDateTime(createdAtIso, formatDateTimePtBR(new Date(), '')),
      approvalHistory: initialHistory
    };
    const { error } = await api.from('purchase_orders').insert({
      id: orderWithStatus.id,
      vendor: orderWithStatus.vendor,
      status: orderWithStatus.status,
      priority: orderWithStatus.priority,
      total: orderWithStatus.total,
      requester: orderWithStatus.requester,
      items: orderWithStatus.items,
      plate: orderWithStatus.plate,
      cost_center: orderWithStatus.costCenter,
      request_date: createdAtIso,
      approval_history: initialHistory,
      warehouse_id: activeWarehouse
    });

    if (!error) {
      // Sincronizar com pedidos automáticos para evitar duplicidade
      await handleSyncAutoPOs(orderWithStatus.items.map(i => ({ sku: i.sku, qty: i.qty })));

      setPurchaseOrders(prev => [orderWithStatus, ...prev]);
      setPagedPurchaseOrders(prev => [orderWithStatus, ...prev].slice(0, PURCHASE_ORDERS_PAGE_SIZE));
      addActivity('compra', 'Nova Requisição', `Pedido manual ${orderWithStatus.id} criado - aguardando cotações`);
      showNotification(`Pedido ${orderWithStatus.id} criado! Adicione 3 cotações para prosseguir.`, 'success');
    }
  };

  const handleAddQuotes = async (poId: string, quotes: Quote[]) => {
    const po = purchaseOrders.find((entry) => entry.id === poId);
    if (!po) return;

    const quotesAddedAtIso = nowIso();
    const quotesAddedAt = toPtBrDateTime(quotesAddedAtIso, formatDateTimePtBR(new Date(), ''));
    const newApprovalHistory = appendPOHistory(
      po.approvalHistory,
      createPOStatusHistoryEntry('cotacao', 'Cotação de fornecedores vinculada')
    );
    const { error } = await api.from('purchase_orders').eq('id', poId).update({
      quotes,
      status: 'cotacao',
      quotes_added_at: quotesAddedAtIso,
      approval_history: newApprovalHistory
    });

    if (!error) {
      setPurchaseOrders(prev => prev.map(o =>
        o.id === poId ? { ...o, quotes, status: 'cotacao' as const, quotesAddedAt, approvalHistory: newApprovalHistory } : o
      ));
      setPagedPurchaseOrders(prev => prev.map(o =>
        o.id === poId ? { ...o, quotes, status: 'cotacao' as const, quotesAddedAt, approvalHistory: newApprovalHistory } : o
      ));
      showNotification(`Cotações adicionadas ao pedido ${poId}`, 'success');
    }
  };

  const handleSendToApproval = async (poId: string, selectedQuoteId: string) => {
    const po = purchaseOrders.find(o => o.id === poId);
    if (!po) return;

    const selectedQuote = po.quotes?.find(q => q.id === selectedQuoteId);
    if (!selectedQuote) return;

    const updatedQuotes = po.quotes?.map(q => ({ ...q, isSelected: q.id === selectedQuoteId }));
    const newApprovalHistory = appendPOHistory(
      po.approvalHistory,
      createPOStatusHistoryEntry('pendente', 'Pedido enviado para aprovação do gestor')
    );

    const { error } = await api.from('purchase_orders').eq('id', poId).update({
      selected_quote_id: selectedQuoteId,
      vendor: selectedQuote.vendorName,
      total: selectedQuote.totalValue,
      status: 'pendente',
      quotes: updatedQuotes,
      approval_history: newApprovalHistory
    });

    if (!error) {
      setPurchaseOrders(prev => prev.map(o => o.id === poId ? {
        ...o,
        selectedQuoteId,
        vendor: selectedQuote.vendorName,
        total: selectedQuote.totalValue,
        status: 'pendente' as const,
        quotes: updatedQuotes,
        approvalHistory: newApprovalHistory
      } : o));
      setPagedPurchaseOrders(prev => prev.map(o => o.id === poId ? {
        ...o,
        selectedQuoteId,
        vendor: selectedQuote.vendorName,
        total: selectedQuote.totalValue,
        status: 'pendente' as const,
        quotes: updatedQuotes,
        approvalHistory: newApprovalHistory
      } : o));
      addActivity('compra', 'Cotações Enviadas', `Pedido ${poId} enviado para aprovação do gestor`);
      addNotification(
        `Pendente: ${poId}`,
        `Pedido enviado para sua aprovação. Vendor: ${selectedQuote.vendorName}.`,
        'info'
      );
      showNotification(`Pedido ${poId} enviado para aprovação!`, 'success');
    }
  };

  const handleMarkAsSent = async (poId: string, vendorOrderNumber: string) => {
    const po = purchaseOrders.find((entry) => entry.id === poId);
    if (!po) return;

    const sentAtIso = nowIso();
    const sentAt = toPtBrDateTime(sentAtIso, formatDateTimePtBR(new Date(), ''));
    const newApprovalHistory = appendPOHistory(
      po.approvalHistory,
      createPOStatusHistoryEntry('enviado', `Pedido enviado ao fornecedor (Nº ${vendorOrderNumber})`)
    );
    const { error } = await api.from('purchase_orders').eq('id', poId).update({
      status: 'enviado',
      vendor_order_number: vendorOrderNumber,
      sent_to_vendor_at: sentAtIso,
      approval_history: newApprovalHistory
    });

    if (!error) {
      setPurchaseOrders(prev => prev.map(o =>
        o.id === poId ? {
          ...o,
          status: 'enviado' as const,
          vendorOrderNumber,
          sentToVendorAt: sentAt,
          approvalHistory: newApprovalHistory
        } : o
      ));
      setPagedPurchaseOrders(prev => prev.map(o =>
        o.id === poId ? {
          ...o,
          status: 'enviado' as const,
          vendorOrderNumber,
          sentToVendorAt: sentAt,
          approvalHistory: newApprovalHistory
        } : o
      ));
      addActivity('compra', 'Pedido Enviado', `PO ${poId} despachado ao fornecedor - Nº ${vendorOrderNumber}`);
      showNotification(`Pedido ${poId} marcado como enviado!`, 'success');
    }
  };

  const handleProcessPicking = async (sku: string, qty: number) => {
    const item = inventory.find(i => i.sku === sku);
    if (!item || item.quantity < qty) {
      showNotification(`Estoque insuficiente para ${sku}`, 'error');
      return false;
    }

    const { error } = await api.from('inventory').eq('sku', sku).update({ quantity: item.quantity - qty });

    if (!error) {
      const newInventory = inventory.map(i => i.sku === sku ? { ...i, quantity: i.quantity - qty } : i);
      setInventory(newInventory);
      await recordMovement('saida', item, qty, 'Saída para Expedição / Ordem de Saída');
      evaluateStockLevels(newInventory);
      return true;
    } else {
      showNotification('Erro ao processar picking no servidor', 'error');
      return false;
    }
  };

  const handleUpdateInventoryItem = async (updatedItem: InventoryItem) => {
    const originalItem = inventory.find(i => i.sku === updatedItem.sku);
    if (originalItem) {
      const diff = updatedItem.quantity - originalItem.quantity;
      if (diff !== 0) {
        await recordMovement('ajuste', updatedItem, Math.abs(diff), `Ajuste manual de inventário (${diff > 0 ? '+' : '-'}${Math.abs(diff)})`);
      }
    }

    const { error } = await api.from('inventory').eq('sku', updatedItem.sku).update({
      name: updatedItem.name,
      location: updatedItem.location,
      batch: updatedItem.batch,
      expiry: updatedItem.expiry,
      quantity: updatedItem.quantity,
      status: updatedItem.status,
      image_url: updatedItem.imageUrl,
      category: updatedItem.category,
      unit: updatedItem.unit,
      min_qty: updatedItem.minQty,
      max_qty: updatedItem.maxQty,
      lead_time: updatedItem.leadTime,
      safety_stock: updatedItem.safetyStock
    });

    if (!error) {
      const newInventory = inventory.map(i => i.sku === updatedItem.sku ? updatedItem : i);
      setInventory(newInventory);

      // Limpeza Proativa de Pedidos AUTO-* 
      // Se o novo saldo já suprir a necessidade (inclusive se min/max mudaram ou apenas a quantidade)
      const autoPOs = purchaseOrders.filter(po =>
        po.id.startsWith('AUTO-') &&
        ['requisicao', 'cotacao', 'pendente'].includes(po.status) &&
        po.items.some(item => item.sku === updatedItem.sku)
      );

      for (const autoPO of autoPOs) {
        const itemIndex = autoPO.items.findIndex(item => item.sku === updatedItem.sku);
        if (itemIndex > -1) {
          // Recalcular quantidade: maxQty - quantidade atual
          const newQty = Math.max(0, updatedItem.maxQty - updatedItem.quantity);

          if (newQty <= 0) {
            // Se a nova quantidade for 0 ou negativa, remover o item do pedido
            const updatedItems = autoPO.items.filter(item => item.sku !== updatedItem.sku);

            if (updatedItems.length === 0) {
              // Se o pedido ficar vazio, cancelar/rejeitar
              await api.from('purchase_orders').update({ status: 'cancelado' }).eq('id', autoPO.id);
              setPurchaseOrders(prev => prev.map(po => po.id === autoPO.id ? { ...po, status: 'cancelado' as const } : po));
              addActivity('compra', 'Pedido Cancelado', `${autoPO.id} removido: estoque de ${updatedItem.sku} está em ${updatedItem.quantity}`);
            } else {
              // Atualizar pedido sem o item
              await api.from('purchase_orders').update({ items: updatedItems }).eq('id', autoPO.id);
              setPurchaseOrders(prev => prev.map(po => po.id === autoPO.id ? { ...po, items: updatedItems } : po));
            }
          } else {
            // Atualizar quantidade do item no pedido se houve mudança
            if (autoPO.items[itemIndex].qty !== newQty) {
              const updatedItems = autoPO.items.map(item =>
                item.sku === updatedItem.sku ? { ...item, qty: newQty } : item
              );

              await api.from('purchase_orders').update({ items: updatedItems }).eq('id', autoPO.id);
              setPurchaseOrders(prev => prev.map(po => po.id === autoPO.id ? { ...po, items: updatedItems } : po));

              addActivity('compra', 'Pedido Atualizado', `${autoPO.id} recalculado: ${updatedItem.sku} agora requisita ${newQty} un.`);
            }
          }
        }
      }

      if (autoPOs.length > 0) {
        showNotification(`${autoPOs.length} pedido(s) automático(s) sincronizado(s)`, 'success');
      }

      showNotification(`Item ${updatedItem.sku} atualizado com sucesso`, 'success');
      evaluateStockLevels(newInventory);
    } else {
      showNotification('Erro ao atualizar estoque', 'error');
    }
  };

  const handleCreateCyclicBatch = async (items: { sku: string, expected: number }[]) => {
    const normalizedItems = items
      .map((item) => ({
        sku: String(item.sku || '').trim(),
        expected: Number.parseInt(String(item.expected ?? 0), 10),
      }))
      .filter((item) => item.sku.length > 0 && Number.isFinite(item.expected) && item.expected >= 0);

    if (normalizedItems.length === 0) {
      showNotification('Nenhum item válido para criar lote de inventário.', 'warning');
      return null;
    }

    const batchId = `INV-${Date.now()}`;
    const scheduledAt = nowIso();
    const { error: batchError } = await api.from('cyclic_batches').insert({
      id: batchId,
      status: 'aberto',
      scheduled_date: scheduledAt,
      total_items: normalizedItems.length,
      divergent_items: 0,
      warehouse_id: activeWarehouse
    });

    if (batchError) {
      showNotification(`Erro ao criar lote de inventário: ${String(batchError)}`, 'error');
      return null;
    }

    const countsPayload = normalizedItems.map((item) => {
      const id = generateUuid();
      return {
        id,
        batch_id: batchId,
        sku: item.sku,
        expected_qty: item.expected,
        counted_qty: null,
        status: 'pendente',
        warehouse_id: activeWarehouse
      };
    });

    const { error: countsError } = await api.from('cyclic_counts').insert(countsPayload);
    if (countsError) {
      showNotification(`Lote criado, mas houve erro ao gerar contagens: ${String(countsError)}`, 'warning');
    }

    const { data: batchRows } = await api.from('cyclic_batches').select('*').eq('id', batchId).limit(1);
    const createdBatch = Array.isArray(batchRows) ? batchRows[0] : batchRows;

    if (createdBatch) {
      setCyclicBatches((prev) => [{
        id: createdBatch.id,
        status: createdBatch.status,
        scheduledDate: toPtBrDateTime(createdBatch.scheduled_date, scheduledAt),
        completedAt: toPtBrDateTime(createdBatch.completed_at),
        accuracyRate: createdBatch.accuracy_rate,
        totalItems: createdBatch.total_items,
        divergentItems: createdBatch.divergent_items,
        warehouseId: createdBatch.warehouse_id || activeWarehouse
      }, ...prev]);
    }

    showNotification(`Lote ${batchId} criado com ${normalizedItems.length} itens!`, 'success');
    return batchId;
  };

  const handleFinalizeCyclicBatch = async (batchId: string, counts: any[]) => {
    if (!Array.isArray(counts) || counts.length === 0) {
      showNotification('Não há itens para finalizar no lote.', 'warning');
      return;
    }

    const finalizedAt = nowIso();
    const normalizedCounts = counts.map((count) => {
      const expectedQty = Number.parseInt(String(count?.expectedQty ?? 0), 10);
      const parsedCountedQty = Number.parseInt(String(count?.countedQty ?? expectedQty), 10);
      const countedQty = Number.isFinite(parsedCountedQty) && parsedCountedQty >= 0 ? parsedCountedQty : expectedQty;
      return {
        ...count,
        sourceId: count?.sourceId ? String(count.sourceId) : '',
        sku: String(count?.sku || ''),
        expectedQty: Number.isFinite(expectedQty) ? expectedQty : 0,
        countedQty,
        status: countedQty === expectedQty ? 'contado' : 'ajustado'
      };
    }).filter((count) => count.sku.length > 0);

    if (normalizedCounts.length === 0) {
      showNotification('Contagens invalidas para finalizacao.', 'error');
      return;
    }

    const divergentItems = normalizedCounts.filter((count) => count.countedQty !== count.expectedQty).length;
    const accuracyRate = ((normalizedCounts.length - divergentItems) / normalizedCounts.length) * 100;

    const { error: batchError } = await api
      .from('cyclic_batches')
      .eq('id', batchId)
      .eq('warehouse_id', activeWarehouse)
      .update({
        status: 'concluido',
        completed_at: finalizedAt,
        accuracy_rate: accuracyRate,
        divergent_items: divergentItems
      });

    if (batchError) {
      showNotification(`Erro ao finalizar lote ${batchId}: ${String(batchError)}`, 'error');
      return;
    }

    let countUpdateFailures = 0;

    for (const count of normalizedCounts) {
      const countPayload = {
        counted_qty: count.countedQty,
        status: count.status,
        counted_at: finalizedAt,
        warehouse_id: activeWarehouse
      };

      let countUpdateResult: any = null;
      if (count.sourceId) {
        countUpdateResult = await api.from('cyclic_counts').eq('id', count.sourceId).update(countPayload);
      }

      if (!count.sourceId || countUpdateResult?.error) {
        countUpdateResult = await api
          .from('cyclic_counts')
          .eq('batch_id', batchId)
          .eq('sku', count.sku)
          .update(countPayload);
      }

      if (countUpdateResult?.error) {
        countUpdateFailures += 1;
      }

      const item = inventory.find((entry) => entry.sku === count.sku && entry.warehouseId === activeWarehouse);
      if (!item) {
        continue;
      }

      const diff = count.countedQty - count.expectedQty;
      if (diff !== 0) {
        await recordMovement(
          'ajuste',
          item,
          Math.abs(diff),
          `Ajuste automático via Inventário Cíclico (${batchId})`
        );
      }

      await api
        .from('inventory')
        .eq('sku', item.sku)
        .eq('warehouse_id', activeWarehouse)
        .update({
          quantity: count.countedQty,
          last_counted_at: finalizedAt
        });
    }

    setCyclicBatches((prev) => prev.map((batch) => (
      batch.id === batchId
        ? {
          ...batch,
          status: 'concluido',
          completedAt: toPtBrDateTime(finalizedAt, finalizedAt),
          accuracyRate,
          divergentItems
        }
        : batch
    )));

    setInventory((prev) => prev.map((item) => {
      if (item.warehouseId !== activeWarehouse) return item;
      const count = normalizedCounts.find((entry) => entry.sku === item.sku);
      if (!count) return item;
      return {
        ...item,
        quantity: count.countedQty,
        lastCountedAt: finalizedAt
      };
    }));

    addActivity('alerta', 'Inventário Finalizado', `Lote ${batchId} concluído com ${accuracyRate.toFixed(1)}% de acuracidade.`);
    showNotification(`Inventário ${batchId} finalizado!`, 'success');

    if (countUpdateFailures > 0) {
      showNotification(`${countUpdateFailures} registro(s) de contagem não puderam ser persistidos.`, 'warning');
    }
  };

  const handleClassifyABC = async () => {
    const PAGE_SIZE = 500;
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    const loadAllInventoryRows = async () => {
      const rows: any[] = [];
      let offset = 0;
      while (true) {
        const response = await api
          .from('inventory')
          .select('*')
          .eq('warehouse_id', activeWarehouse)
          .order('sku', { ascending: true })
          .limit(PAGE_SIZE)
          .offset(offset);

        if (response?.error) {
          throw new Error(String(response.error));
        }

        const chunk = Array.isArray(response?.data) ? response.data : [];
        rows.push(...chunk);
        if (chunk.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }
      return rows;
    };

    const loadAllMovementsRows = async () => {
      const rows: any[] = [];
      let offset = 0;
      while (true) {
        const response = await api
          .from('movements')
          .select('*')
          .eq('warehouse_id', activeWarehouse)
          .order('timestamp', { ascending: false })
          .limit(PAGE_SIZE)
          .offset(offset);

        if (response?.error) {
          throw new Error(String(response.error));
        }

        const chunk = Array.isArray(response?.data) ? response.data : [];
        rows.push(...chunk);
        if (chunk.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }
      return rows;
    };

    try {
      const [inventoryRows, movementRows] = await Promise.all([loadAllInventoryRows(), loadAllMovementsRows()]);

      if (inventoryRows.length === 0) {
        showNotification('Não há itens no estoque para classificar.', 'warning');
        return;
      }

      const cutoff = Date.now() - THIRTY_DAYS_MS;
      const skuFrequency: Record<string, number> = {};
      movementRows.forEach((movement) => {
        if (movement?.type !== 'saida') return;
        const timestamp = new Date(String(movement?.timestamp || '')).getTime();
        if (!Number.isFinite(timestamp) || timestamp < cutoff) return;
        const sku = String(movement?.sku || '');
        if (!sku) return;
        const qty = Number(movement?.quantity || 0);
        skuFrequency[sku] = (skuFrequency[sku] || 0) + (Number.isFinite(qty) ? qty : 0);
      });

      const ranking = inventoryRows
        .map((row) => ({
          sku: String(row?.sku || ''),
          freq: skuFrequency[String(row?.sku || '')] || 0
        }))
        .filter((entry) => entry.sku.length > 0)
        .sort((a, b) => b.freq - a.freq);

      if (ranking.length === 0) {
        showNotification('Não foi possível montar o ranking ABC.', 'warning');
        return;
      }

      const total = ranking.length;
      const aLimit = Math.ceil(total * 0.2);
      const bLimit = Math.ceil(total * 0.5);

      const updates = ranking.map((entry, index) => {
        let category: 'A' | 'B' | 'C' = 'C';
        if (index < aLimit) category = 'A';
        else if (index < bLimit) category = 'B';
        return { sku: entry.sku, category };
      });

      const CHUNK_SIZE = 25;
      let updateErrors = 0;
      for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
        const chunk = updates.slice(i, i + CHUNK_SIZE);
        const chunkResults = await Promise.all(
          chunk.map(async (entry) => api
            .from('inventory')
            .eq('sku', entry.sku)
            .eq('warehouse_id', activeWarehouse)
            .update({ abc_category: entry.category }))
        );
        chunkResults.forEach((result) => {
          if (result?.error) updateErrors += 1;
        });
      }

      await loadInventoryForWarehouse(activeWarehouse, INITIAL_INVENTORY_LIMIT);
      showNotification(
        updateErrors > 0
          ? `Classificacao ABC atualizada com ${updateErrors} falha(s).`
          : 'Classificacao ABC atualizada com base no giro dos ultimos 30 dias.',
        updateErrors > 0 ? 'warning' : 'success'
      );
    } catch (error: any) {
      showNotification(`Erro na classificação ABC: ${String(error?.message || error)}`, 'error');
    }
  };

  const handleFinalizeReceipt = async (receivedItems: any[], poId?: string): Promise<boolean> => {
    if (!poId) {
      showNotification('Selecione um pedido para finalizar o recebimento.', 'warning');
      return false;
    }

    const normalizedItems = receivedItems
      .map((item) => ({
        sku: String(item?.sku || '').trim(),
        received: Number.parseInt(String(item?.received ?? item?.qty ?? item?.quantity ?? 0), 10),
      }))
      .filter((item) => item.sku.length > 0 && Number.isFinite(item.received) && item.received > 0);

    if (normalizedItems.length === 0) {
      showNotification('Nenhum item valido para recebimento.', 'warning');
      return false;
    }

    const isConflictError = (errorMessage: string, httpStatus: number) => {
      const normalized = errorMessage.toLowerCase();
      return (
        httpStatus === 409 ||
        normalized.includes('ja foi recebido') ||
        normalized.includes('nao esta em status enviado')
      );
    };

    const syncOrderFromServer = async () => {
      const { data: latestOrderRows } = await api.from('purchase_orders').select('*').eq('id', poId).limit(1);
      const latestOrderRow = Array.isArray(latestOrderRows) ? latestOrderRows[0] : null;
      if (!latestOrderRow) return;

      const latestOrder = mapPurchaseOrders([latestOrderRow])[0];
      setPurchaseOrders((prev) =>
        prev.map((po) =>
          po.id === poId
            ? { ...po, status: latestOrder.status, receivedAt: latestOrder.receivedAt }
            : po
        )
      );
      setPagedPurchaseOrders((prev) =>
        prev.map((po) =>
          po.id === poId
            ? { ...po, status: latestOrder.status, receivedAt: latestOrder.receivedAt }
            : po
        )
      );
    };

    const finalizeReceiptLegacy = async () => {
      const { data: poRows, error: poReadError } = await api.from('purchase_orders').select('*').eq('id', poId).limit(1);
      if (poReadError) {
        return { ok: false, error: String(poReadError.message || 'Falha ao consultar pedido.') };
      }

      const poRow = Array.isArray(poRows) ? poRows[0] : null;
      if (!poRow) {
        return { ok: false, error: `Pedido ${poId} nao encontrado.` };
      }

      if (String(poRow.status) !== 'enviado') {
        return {
          ok: false,
          conflict: true,
          error: `Pedido ${poId} ja foi recebido ou nao esta em status enviado`,
        };
      }

      const receivedAtIso = nowIso();
      const receiptReason = `Entrada via Recebimento de ${poId}`;
      const movementRows: any[] = [];
      const inventoryUpdates: any[] = [];

      for (const item of normalizedItems) {
        const { data: inventoryRows, error: inventoryReadError } = await api
          .from('inventory')
          .select('*')
          .eq('sku', item.sku)
          .eq('warehouse_id', activeWarehouse)
          .limit(1);

        if (inventoryReadError) {
          return { ok: false, error: String(inventoryReadError.message || `Falha ao consultar ${item.sku}.`) };
        }

        const inventoryRow = Array.isArray(inventoryRows) ? inventoryRows[0] : null;
        if (!inventoryRow) {
          return { ok: false, error: `Item ${item.sku} nao encontrado no armazem ${activeWarehouse}.` };
        }

        const previousQty = Number(inventoryRow.quantity || 0);
        const newQty = previousQty + item.received;

        const { error: inventoryUpdateError } = await api
          .from('inventory')
          .eq('sku', item.sku)
          .eq('warehouse_id', activeWarehouse)
          .update({ quantity: newQty });

        if (inventoryUpdateError) {
          return { ok: false, error: String(inventoryUpdateError.message || `Falha ao atualizar ${item.sku}.`) };
        }

        const movementId = generateUuid();
        const movementTimestampIso = nowIso();
        const { data: insertedMovements, error: movementInsertError } = await api.from('movements').insert({
          id: movementId,
          timestamp: movementTimestampIso,
          type: 'entrada',
          sku: item.sku,
          product_name: inventoryRow.name || item.sku,
          quantity: item.received,
          user: user?.name || 'Sistema',
          location: inventoryRow.location || 'DOCA-01',
          reason: receiptReason,
          order_id: poId,
          warehouse_id: activeWarehouse,
        });

        if (movementInsertError) {
          return { ok: false, error: String(movementInsertError.message || `Falha ao registrar movimento ${item.sku}.`) };
        }

        const insertedMovement = Array.isArray(insertedMovements) ? insertedMovements[0] : insertedMovements;
        if (insertedMovement) movementRows.push(insertedMovement);

        inventoryUpdates.push({
          sku: item.sku,
          previous_qty: previousQty,
          received: item.received,
          new_qty: newQty,
        });
      }

      const { data: updatedPoRows, error: poUpdateError } = await api
        .from('purchase_orders')
        .eq('id', poId)
        .update({ status: 'recebido', received_at: receivedAtIso });

      if (poUpdateError) {
        return { ok: false, error: String(poUpdateError.message || 'Falha ao atualizar status do pedido.') };
      }

      const updatedPo = Array.isArray(updatedPoRows) ? updatedPoRows[0] : updatedPoRows;
      return {
        ok: true,
        data: {
          po: updatedPo || { ...poRow, status: 'recebido', received_at: receivedAtIso },
          inventory_updates: inventoryUpdates,
          movements: movementRows,
        },
      };
    };

    try {
      const receiptResponse = await api.from('receipts/finalize').insert({
        po_id: poId,
        warehouse_id: activeWarehouse,
        items: normalizedItems,
      });

      let receiptData: any = null;
      if (receiptResponse?.error) {
        const responseError = String(receiptResponse.error || 'Falha ao finalizar recebimento.');
        const httpStatus = Number(receiptResponse.httpStatus || 0);
        const endpointUnavailable =
          httpStatus === 404 ||
          responseError.toLowerCase().includes('not found') ||
          responseError.toLowerCase().includes('cannot post');

        if (endpointUnavailable) {
          const legacyResult = await finalizeReceiptLegacy();
          if (!legacyResult.ok) {
            const legacyError = String(legacyResult.error || 'Falha ao finalizar recebimento.');
            const conflict = Boolean(legacyResult.conflict);
            showNotification(
              conflict ? `${legacyError} (bloqueado para evitar duplicidade)` : legacyError,
              conflict ? 'warning' : 'error'
            );
            if (conflict) {
              await syncOrderFromServer();
            }
            return false;
          }
          receiptData = legacyResult.data || {};
        } else {
          const conflict = isConflictError(responseError, httpStatus);
          showNotification(
            conflict ? `${responseError} (bloqueado para evitar duplicidade)` : responseError,
            conflict ? 'warning' : 'error'
          );

          if (conflict) {
            await syncOrderFromServer();
          }
          return false;
        }
      } else {
        receiptData = receiptResponse?.data || {};
      }

      const poData = receiptData.po;
      const inventoryUpdates = Array.isArray(receiptData.inventory_updates) ? receiptData.inventory_updates : [];
      const movementRows = Array.isArray(receiptData.movements) ? receiptData.movements : [];
      const receivedAt = toPtBrDateTime(poData?.received_at, formatDateTimePtBR(new Date(), ''));
      const existingOrder = purchaseOrders.find((po) => po.id === poId);
      const receiveHistoryEntry = createPOStatusHistoryEntry('recebido', 'Entrega realizada normalmente');
      const mergedApprovalHistory = appendPOHistory(
        existingOrder?.approvalHistory || (Array.isArray(poData?.approval_history) ? poData.approval_history : []),
        receiveHistoryEntry
      );

      if (inventoryUpdates.length > 0) {
        const qtyBySku = new Map<string, number>();
        inventoryUpdates.forEach((entry: any) => {
          const sku = String(entry?.sku || '').trim();
          const qty = Number(entry?.new_qty);
          if (sku && Number.isFinite(qty)) {
            qtyBySku.set(sku, qty);
          }
        });

        setInventory((prev) =>
          prev.map((item) => {
            if (item.warehouseId !== activeWarehouse) return item;
            const nextQty = qtyBySku.get(item.sku);
            if (nextQty === undefined) return item;
            return { ...item, quantity: nextQty };
          })
        );
      } else {
        await loadInventoryForWarehouse(activeWarehouse, INITIAL_INVENTORY_LIMIT);
      }

      if (movementRows.length > 0) {
        const mappedMovements = mapMovements(movementRows).filter((movement) => movement.warehouseId === activeWarehouse);
        if (mappedMovements.length > 0) {
          setMovements((prev) => [...mappedMovements, ...prev]);
        }
      }

      const historyUpdate = await api
        .from('purchase_orders')
        .eq('id', poId)
        .update({ approval_history: mergedApprovalHistory });

      const effectiveHistory = mergedApprovalHistory;
      if (historyUpdate?.error) {
        showNotification('Recebimento concluído, mas houve falha ao persistir histórico detalhado do pedido.', 'warning');
      }

      setPurchaseOrders((prev) =>
        prev.map((po) => (po.id === poId ? { ...po, status: 'recebido' as const, receivedAt, approvalHistory: effectiveHistory } : po))
      );
      setPagedPurchaseOrders((prev) =>
        prev.map((po) => (po.id === poId ? { ...po, status: 'recebido' as const, receivedAt, approvalHistory: effectiveHistory } : po))
      );

      await handleSyncAutoPOs(normalizedItems.map((item) => ({ sku: item.sku, qty: item.received })));

      addActivity('recebimento', 'Recebimento Finalizado', `Carga ${poId} conferida e armazenada`);
      addNotification(
        `Recebimento: ${poId}`,
        `Carga recebida com sucesso. Estoque atualizado.`,
        'success'
      );
      showNotification(`Recebimento finalizado - ${poId}`, 'success');
      return true;
    } catch (error: any) {
      showNotification(`Erro ao finalizar recebimento: ${error?.message || 'erro desconhecido'}`, 'error');
      return false;
    }
  };

  /* Function to Add Master Record (Item, Vendor, Vehicle, CostCenter) */
  const handleAddMasterRecord = async (type: 'item' | 'vendor' | 'vehicle' | 'cost_center', data: any, isEdit: boolean) => {
    if (type === 'item') {
      if (isEdit) {
        const { error } = await api.from('inventory').eq('sku', data.sku).update({
          name: data.name,
          category: data.category,
          unit: data.unit,
          image_url: data.imageUrl,
          min_qty: data.minQty || 10,
          lead_time: data.leadTime || 7,
          safety_stock: data.safetyStock || 5
        });
        if (!error) {
          await loadInventoryForWarehouse(activeWarehouse, INITIAL_INVENTORY_LIMIT);
          if (activeModule === 'cadastro') {
            await fetchMasterDataItemsPage(masterDataItemsPage);
          }
          showNotification('Item atualizado com sucesso', 'success');
        } else {
          showNotification(`Erro ao atualizar item: ${error.message}`, 'error');
        }
      } else {
        const { data: insertedData, error } = await api.from('inventory').insert({
          name: data.name,
          category: data.category,
          unit: data.unit,
          image_url: data.imageUrl,
          quantity: 0,
          status: 'disponivel',
          location: 'DOCA-01',
          warehouse_id: activeWarehouse,
          min_qty: data.minQty || 10,
          max_qty: 1000,
          lead_time: 7,
          safety_stock: 5
        });

        const insertedRow = Array.isArray(insertedData) ? insertedData[0] : insertedData;
        if (!error && insertedRow) {
          const mappedInserted = mapInventoryRows([insertedRow])[0];
          if (mappedInserted) {
            await loadInventoryForWarehouse(activeWarehouse, INITIAL_INVENTORY_LIMIT);
            if (activeModule === 'cadastro') {
              setMasterDataItemsPage(1);
              await fetchMasterDataItemsPage(1);
            }
            await recordMovement('entrada', mappedInserted, 0, 'Criação de novo Código de Produto');
            showNotification('Item criado com sucesso', 'success');
          } else {
            showNotification('Item criado, mas houve falha ao atualizar a tela.', 'warning');
          }
        } else {
          showNotification(`Erro ao criar item: ${error?.message || 'falha desconhecida'}`, 'error');
        }
      }
    } else if (type === 'vendor') {
      if (isEdit) {
        const vendorPayload = {
          name: String(data?.name || ''),
          cnpj: String(data?.cnpj || ''),
          category: String(data?.category || ''),
          contact: String(data?.contact || ''),
          email: String(data?.email || ''),
          status: String(data?.status || 'Ativo').toLowerCase() === 'bloqueado' ? 'Bloqueado' : 'Ativo',
        };
        const { error } = await api.from('vendors').eq('id', data.id).update(vendorPayload);
        if (!error) {
          setVendors(prev => prev.map(v => (v.id === data.id ? { ...v, ...vendorPayload } : v)));
          if (activeModule === 'cadastro') {
            await fetchVendorsPage(vendorsPage);
          }
          showNotification('Fornecedor atualizado com sucesso', 'success');
        } else {
          showNotification(`Erro ao atualizar fornecedor: ${error.message}`, 'error');
        }
      } else {
        const newVendor: Vendor = {
          id: String(data?.id || Date.now().toString()),
          name: String(data?.name || ''),
          cnpj: String(data?.cnpj || ''),
          category: String(data?.category || ''),
          contact: String(data?.contact || ''),
          email: String(data?.email || ''),
          status: String(data?.status || 'Ativo').toLowerCase() === 'bloqueado' ? 'Bloqueado' : 'Ativo',
        };
        const { data: insertedData, error } = await api.from('vendors').insert(newVendor);
        if (!error) {
          const insertedRow = Array.isArray(insertedData) ? insertedData[0] : insertedData;
          const mappedInserted = insertedRow ? mapVendorRows([insertedRow])[0] : newVendor;
          setVendors(prev => [mappedInserted, ...prev.filter((vendor) => vendor.id !== mappedInserted.id)]);
          if (activeModule === 'cadastro') {
            setVendorsPage(1);
            await fetchVendorsPage(1);
          }
          showNotification('Fornecedor cadastrado com sucesso', 'success');
        } else {
          showNotification(`Erro ao cadastrar fornecedor: ${error.message}`, 'error');
        }
      }
    } else if (type === 'vehicle') {
      if (isEdit) {
        const { error } = await api.from('vehicles').eq('plate', data.plate).update({
          model: data.model,
          type: data.type,
          cost_center: data.costCenter
        });
        if (!error) {
          setVehicles(prev => prev.map(v => v.plate === data.plate ? { ...v, ...data } : v));
          showNotification('Veículo atualizado com sucesso', 'success');
        } else {
          showNotification(`Erro ao atualizar veículo: ${error.message}`, 'error');
        }
      } else {
        const maintenanceIso = nowIso();
        const newVehicle: Vehicle = { ...data, status: 'Disponível', lastMaintenance: toPtBrDateTime(maintenanceIso) };
        const { error } = await api.from('vehicles').insert({
          plate: newVehicle.plate,
          model: newVehicle.model,
          type: newVehicle.type,
          status: newVehicle.status,
          last_maintenance: maintenanceIso,
          cost_center: newVehicle.costCenter
        });

        if (!error) {
          setVehicles(prev => [...prev, newVehicle]);
          showNotification('Veículo cadastrado com sucesso', 'success');
        } else {
          showNotification(`Erro ao cadastrar veículo: ${error.message}`, 'error');
        }
      }
    }
  };

  const handleImportMasterRecords = async (type: 'item' | 'vendor' | 'vehicle', data: any[]) => {
    let table = '';
    let processedData = [];

    if (type === 'item') {
      table = 'inventory';
      processedData = data.map(d => ({
        // Mapping logic omitted for brevity, reusing existing structure logic would be better but simple mapping here
        name: d.name,
        category: d.category || 'Geral',
        unit: d.unit || 'UN',
        image_url: d.imageUrl,
        quantity: Math.round(Number(d.quantity) || 0),
        status: d.status || 'disponivel',
        sku: d.sku && !d.sku.startsWith('AUTO-') ? d.sku : undefined,
        warehouse_id: activeWarehouse,
        // Defaults
        min_qty: d.minQty || 10, max_qty: 1000, lead_time: 7, safety_stock: 5
      }));
    } else if (type === 'vendor') {
      table = 'vendors';
      processedData = data.map((d, index) => ({
        id: String(d.id || `${Date.now()}-${index}`),
        name: String(d.name || ''),
        cnpj: String(d.cnpj || ''),
        category: String(d.category || ''),
        contact: String(d.contact || ''),
        email: String(d.email || ''),
        status: String(d.status || 'Ativo').toLowerCase() === 'bloqueado' ? 'Bloqueado' : 'Ativo'
      }));
    } else if (type === 'vehicle') {
      table = 'vehicles';
      processedData = data.map(d => ({
        plate: d.plate,
        model: d.model,
        type: d.type,
        status: d.status,
        last_maintenance: toIsoDateTime(d.lastMaintenance),
        cost_center: d.costCenter
      }));
    }

    const { data: insertedData, error } = await api.from(table).insert(processedData);

    if (!error) {
      if (type === 'item' && insertedData) {
        await loadInventoryForWarehouse(activeWarehouse, INITIAL_INVENTORY_LIMIT);
        if (activeModule === 'cadastro') {
          setMasterDataItemsPage(1);
          await fetchMasterDataItemsPage(1);
        }
      } else if (type === 'vendor') {
        const normalizedInserted = Array.isArray(insertedData) ? mapVendorRows(insertedData) : [];
        if (normalizedInserted.length > 0) {
          setVendors(prev => [...normalizedInserted, ...prev.filter((vendor) => !normalizedInserted.some((added) => added.id === vendor.id))]);
        }
        if (activeModule === 'cadastro') {
          setVendorsPage(1);
          await fetchVendorsPage(1);
        }
      } else if (type === 'vehicle') {
        setVehicles(prev => [...prev, ...data]);
      }
      showNotification(`${data.length} registros importados`, 'success');
      addActivity('alerta', 'Importação XLSX', `${data.length} registros de ${type} adicionados`);
    } else {
      showNotification('Erro na importação', 'error');
    }
  };

  const handleSyncFleetAPI = async (token: string) => {
    try {
      showNotification('Iniciando sincronização via Bridge (AWS API)...', 'info');
      let allVeiculos: any[] = [];
      let nextUrl = 'https://cubogpm-frota.nortesistech.com/api/veiculos/?format=json';

      const edgeFunctionUrl = `${api.getBaseUrl()}/fleet-sync`;
      const authToken = api.getAuthToken();

      while (nextUrl) {
        console.log(`Chamando Bridge para: ${nextUrl}`);

        const response = await fetch(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
          },
          body: JSON.stringify({ token, url: nextUrl })
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: 'Erro desconhecido no Bridge' }));
          throw new Error(err.error || `Erro no Proxy (${response.status})`);
        }

        const data = await response.json();
        allVeiculos = [...allVeiculos, ...data.results];
        nextUrl = data.next;

        if (allVeiculos.length % 500 === 0) {
          console.log(`Carregados ${allVeiculos.length} veículos...`);
        }
      }

      console.log(`Total de veículos recuperados: ${allVeiculos.length}`);

      const processedData = allVeiculos.map(v => ({
        plate: v.cod_placa,
        model: v.modelo_veiculo,
        type: v.des_tip_veic,
        status: v.id_ativo === 1 ? 'Disponível' : 'Manutenção',
        last_maintenance: toIsoDateTime(v.dta_ult_manut),
        cost_center: v.centro_custo
      }));

      // Upsert to API
      const { error } = await api.from('vehicles').insert(processedData); // No upsert yet, using insert

      if (error) throw error;

      // Update local state
      setVehicles(processedData.map(v => ({
        plate: v.plate,
        model: v.model,
        type: v.type,
        status: v.status as any,
        lastMaintenance: toPtBrDateTime(v.last_maintenance),
        costCenter: v.cost_center
      })));

      showNotification(`${processedData.length} veículos sincronizados com sucesso via Bridge!`, 'success');
      addActivity('alerta', 'Sincronização API', `${processedData.length} veículos atualizados via Fleet API`);
    } catch (error: any) {
      console.error('Erro na sincronização:', error);
      showNotification(`Falha na sincronização: ${error.message}`, 'error');
    }
  };

  const handleRemoveMasterRecord = async (type: 'item' | 'vendor' | 'vehicle', id: string) => {
    let table = '';
    let matchKey = '';
    if (type === 'item') { table = 'inventory'; matchKey = 'sku'; }
    else if (type === 'vendor') { table = 'vendors'; matchKey = 'id'; }
    else if (type === 'vehicle') { table = 'vehicles'; matchKey = 'plate'; }

    const { error } = await api.from(table).eq(matchKey, id).delete();
    if (!error) {
      if (type === 'item') {
        const targetPage = pagedMasterDataItems.length === 1 && masterDataItemsPage > 1
          ? masterDataItemsPage - 1
          : masterDataItemsPage;
        await loadInventoryForWarehouse(activeWarehouse, INITIAL_INVENTORY_LIMIT);
        if (activeModule === 'cadastro') {
          setMasterDataItemsPage(targetPage);
          await fetchMasterDataItemsPage(targetPage);
        }
      }
      if (type === 'vendor') {
        setVendors(prev => prev.filter(x => x.id !== id));
        const targetPage = pagedVendors.length === 1 && vendorsPage > 1
          ? vendorsPage - 1
          : vendorsPage;
        if (activeModule === 'cadastro') {
          setVendorsPage(targetPage);
          await fetchVendorsPage(targetPage);
        }
      }
      if (type === 'vehicle') setVehicles(prev => prev.filter(x => x.plate !== id));
      showNotification('Registro removido', 'success');
    }
  };

  /* Create Auto PO */
  const handleCreateAutoPO = async (item: InventoryItem) => {
    const alreadyRequested = purchaseOrders.some(po =>
      (po.status === 'requisicao' || po.status === 'cotacao' || po.status === 'pendente') &&
      po.items.some(i => i.sku === item.sku)
    );

    if (alreadyRequested) {
      showNotification(`Já existe uma requisição em andamento para ${item.name}`, 'warning');
      return;
    }

    const neededQty = Math.max(0, item.maxQty - item.quantity);
    if (neededQty <= 0) {
      showNotification(`Estoque de ${item.name} já está suprido.`, 'info');
      return;
    }

    const createdAtIso = nowIso();
    const initialHistory = [
      createPOStatusHistoryEntry('requisicao', 'Pedido automático gerado por regra de estoque crítico')
    ];

    const autoPO: PurchaseOrder = {
      id: `AUTO-${Date.now()}`,
      vendor: 'A definir via cotações',
      requestDate: toPtBrDateTime(createdAtIso, formatDateTimePtBR(new Date(), '')),
      status: 'requisicao',
      priority: 'urgente',
      total: 0,
      requester: 'Norte Tech AI (Estoque Crítico)',
      items: [{
        sku: item.sku,
        name: item.name,
        qty: neededQty,
        price: 0
      }],
      approvalHistory: initialHistory,
      warehouseId: activeWarehouse // NOVO
    };

    const { error } = await api.from('purchase_orders').insert({
      id: autoPO.id,
      vendor: autoPO.vendor,
      status: autoPO.status,
      priority: autoPO.priority,
      total: autoPO.total,
      requester: autoPO.requester,
      items: autoPO.items,
      request_date: createdAtIso,
      approval_history: initialHistory,
      warehouse_id: activeWarehouse
    });

    if (!error) {
      setPurchaseOrders(prev => [autoPO, ...prev]);
      setPagedPurchaseOrders(prev => [autoPO, ...prev].slice(0, PURCHASE_ORDERS_PAGE_SIZE));
      addActivity('compra', 'Requisição Manual de Estoque', `Gerado PO ${autoPO.id} para item crítico`);
      showNotification(`Requisição criada com sucesso! Adicione as cotações.`, 'success');
    } else {
      showNotification('Erro ao criar requisição', 'error');
    }
  };



  const getPageTitle = (module: Module) => {
    switch (module) {
      case 'dashboard': return 'Dashboard Operacional';
      case 'recebimento': return 'Recebimento de Cargas';
      case 'movimentacoes': return 'Auditoria de Movimentações';
      case 'auditoria_geral': return 'Auditoria Geral';
      case 'estoque': return 'Gestão de Inventário';
      case 'expedicao': return 'Solicitações SA';
      case 'cadastro': return 'Cadastro de Mestres';
      case 'compras': return 'Pedidos de Compra';
      default: return 'Norte Tech WMS';
    }
  };

  const handleLogin = (loggedInUser: User, token?: string, registerActivity = true) => {
    const normalizedUser = normalizeUserSession(loggedInUser);
    localStorage.setItem('logged_user', JSON.stringify(normalizedUser));
    if (token) {
      api.setAuthToken(token);
    }

    setUser(normalizedUser);

    // Configurar armazéns permitidos baseados na role e permissões
    let allowed: string[] = [];
    if (normalizedUser.role === 'admin') {
      allowed = warehouses.length > 0 ? warehouses.map(w => w.id) : ['ARMZ28', 'ARMZ33'];
    } else {
      allowed = normalizedUser.allowedWarehouses || [];
    }

    setUserWarehouses(allowed);

    if (registerActivity) {
      addActivity('alerta', 'Login Realizado', `Usuário ${normalizedUser.name} acessou o sistema`);
    }

    // Mostrar ModuleSelector após login (em vez de carregar dados direto)
    setCurrentSystemModule(null);
  };

  // Update logout to also reset system module
  const logout = () => {
    api.clearAuthToken();
    localStorage.removeItem('logged_user');
    pageFetchSequence.current.movements += 1;
    pageFetchSequence.current.purchaseOrders += 1;
    pageFetchSequence.current.materialRequests += 1;
    pageFetchSequence.current.masterDataItems += 1;
    setPurchaseOrders([]);
    setMovements([]);
    setMaterialRequests([]);
    setIsPurchaseOrdersFullyLoaded(false);
    setIsMovementsFullyLoaded(false);
    setIsMaterialRequestsFullyLoaded(false);
    setIsDeferredModuleLoading(false);
    setPagedPurchaseOrders([]);
    setPagedMovements([]);
    setPagedMaterialRequests([]);
    setPagedMasterDataItems([]);
    setPagedVendors([]);
    setHasMorePurchaseOrders(false);
    setHasMoreMovements(false);
    setHasMoreMaterialRequests(false);
    setHasMoreMasterDataItems(false);
    setHasMoreVendors(false);
    setIsPurchaseOrdersPageLoading(false);
    setIsMovementsPageLoading(false);
    setIsMaterialRequestsPageLoading(false);
    setIsMasterDataItemsPageLoading(false);
    setIsVendorsPageLoading(false);
    setPurchaseOrdersPage(1);
    setMovementsPage(1);
    setMaterialRequestsPage(1);
    setMasterDataItemsPage(1);
    setVendorsPage(1);
    setMasterDataItemsTotal(0);
    setVendorsTotal(0);
    fullLoadInFlight.current.clear();
    setUser(null);
    setCurrentSystemModule(null);
    setWorkOrders([]);
    setMechanics([]);
  };

  const handleUpdateInventoryQuantity = async (
    sku: string,
    qty: number,
    reason = 'Saída para Expedição',
    orderId?: string,
    warehouseId?: string
  ) => {
    const targetWarehouseId = warehouseId || activeWarehouse;
    const item = inventory.find(i => i.sku === sku && i.warehouseId === targetWarehouseId);
    if (!item) {
      showNotification(`Item ${sku} não encontrado no inventário do armazém ${targetWarehouseId}.`, 'error');
      return false;
    }

    const newQuantity = item.quantity - qty;
    if (newQuantity < 0) {
      showNotification(`Estoque insuficiente para ${sku}. Disponível: ${item.quantity}, Solicitado: ${qty}`, 'error');
      return false;
    }

    const { error } = await api
      .from('inventory')
      .eq('sku', sku)
      .eq('warehouse_id', targetWarehouseId)
      .update({ quantity: newQuantity });

    if (!error) {
      setInventory(prev => prev.map(i => (i.sku === sku && i.warehouseId === targetWarehouseId) ? { ...i, quantity: newQuantity } : i));
      await recordMovement('saida', item, qty, reason, orderId, targetWarehouseId);
      showNotification(`Estoque de ${sku} atualizado para ${newQuantity}.`, 'success');
      return true;
    } else {
      showNotification(`Erro ao atualizar estoque de ${sku}: ${error.message}`, 'error');
      return false;
    }
  };

  const handleRequestCreate = async (data: MaterialRequest) => {
    const requestPayload = {
      ...data,
      warehouseId: data.warehouseId || activeWarehouse
    };

    const { error } = await api.from('material_requests').insert({
      id: requestPayload.id,
      sku: requestPayload.sku,
      name: requestPayload.name,
      qty: requestPayload.qty,
      plate: requestPayload.plate,
      dept: requestPayload.dept,
      priority: requestPayload.priority,
      status: requestPayload.status,
      cost_center: requestPayload.costCenter,
      warehouse_id: requestPayload.warehouseId
    });
    if (error) {
      showNotification('Erro ao criar solicitação', 'error');
    } else {
      setMaterialRequests(prev => [requestPayload, ...prev]);
      if (materialRequestsPage === 1 && requestPayload.warehouseId === activeWarehouse) {
        setPagedMaterialRequests(prev => [requestPayload, ...prev].slice(0, MATERIAL_REQUESTS_PAGE_SIZE));
      }

      await recordMovement(
        'ajuste',
        {
          sku: requestPayload.sku,
          name: requestPayload.name,
          location: `SA-${requestPayload.dept || 'OPERACOES'}`,
          batch: '-',
          expiry: '',
          quantity: 0,
          status: 'disponivel',
          imageUrl: '',
          category: 'Solicitações SA',
          unit: 'UN',
          minQty: 0,
          maxQty: 0,
          leadTime: 0,
          safetyStock: 0,
          warehouseId: requestPayload.warehouseId || activeWarehouse
        },
        0,
        `Solicitação SA ${requestPayload.id} criada para placa ${requestPayload.plate}`,
        requestPayload.id
      );

      showNotification('Solicitação criada com sucesso!', 'success');
      addActivity('expedicao', 'Nova Solicitação SA', `Item ${requestPayload.sku} solicitado para veículo ${requestPayload.plate}`);
    }
  };

  const handleRequestUpdate = async (id: string, status: RequestStatus) => {
    const currentRequest = materialRequests.find(request => request.id === id);

    const isApprovalStep =
      currentRequest?.status === 'aprovacao' && status === 'separacao';
    if (isApprovalStep && user?.role !== 'admin') {
      showNotification('Apenas administrador pode aprovar solicitações SA.', 'error');
      return;
    }

    const { error } = await api.from('material_requests').update({ status }).eq('id', id);
    if (error) {
      showNotification('Erro ao atualizar status', 'error');
    } else {
      setMaterialRequests(prev => prev.map(request => request.id === id ? { ...request, status } : request));
      setPagedMaterialRequests(prev => prev.map(request => request.id === id ? { ...request, status } : request));

      if (currentRequest && currentRequest.status !== status) {
        await recordMovement(
          'ajuste',
          {
            sku: currentRequest.sku,
            name: currentRequest.name,
            location: `SA-${currentRequest.dept || 'OPERACOES'}`,
            batch: '-',
            expiry: '',
            quantity: 0,
            status: 'disponivel',
            imageUrl: '',
            category: 'Solicitações SA',
            unit: 'UN',
            minQty: 0,
            maxQty: 0,
            leadTime: 0,
            safetyStock: 0,
            warehouseId: currentRequest.warehouseId || activeWarehouse
          },
          0,
          `Solicitação SA ${id}: ${currentRequest.status} -> ${status}`,
          id
        );
      }
      showNotification('Status da solicitação atualizado!', 'success');
    }
  };

  const handleRequestEdit = async (id: string, data: Partial<MaterialRequest>) => {
    const currentRequest = materialRequests.find((request) => request.id === id);
    const isApprovalTransitionByEdit =
      currentRequest?.status === 'aprovacao' &&
      data.status === 'separacao' &&
      user?.role !== 'admin';

    if (isApprovalTransitionByEdit) {
      showNotification('Apenas administrador pode aprovar solicitações SA.', 'error');
      throw new Error('Aprovação bloqueada para usuário não administrador.');
    }

    const { error } = await api.from('material_requests').update({
      sku: data.sku,
      name: data.name,
      qty: data.qty,
      plate: data.plate,
      dept: data.dept,
      priority: data.priority,
      status: data.status,
      cost_center: data.costCenter
      // NOT sending items as it may not exist in DB schema
    }).eq('id', id);

    if (error) {
      showNotification('Erro ao editar solicitação', 'error');
      throw error;
    } else {
      setMaterialRequests(prev => prev.map(request => request.id === id ? { ...request, ...data } : request));
      setPagedMaterialRequests(prev => prev.map(request => request.id === id ? { ...request, ...data } : request));
      showNotification('Solicitação editada com sucesso!', 'success');
    }
  };

  const handleRequestDelete = async (id: string) => {
    const { error } = await api.from('material_requests').delete().eq('id', id);
    if (error) {
      showNotification('Erro ao remover solicitação', 'error');
      throw error;
    } else {
      setMaterialRequests(prev => prev.filter(request => request.id !== id));
      setPagedMaterialRequests(prev => prev.filter(request => request.id !== id));
      showNotification('Solicitação removida com sucesso!', 'success');
    }
  };

  // Workshop Handlers
  const handleSelectSystemModule = async (module: SystemModule) => {
    if (module === 'workshop' && user && user.role !== 'admin' && !user.hasWorkshopAccess) {
      showNotification('Acesso à Oficina bloqueado para este usuário.', 'error');
      return;
    }

    setCurrentSystemModule(module);
    setIsLoading(true);
    
    if (module === 'warehouse') {
      // Carregar dados do warehouse
      const bootstrapData = loadBootstrapDataRef.current;
      if (bootstrapData) {
        await bootstrapData(activeWarehouse);
      }
    } else if (module === 'workshop') {
      // Carregar dados da oficina
      await loadWorkshopData();
    }
    
    setIsLoading(false);
  };

  const loadWorkshopData = async () => {
    try {
      // Seed data de veículos para teste
      const seedVehicles: Vehicle[] = [
        { plate: 'BGM-1001', model: 'Volvo FH 540', type: 'Caminhão', status: 'Disponível', lastMaintenance: '15/01/2026', costCenter: 'OPS-CD' },
        { plate: 'CHN-1002', model: 'Mercedes Actros', type: 'Carreta', status: 'Disponível', lastMaintenance: '20/01/2026', costCenter: 'MAN-OFI' },
        { plate: 'DIO-1003', model: 'Volvo FH 460', type: 'Utilitário', status: 'Em Viagem', lastMaintenance: '10/01/2026', costCenter: 'OPS-CD' },
        { plate: 'ELQ-1004', model: 'Scania R450', type: 'Caminhão', status: 'Manutenção', lastMaintenance: '25/01/2026', costCenter: 'OPS-CD' },
        { plate: 'FKQ-1005', model: 'Mercedes Atego', type: 'Utilitário', status: 'Disponível', lastMaintenance: '18/01/2026', costCenter: 'MAN-OFI' },
        { plate: 'GLB-1006', model: 'Volvo FM 370', type: 'Caminhão', status: 'Disponível', lastMaintenance: '22/01/2026', costCenter: 'OPS-CD' },
        { plate: 'HMT-1007', model: 'Iveco Stralis', type: 'Carreta', status: 'Em Viagem', lastMaintenance: '12/01/2026', costCenter: 'MAN-OFI' },
        { plate: 'INY-1008', model: 'Scania G410', type: 'Caminhão', status: 'Disponível', lastMaintenance: '28/01/2026', costCenter: 'OPS-CD' }
      ];

      // Seed data de mecânicos para teste
      const seedMechanics: Mechanic[] = [
        { 
          id: 'MEC-001', 
          name: 'João Silva', 
          specialty: 'Motor e Transmissão', 
          shift: 'manha', 
          status: 'disponivel',
          currentWorkOrders: [],
          productivity: { ordersCompleted: 45, avgHoursPerOrder: 4.2, onTimeRate: 92 }
        },
        { 
          id: 'MEC-002', 
          name: 'Pedro Santos', 
          specialty: 'Elétrica e Eletrônica', 
          shift: 'tarde', 
          status: 'ocupado',
          currentWorkOrders: ['OS-001'],
          productivity: { ordersCompleted: 38, avgHoursPerOrder: 5.1, onTimeRate: 88 }
        },
        { 
          id: 'MEC-003', 
          name: 'Carlos Oliveira', 
          specialty: 'Suspensão e Freios', 
          shift: 'noite', 
          status: 'disponivel',
          currentWorkOrders: [],
          productivity: { ordersCompleted: 52, avgHoursPerOrder: 3.8, onTimeRate: 95 }
        },
        { 
          id: 'MEC-004', 
          name: 'Antônio Ferreira', 
          specialty: 'Pneus e Rodas', 
          shift: 'manha', 
          status: 'ocupado',
          currentWorkOrders: ['OS-002'],
          productivity: { ordersCompleted: 41, avgHoursPerOrder: 2.5, onTimeRate: 96 }
        }
      ];

      // Seed data de ordens de serviço para teste
      const seedWorkOrders: WorkOrder[] = [
        {
          id: 'OS-001',
          vehiclePlate: 'ELQ-1004',
          vehicleModel: 'Scania R450',
          status: 'em_execucao',
          type: 'corretiva',
          priority: 'alta',
          mechanicId: 'MEC-002',
          mechanicName: 'Pedro Santos',
          description: 'Troca de óleo do motor e revisão de freios',
          services: [
            { id: 'S1', description: 'Troca de óleo motor', category: 'motor', estimatedHours: 1, completed: true },
            { id: 'S2', description: 'Revisão sistema de freios', category: 'freios', estimatedHours: 2, completed: false }
          ],
          parts: [
            { id: 'P1', sku: 'OLEO-15W40', name: 'Óleo Motor 15W40', qtyRequested: 20, qtyUsed: 18, status: 'entregue', unitCost: 25.50 },
            { id: 'P2', sku: 'FILT-001', name: 'Filtro de Óleo', qtyRequested: 2, qtyUsed: 2, status: 'entregue', unitCost: 45.00 }
          ],
          openedAt: '2026-02-08T08:00:00Z',
          estimatedHours: 3,
          actualHours: 2.5,
          costCenter: 'MAN-OFI',
          cost: { labor: 150, parts: 600, thirdParty: 0, total: 750 },
          createdBy: 'Sistema',
          warehouseId: 'ARMZ28'
        },
        {
          id: 'OS-002',
          vehiclePlate: 'HMT-1007',
          vehicleModel: 'Iveco Stralis',
          status: 'aguardando_pecas',
          type: 'preventiva',
          priority: 'normal',
          mechanicId: 'MEC-004',
          mechanicName: 'Antônio Ferreira',
          description: 'Revisão preventiva de 50.000 km',
          services: [
            { id: 'S3', description: 'Troca de pneus dianteiros', category: 'pneus', estimatedHours: 1.5, completed: false },
            { id: 'S4', description: 'Alinhamento e balanceamento', category: 'suspensao', estimatedHours: 2, completed: false }
          ],
          parts: [
            { id: 'P3', sku: 'PNEU-295', name: 'Pneu 295/80 R22.5', qtyRequested: 4, status: 'pendente', unitCost: 850.00 }
          ],
          openedAt: '2026-02-07T10:30:00Z',
          estimatedHours: 3.5,
          costCenter: 'MAN-OFI',
          cost: { labor: 200, parts: 3400, thirdParty: 150, total: 3750 },
          createdBy: 'Sistema',
          warehouseId: 'ARMZ28'
        },
        {
          id: 'OS-003',
          vehiclePlate: 'DIO-1003',
          vehicleModel: 'Volvo FH 460',
          status: 'aguardando',
          type: 'corretiva',
          priority: 'urgente',
          description: 'Problema no sistema de ar condicionado',
          services: [
            { id: 'S5', description: 'Diagnóstico e reparo do ar condicionado', category: 'eletrica', estimatedHours: 3, completed: false }
          ],
          parts: [],
          openedAt: '2026-02-08T14:00:00Z',
          estimatedHours: 3,
          costCenter: 'OPS-CD',
          cost: { labor: 180, parts: 0, thirdParty: 0, total: 180 },
          createdBy: 'Sistema',
          warehouseId: 'ARMZ28'
        }
      ];

      // Seed data de detalhes de veículos
      const seedVehicleDetails: VehicleDetail[] = seedVehicles.map(v => ({
        ...v,
        chassis: `CHASSIS-${v.plate.replace(/-/g, '')}`,
        year: 2020 + Math.floor(Math.random() * 5),
        mileage: 50000 + Math.floor(Math.random() * 200000),
        engineHours: 2000 + Math.floor(Math.random() * 5000),
        costCenter: v.costCenter || 'OPS-CD',
        documents: [
          { type: 'licenciamento', status: 'ativo', expiryDate: '2026-12-31', notes: 'Licenciamento em dia' },
          { type: 'seguro', status: 'ativo', expiryDate: '2026-06-30', notes: 'Seguro vigente' }
        ],
        components: [
          { id: 'C1', name: 'Óleo Motor', category: 'oleo_motor', health: 85, status: 'bom', lastService: '2026-01-15', nextServiceKm: 55000, currentValue: '85%', unit: '%' },
          { id: 'C2', name: 'Pneus Dianteiros', category: 'pneus', health: 60, status: 'atencao', lastService: '2025-11-20', nextServiceKm: 60000, currentValue: '6.5mm', unit: 'mm' },
          { id: 'C3', name: 'Bateria', category: 'bateria', health: 90, status: 'bom', lastService: '2025-08-10', nextServiceDate: '2027-08-10', currentValue: '12.8V', unit: 'V' },
          { id: 'C4', name: 'Freios', category: 'freios', health: 70, status: 'bom', lastService: '2025-12-05', nextServiceKm: 58000, currentValue: '70%', unit: '%' }
        ],
        events: [
          { id: 'E1', type: 'manutencao', title: 'Revisão 50.000km', description: 'Troca de filtros e óleo', date: '2026-01-15', mechanic: 'João Silva', status: 'concluido', cost: 450 },
          { id: 'E2', type: 'checklist', title: 'Checklist Diário', description: 'Verificação de fluidos e pneus', date: '2026-02-08', status: 'aprovado' }
        ],
        statusOperacional: v.status === 'Manutenção' ? 'manutencao' : v.status === 'Em Viagem' ? 'em_viagem' : 'operacional'
      }));

      // Carregar mecânicos do banco ou usar seed
      const { data: mechanicsData } = await api.from('mechanics').select('*');
      if (mechanicsData && mechanicsData.length > 0) {
        setMechanics(mechanicsData.map((m: any) => ({
          id: m.id,
          name: m.name,
          specialty: m.specialty,
          shift: m.shift,
          status: m.status,
          currentWorkOrders: m.current_work_orders || [],
          productivity: {
            ordersCompleted: m.orders_completed || 0,
            avgHoursPerOrder: m.avg_hours_per_order || 0,
            onTimeRate: m.on_time_rate || 100
          }
        })));
      } else {
        setMechanics(seedMechanics);
      }

      // Carregar ordens de serviço do banco ou usar seed
      const { data: workOrdersData } = await api.from('work_orders').select('*').order('opened_at', { ascending: false });
      if (workOrdersData && workOrdersData.length > 0) {
        setWorkOrders(workOrdersData.map((wo: any) => ({
          id: wo.id,
          vehiclePlate: wo.vehicle_plate,
          vehicleModel: wo.vehicle_model,
          status: wo.status,
          type: wo.type,
          priority: wo.priority,
          mechanicId: wo.mechanic_id,
          mechanicName: wo.mechanic_name,
          description: wo.description,
          services: wo.services || [],
          parts: wo.parts || [],
          openedAt: wo.opened_at,
          closedAt: wo.closed_at,
          estimatedHours: wo.estimated_hours,
          actualHours: wo.actual_hours,
          costCenter: wo.cost_center,
          cost: {
            labor: wo.cost_labor || 0,
            parts: wo.cost_parts || 0,
            thirdParty: wo.cost_third_party || 0,
            total: wo.cost_total || 0
          },
          createdBy: wo.created_by,
          warehouseId: wo.warehouse_id
        })));
      } else {
        setWorkOrders(seedWorkOrders);
      }

      // Carregar veículos do banco ou usar seed
      const { data: vehData } = await api.from('vehicles').select('*');
      if (vehData && vehData.length > 0) {
        setVehicles(vehData.map((row: any) => mapVehicleRowToState(row)));
      } else {
        setVehicles(seedVehicles);
      }

      // Definir detalhes dos veículos
      setVehicleDetails(seedVehicleDetails);

    } catch (error) {
      console.error('Erro ao carregar dados da oficina:', error);
      showNotification('Erro ao carregar dados da oficina', 'error');
    }
  };

  const handleUpdateWorkOrderStatus = async (orderId: string, newStatus: WorkOrderStatus) => {
    const { error } = await api.from('work_orders').eq('id', orderId).update({ 
      status: newStatus,
      closed_at: newStatus === 'finalizada' ? new Date().toISOString() : null
    });
    
    if (!error) {
      setWorkOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      showNotification(`Status da OS ${orderId} atualizado`, 'success');
    } else {
      showNotification('Erro ao atualizar status', 'error');
    }
  };

  const handleAssignMechanic = async (orderId: string, mechanicId: string) => {
    const mechanic = mechanics.find(m => m.id === mechanicId);
    const { error } = await api.from('work_orders').eq('id', orderId).update({ 
      mechanic_id: mechanicId,
      mechanic_name: mechanic?.name
    });
    
    if (!error) {
      setWorkOrders(prev => prev.map(o => o.id === orderId ? { 
        ...o, 
        mechanicId, 
        mechanicName: mechanic?.name 
      } : o));
      showNotification(`Mecânico atribuído à OS ${orderId}`, 'success');
    } else {
      showNotification('Erro ao atribuir mecânico', 'error');
    }
  };

  const handleCreateWorkOrder = async (workOrder: Omit<WorkOrder, 'id' | 'openedAt' | 'createdBy'>) => {
    const id = `OS-${Date.now()}`;
    const openedAt = new Date().toISOString();
    
    const { error } = await api.from('work_orders').insert({
      id,
      vehicle_plate: workOrder.vehiclePlate,
      vehicle_model: workOrder.vehicleModel,
      status: workOrder.status,
      type: workOrder.type,
      priority: workOrder.priority,
      mechanic_id: workOrder.mechanicId,
      mechanic_name: workOrder.mechanicName,
      description: workOrder.description,
      services: workOrder.services,
      parts: workOrder.parts,
      opened_at: openedAt,
      estimated_hours: workOrder.estimatedHours,
      cost_center: workOrder.costCenter,
      cost_labor: workOrder.cost.labor,
      cost_parts: workOrder.cost.parts,
      cost_third_party: workOrder.cost.thirdParty,
      cost_total: workOrder.cost.total,
      created_by: user?.name || 'Sistema',
      warehouse_id: activeWarehouse
    });

    if (!error) {
      const newOrder: WorkOrder = {
        ...workOrder,
        id,
        openedAt,
        createdBy: user?.name || 'Sistema'
      };
      setWorkOrders(prev => [newOrder, ...prev]);
      showNotification(`OS ${id} criada com sucesso!`, 'success');
      return id;
    } else {
      showNotification('Erro ao criar OS', 'error');
      return null;
    }
  };

  const handleUpdateMechanic = async (updatedMechanic: Mechanic) => {
    const { error } = await api.from('mechanics').eq('id', updatedMechanic.id).update({
      name: updatedMechanic.name,
      specialty: updatedMechanic.specialty,
      shift: updatedMechanic.shift,
      status: updatedMechanic.status
    });

    if (!error) {
      setMechanics(prev => prev.map(m => m.id === updatedMechanic.id ? updatedMechanic : m));
      showNotification('Mecânico atualizado com sucesso!', 'success');
    } else {
      showNotification('Erro ao atualizar mecânico', 'error');
    }
  };

  const handleCreateMechanic = async (mechanicData: Omit<Mechanic, 'id' | 'productivity' | 'currentWorkOrders'>) => {
    const id = `MEC-${Date.now()}`;
    
    const { error } = await api.from('mechanics').insert({
      id,
      name: mechanicData.name,
      specialty: mechanicData.specialty,
      shift: mechanicData.shift,
      status: mechanicData.status,
      current_work_orders: [],
      orders_completed: 0,
      avg_hours_per_order: 0,
      on_time_rate: 100
    });

    if (!error) {
      const newMechanic: Mechanic = {
        ...mechanicData,
        id,
        currentWorkOrders: [],
        productivity: {
          ordersCompleted: 0,
          avgHoursPerOrder: 0,
          onTimeRate: 100
        }
      };
      setMechanics(prev => [...prev, newMechanic]);
      showNotification('Mecânico cadastrado com sucesso!', 'success');
    } else {
      showNotification('Erro ao cadastrar mecânico', 'error');
    }
  };

  // Early returns after all handlers
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="font-black uppercase tracking-widest text-sm animate-pulse">Carregando Sistema...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // Show Module Selector after login if no system module selected
  if (currentSystemModule === null) {
    return <ModuleSelector user={user} onSelectModule={handleSelectSystemModule} onLogout={logout} />;
  }


  return (
    <div className={`flex w-screen h-screen overflow-hidden ${isDarkMode ? 'dark' : ''}`}>
      {currentSystemModule === 'warehouse' && (
        <>
          <Sidebar
            activeModule={activeModule}
            onModuleChange={(module) => {
              setActiveModule(module);
              setIsMobileMenuOpen(false);
            }}
            user={user}
            isCollapsed={isSidebarCollapsed}
            onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            isMobileOpen={isMobileMenuOpen}
            onMobileClose={() => setIsMobileMenuOpen(false)}
          />
          <div className="flex-1 flex flex-col min-w-0 h-full">
            <TopBar
              isDarkMode={isDarkMode}
              toggleDarkMode={toggleDarkMode}
              title={getPageTitle(activeModule)}
              user={user}
              onLogout={logout}
              notifications={appNotifications}
              onMarkAsRead={markNotificationAsRead}
              onMarkAllAsRead={markAllNotificationsAsRead}
              onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              showBackButton={true}
              onBackToModules={() => setCurrentSystemModule(null)}
            />
            <main className="flex-1 overflow-y-auto bg-background-light dark:bg-background-dark p-4 lg:p-6 relative">
              {notification && (
                <div className={`fixed top-20 right-8 z-50 animate-in slide-in-from-right px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 border ${notification.type === 'success' ? 'bg-emerald-500 text-white border-emerald-400' :
                  notification.type === 'error' ? 'bg-red-500 text-white border-red-400' :
                    notification.type === 'info' ? 'bg-blue-500 text-white border-blue-400' :
                      'bg-amber-500 text-white border-amber-400'
                  }`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>
                  <span className="font-bold text-sm">{notification.message}</span>
                </div>
              )}

              {isDeferredModuleLoading && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-wider shadow-xl">
                  Carregando dados completos do módulo...
                </div>
              )}

              {/* Warehouse Selector Integration */}
              <WarehouseSelector
                warehouses={warehouses}
                activeWarehouse={activeWarehouse}
                userWarehouses={userWarehouses}
                onWarehouseChange={(id) => {
                  if (userWarehouses.includes(id) || user?.role === 'admin') {
                    setActiveWarehouse(id);
                  } else {
                    showNotification('Você não tem permissão para acessar este armazém', 'error');
                  }
                }}
              />

              <Suspense
                fallback={
                  <div className="w-full flex items-center justify-center py-20">
                    <div className="flex items-center gap-3 text-slate-500">
                      <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-black uppercase tracking-wider">Carregando módulo...</span>
                    </div>
                  </div>
                }
              >
                {activeModule === 'dashboard' && (
                  <Dashboard
                    inventory={inventory.filter(i => i.warehouseId === activeWarehouse)}
                    activities={activities}
                  />
                )}
                {activeModule === 'recebimento' && (
                  <Receiving
                    onFinalize={handleFinalizeReceipt}
                    availablePOs={purchaseOrders.filter(po => po.warehouseId === activeWarehouse && po.status === 'enviado')}
                  />
                )}
                {activeModule === 'movimentacoes' && (
                  <Movements
                    movements={pagedMovements}
                    currentPage={movementsPage}
                    pageSize={MOVEMENTS_PAGE_SIZE}
                    hasNextPage={hasMoreMovements}
                    isPageLoading={isMovementsPageLoading}
                    onPageChange={setMovementsPage}
                  />
                )}
                {activeModule === 'auditoria_geral' && (
                  <GeneralAudit activeWarehouse={activeWarehouse} />
                )}
                {activeModule === 'estoque' && (
                  <Inventory
                    items={inventory.filter(i => i.warehouseId === activeWarehouse)}
                    onUpdateItem={handleUpdateInventoryItem}
                    onCreateAutoPO={handleCreateAutoPO}
                    onRecalculateROP={handleRecalculateROP}
                  />
                )}
                {activeModule === 'expedicao' && (
                  <Expedition
                    inventory={inventory.filter(i => i.warehouseId === activeWarehouse)}
                    vehicles={vehicles}
                    requests={pagedMaterialRequests}
                    canApproveRequests={user?.role === 'admin'}
                    onProcessPicking={handleUpdateInventoryQuantity}
                    onRequestCreate={handleRequestCreate}
                    onRequestUpdate={handleRequestUpdate}
                    onRequestEdit={handleRequestEdit}
                    onRequestDelete={handleRequestDelete}
                    activeWarehouse={activeWarehouse}
                    currentPage={materialRequestsPage}
                    pageSize={MATERIAL_REQUESTS_PAGE_SIZE}
                    hasNextPage={hasMoreMaterialRequests}
                    isPageLoading={isMaterialRequestsPageLoading}
                    onPageChange={setMaterialRequestsPage}
                  />
                )}
                {activeModule === 'inventario_ciclico' && (
                  <CyclicInventory
                    activeWarehouse={activeWarehouse}
                    inventory={inventory.filter(i => i.warehouseId === activeWarehouse)}
                    batches={cyclicBatches.filter(b => b.warehouseId === activeWarehouse)}
                    onCreateBatch={handleCreateCyclicBatch}
                    onFinalizeBatch={handleFinalizeCyclicBatch}
                    onClassifyABC={handleClassifyABC}
                  />
                )}

                {activeModule === 'compras' && (
                  <PurchaseOrders
                    user={user}
                    activeWarehouse={activeWarehouse}
                    orders={pagedPurchaseOrders}
                    vendors={vendors}
                    inventory={inventory.filter(i => i.warehouseId === activeWarehouse)}
                    vehicles={vehicles}
                    onCreateOrder={handleCreatePO}
                    onAddQuotes={handleAddQuotes}
                    onSendToApproval={handleSendToApproval}
                    onMarkAsSent={handleMarkAsSent}
                    onApprove={handleApprovePO}
                    onReject={handleRejectPO}
                    onDeleteOrder={handleDeletePO}
                    currentPage={purchaseOrdersPage}
                    pageSize={PURCHASE_ORDERS_PAGE_SIZE}
                    hasNextPage={hasMorePurchaseOrders}
                    isPageLoading={isPurchaseOrdersPageLoading}
                    onPageChange={setPurchaseOrdersPage}
                  />
                )}
                {activeModule === 'cadastro' && (
                  <MasterData
                    inventory={pagedMasterDataItems}
                    vendors={pagedVendors}
                    onAddRecord={handleAddMasterRecord}
                    onRemoveRecord={handleRemoveMasterRecord}
                    onImportRecords={handleImportMasterRecords}
                    inventoryPagination={{
                      currentPage: masterDataItemsPage,
                      pageSize: MASTER_DATA_ITEMS_PAGE_SIZE,
                      totalItems: masterDataItemsTotal,
                      hasNextPage: hasMoreMasterDataItems,
                      isLoading: isMasterDataItemsPageLoading,
                      onPageChange: setMasterDataItemsPage,
                    }}
                    vendorsPagination={{
                      currentPage: vendorsPage,
                      pageSize: VENDORS_PAGE_SIZE,
                      totalItems: vendorsTotal,
                      hasNextPage: hasMoreVendors,
                      isLoading: isVendorsPageLoading,
                      onPageChange: setVendorsPage,
                    }}
                  />
                )}
                {activeModule === 'relatorios' && (
                  <Reports
                    orders={purchaseOrders.filter(po => po.warehouseId === activeWarehouse)}
                  />
                )}
                {activeModule === 'configuracoes' && (
                  <Settings
                    users={users}
                    warehouses={warehouses}
                    onAddUser={handleAddUser}
                    onUpdateUser={handleUpdateUser}
                    onDeleteUser={handleDeleteUser}
                  />
                )}
              </Suspense>
            </main>
          </div>
        </>
      )}

      {currentSystemModule === 'workshop' && (
        <div className="flex-1 flex flex-col min-w-0 h-full bg-background-light dark:bg-background-dark">
          {/* Workshop Top Bar */}
          <div className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setCurrentSystemModule(null)}
                className="flex items-center gap-2 px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="text-sm font-medium">Voltar</span>
              </button>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Oficina</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-500 dark:text-slate-400">{user?.name}</span>
              <button
                onClick={logout}
                className="p-2 text-slate-500 hover:text-red-500 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>

          {/* Workshop Navigation */}
          <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 lg:px-6 py-3">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setWorkshopActiveModule('dashboard')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  workshopActiveModule === 'dashboard'
                    ? 'bg-blue-500 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setWorkshopActiveModule('orders')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  workshopActiveModule === 'orders'
                    ? 'bg-blue-500 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                Ordens de Serviço
              </button>
              <button
                onClick={() => setWorkshopActiveModule('mechanics')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  workshopActiveModule === 'mechanics'
                    ? 'bg-blue-500 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                Mecânicos
              </button>
              <button
                onClick={() => setWorkshopActiveModule('preventive')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  workshopActiveModule === 'preventive'
                    ? 'bg-blue-500 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                Preventiva
              </button>
              <button
                onClick={() => setWorkshopActiveModule('plans')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  workshopActiveModule === 'plans'
                    ? 'bg-blue-500 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                Planos de Manutenção
              </button>
              <button
                onClick={() => setWorkshopActiveModule('checklists')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  workshopActiveModule === 'checklists'
                    ? 'bg-blue-500 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                Checklists
              </button>
              <button
                onClick={() => setWorkshopActiveModule('frota')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  workshopActiveModule === 'frota'
                    ? 'bg-blue-500 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                Frota
              </button>
            </div>
          </div>

          {/* Workshop Content */}
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            <Suspense
              fallback={
                <div className="w-full flex items-center justify-center py-20">
                  <div className="flex items-center gap-3 text-slate-500">
                    <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-black uppercase tracking-wider">Carregando...</span>
                  </div>
                </div>
              }
            >
              {workshopActiveModule === 'dashboard' && (
                <WorkshopDashboard
                  kpis={workshopKPIs}
                  workOrders={workOrders}
                  mechanics={mechanics}
                  onNavigateToOrders={() => setWorkshopActiveModule('orders')}
                  onNavigateToMechanics={() => setWorkshopActiveModule('mechanics')}
                  onNavigateToMaintenance={() => setWorkshopActiveModule('preventive')}
                />
              )}
              {workshopActiveModule === 'orders' && (
                <WorkOrderKanban
                  workOrders={workOrders}
                  mechanics={mechanics}
                  onUpdateStatus={handleUpdateWorkOrderStatus}
                  onAssignMechanic={handleAssignMechanic}
                  onCreateOrder={() => {}}
                  onViewOrder={(order) => {}}
                />
              )}
              {workshopActiveModule === 'mechanics' && (
                <MechanicsManagement
                  mechanics={mechanics}
                  onUpdateMechanic={handleUpdateMechanic}
                  onCreateMechanic={handleCreateMechanic}
                />
              )}
              {workshopActiveModule === 'preventive' && (
                <PreventiveDashboard
                  kpis={preventiveKPIs}
                  activePlans={activePlans}
                  alerts={maintenanceAlerts}
                  onViewVehicle={handleViewVehicle}
                  onCreatePlan={() => setWorkshopActiveModule('plans')}
                  onViewAllVehicles={() => setWorkshopActiveModule('vehicles')}
                  onResolveAlert={(id) => setMaintenanceAlerts(prev => prev.filter(a => a.id !== id))}
                />
              )}
              {workshopActiveModule === 'vehicles' && selectedVehicle && (
                <VehicleDetailView
                  vehicle={selectedVehicle}
                  onBack={() => setWorkshopActiveModule('preventive')}
                  onCreateMaintenance={() => setWorkshopActiveModule('plans')}
                  onViewEvent={(event) => {}}
                />
              )}
              {workshopActiveModule === 'plans' && (
                <MaintenancePlanWizard
                  onSave={handleCreateMaintenancePlan}
                  onCancel={() => setWorkshopActiveModule('preventive')}
                  availableVehicles={vehicles.map(v => ({ model: v.model, type: v.type }))}
                />
              )}
              {workshopActiveModule === 'schedules' && selectedSchedule && (
                <ScheduleDetail
                  schedule={selectedSchedule}
                  onBack={() => setWorkshopActiveModule('preventive')}
                  onExportPDF={() => showNotification('PDF exportado!', 'success')}
                  onScheduleAppointment={() => showNotification('Agendamento solicitado!', 'success')}
                  onViewCalendar={() => {}}
                />
              )}
              {workshopActiveModule === 'checklists' && (
                <InspectionChecklistEditor
                  onSave={handleSaveInspectionTemplate}
                  onCancel={() => setWorkshopActiveModule('dashboard')}
                  availableModels={vehicles.map(v => v.model)}
                />
              )}
              {workshopActiveModule === 'frota' && (
                <VehicleManagement
                  vehicles={vehicles}
                  vehicleDetails={vehicleDetails}
                  inventory={inventory.filter(i => i.warehouseId === activeWarehouse)}
                  onAddVehicle={handleAddVehicle}
                  onUpdateVehicle={handleUpdateVehicle}
                  onDeleteVehicle={handleDeleteVehicle}
                  onSyncFleetAPI={handleSyncFleetAPI}
                  onRequestParts={handleRequestPartsFromWorkshop}
                  onImportVehicles={handleImportVehicles}
                />
              )}
            </Suspense>
          </main>
        </div>
      )}
    </div>
  );
};
