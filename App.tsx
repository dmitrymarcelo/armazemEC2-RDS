
import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { WarehouseSelector } from './components/WarehouseSelector';
import type { MaterialRequest } from './pages/Expedition';
type RequestStatus = 'aprovacao' | 'separacao' | 'entregue';
import { Module, InventoryItem, Activity, Movement, Vendor, Vehicle, PurchaseOrder, Quote, ApprovalRecord, User, AppNotification, CyclicBatch, CyclicCount, Warehouse, PurchaseOrderStatus } from './types';
import { LoginPage } from './components/LoginPage';
import { api, AUTH_TOKEN_KEY } from './api-client';
import { formatDateTimePtBR, formatTimePtBR, parseDateLike } from './utils/dateTime';

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
  const [pagedMovements, setPagedMovements] = useState<Movement[]>([]);
  const [pagedPurchaseOrders, setPagedPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [pagedMaterialRequests, setPagedMaterialRequests] = useState<MaterialRequest[]>([]);
  const [hasMoreMovements, setHasMoreMovements] = useState(false);
  const [hasMorePurchaseOrders, setHasMorePurchaseOrders] = useState(false);
  const [hasMoreMaterialRequests, setHasMoreMaterialRequests] = useState(false);
  const [isMovementsPageLoading, setIsMovementsPageLoading] = useState(false);
  const [isPurchaseOrdersPageLoading, setIsPurchaseOrdersPageLoading] = useState(false);
  const [isMaterialRequestsPageLoading, setIsMaterialRequestsPageLoading] = useState(false);

  const fullLoadInFlight = useRef<Set<string>>(new Set());
  const loadBootstrapDataRef = useRef<((warehouseId?: string) => Promise<void>) | null>(null);
  const pageFetchSequence = useRef({
    movements: 0,
    purchaseOrders: 0,
    materialRequests: 0
  });

  const INITIAL_INVENTORY_LIMIT = 100; // Reduzido de 500 para melhorar desempenho
  const INITIAL_PURCHASE_ORDERS_LIMIT = 100; // Reduzido de 300
  const INITIAL_MOVEMENTS_LIMIT = 100; // Reduzido de 300
  const INITIAL_MATERIAL_REQUESTS_LIMIT = 100; // Reduzido de 300
  const MOVEMENTS_PAGE_SIZE = 50; // Reduzido de 120
  const PURCHASE_ORDERS_PAGE_SIZE = 30; // Reduzido de 60
  const MATERIAL_REQUESTS_PAGE_SIZE = 30; // Reduzido de 60

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

  // API Data Fetching
  useEffect(() => {
    const fetchData = async (warehouseId = activeWarehouse) => {
      try {
        const [
          whResult,
          _inventoryResult,
          batchesResult,
          venResult,
          vehResult,
          userResult,
          poResult,
          movResult,
          notifResult,
          reqResult,
        ] = await Promise.all([
          api.from('warehouses').select('*').eq('is_active', true),
          loadInventoryForWarehouse(warehouseId, INITIAL_INVENTORY_LIMIT),
          api.from('cyclic_batches').select('*').order('created_at', { ascending: false }),
          api.from('vendors').select('*'),
          api.from('vehicles').select('*'),
          api.from('users').select('*'),
          api.from('purchase_orders').select('*').order('request_date', { ascending: false }).limit(INITIAL_PURCHASE_ORDERS_LIMIT),
          api.from('movements').select('*').order('timestamp', { ascending: false }).limit(INITIAL_MOVEMENTS_LIMIT),
          api.from('notifications').select('*').order('created_at', { ascending: false }).limit(20),
          api.from('material_requests').select('*').order('created_at', { ascending: false }).limit(INITIAL_MATERIAL_REQUESTS_LIMIT),
        ]);

        const whData = whResult?.data;
        if (whData) setWarehouses(whData.map((w: any) => ({
          id: w.id,
          name: w.name,
          description: w.description,
          location: w.location,
          isActive: w.is_active,
          managerName: w.manager_name,
          managerEmail: w.manager_email
        })));

        const batchesData = batchesResult?.data;
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

        const venData = venResult?.data;
        if (venData) setVendors(venData);

        const vehData = vehResult?.data;
        if (vehData) setVehicles(vehData.map((v: any) => ({
          plate: v.plate,
          model: v.model,
          type: v.type,
          status: v.status,
          lastMaintenance: v.last_maintenance,
          costCenter: v.cost_center
        })));

        const userData = userResult?.data;
        if (userData) {
          const mappedUsers = userData.map((u: any) => ({
            ...u,
            lastAccess: toPtBrDateTime(u.last_access),
            modules: Array.isArray(u.modules) ? u.modules : (u.modules ? JSON.parse(u.modules) : []),
            allowedWarehouses: Array.isArray(u.allowed_warehouses) ? u.allowed_warehouses : (u.allowed_warehouses ? JSON.parse(u.allowed_warehouses) : ['ARMZ28'])
          }));
          setUsers(mappedUsers);
        }

        const poData = poResult?.data;
        if (poData) {
          setPurchaseOrders(mapPurchaseOrders(poData));
          setIsPurchaseOrdersFullyLoaded(poData.length < INITIAL_PURCHASE_ORDERS_LIMIT);
        }

        const movData = movResult?.data;
        if (movData) {
          setMovements(mapMovements(movData));
          setIsMovementsFullyLoaded(movData.length < INITIAL_MOVEMENTS_LIMIT);
        }

        const notifData = notifResult?.data;
        if (notifData) setAppNotifications(notifData.map((n: any) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          type: n.type as AppNotification['type'],
          read: n.read,
          createdAt: n.created_at,
          userId: n.user_id
        })));

        const reqData = reqResult?.data;
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
    if (!user) return;
    if (inventoryWarehouseScope === activeWarehouse) return;
    void loadInventoryForWarehouse(activeWarehouse, INITIAL_INVENTORY_LIMIT);
  }, [user, activeWarehouse, inventoryWarehouseScope]);

  useEffect(() => {
    if (!user) return;

    pageFetchSequence.current.movements += 1;
    pageFetchSequence.current.purchaseOrders += 1;
    pageFetchSequence.current.materialRequests += 1;

    setMovementsPage(1);
    setPurchaseOrdersPage(1);
    setMaterialRequestsPage(1);

    setPagedMovements([]);
    setPagedPurchaseOrders([]);
    setPagedMaterialRequests([]);
    setHasMoreMovements(false);
    setHasMorePurchaseOrders(false);
    setHasMoreMaterialRequests(false);
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
    const { error } = await api.from('users').insert({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      status: newUser.status,
      last_access: toIsoDateTime(newUser.lastAccess),
      avatar: newUser.avatar,
      password: newUser.password,
      modules: newUser.modules,
      allowed_warehouses: newUser.allowedWarehouses
    });

    if (!error) {
      setUsers(prev => [...prev, newUser]);
      addActivity('alerta', 'Novo Usuário', `Usuário ${newUser.name} cadastrado`);
      showNotification(`Usuário ${newUser.name} cadastrado com sucesso!`, 'success');
    } else {
      showNotification('Erro ao cadastrar usuário', 'error');
    }
  };

  const handleUpdateUser = async (updatedUser: User) => {
    const { error } = await api.from('users').eq('id', updatedUser.id).update({
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      status: updatedUser.status,
      avatar: updatedUser.avatar,
      password: updatedUser.password,
      modules: updatedUser.modules,
      allowed_warehouses: updatedUser.allowedWarehouses
    });

    if (!error) {
      setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
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

  const recordMovement = async (type: Movement['type'], item: InventoryItem, quantity: number, reason: string, orderId?: string) => {
    const movementTimestampIso = nowIso();
    const movementId = generateUuid();
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
      warehouseId: activeWarehouse // NOVO
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
      warehouse_id: newMovement.warehouseId
    });

    if (!error) {
      setMovements(prev => [newMovement, ...prev]);
      if (newMovement.warehouseId === activeWarehouse && movementsPage === 1) {
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
          setInventory(prev => prev.map(i => i.sku === data.sku ? { ...i, ...data } : i));
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

        if (!error && insertedData && insertedData[0]) {
          const newItem: InventoryItem = {
            ...data,
            sku: insertedData[0].sku,
            quantity: 0,
            status: 'disponivel',
            batch: 'N/A',
            expiry: 'N/A',
            location: 'DOCA-01',
            minQty: 10,
            maxQty: 1000,
            leadTime: 7,
            safetyStock: 5
          };
          setInventory(prev => [...prev, newItem]);
          await recordMovement('entrada', newItem, 0, 'Criação de novo Código de Produto');
        } else if (error) {
          showNotification('Erro ao criar item. Verifique a conexão.', 'error');
        }
      }
    } else if (type === 'vendor') {
      if (isEdit) {
        const { error } = await api.from('vendors').eq('id', data.id).update(data);
        if (!error) {
          setVendors(prev => prev.map(v => v.id === data.id ? { ...v, ...data } : v));
          showNotification('Fornecedor atualizado com sucesso', 'success');
        } else {
          showNotification(`Erro ao atualizar fornecedor: ${error.message}`, 'error');
        }
      } else {
        const newVendor: Vendor = { ...data, id: Date.now().toString(), status: 'Ativo' };
        const { error } = await api.from('vendors').insert(newVendor);
        if (!error) {
          setVendors(prev => [...prev, newVendor]);
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
      processedData = data.map(d => ({ id: d.id, name: String(d.name || ''), cnpj: String(d.cnpj || ''), contact: String(d.contact || ''), status: d.status || 'Ativo' }));
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
      } else if (type === 'vendor') {
        setVendors(prev => [...prev, ...data]);
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
      if (type === 'item') setInventory(prev => prev.filter(x => x.sku !== id));
      if (type === 'vendor') setVendors(prev => prev.filter(x => x.id !== id));
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
    localStorage.setItem('logged_user', JSON.stringify(loggedInUser));
    if (token) {
      api.setAuthToken(token);
    }

    setUser(loggedInUser);

    // Configurar armazéns permitidos baseados na role e permissões
    let allowed: string[] = [];
    if (loggedInUser.role === 'admin') {
      // Usar o estado warehouses que já deve estar carregado
      allowed = warehouses.length > 0 ? warehouses.map(w => w.id) : ['ARMZ28', 'ARMZ33'];
    } else {
      allowed = loggedInUser.allowedWarehouses || [];
    }

    setUserWarehouses(allowed);

    // Garantir que o armazém ativo seja um dos permitidos
    let targetWarehouse = activeWarehouse;
    if (allowed.length > 0 && !allowed.includes(activeWarehouse)) {
      targetWarehouse = allowed[0];
      setActiveWarehouse(targetWarehouse);
    }

    if (registerActivity) {
      addActivity('alerta', 'Login Realizado', `Usuário ${loggedInUser.name} acessou o sistema`);
    }

    if (token) {
      const bootstrapData = loadBootstrapDataRef.current;
      if (!bootstrapData) return;

      setIsLoading(true);
      void (async () => {
        try {
          await bootstrapData(targetWarehouse);
        } catch (error) {
          console.error('Erro ao carregar dados apos login:', error);
        } finally {
          setIsLoading(false);
        }
      })();
    }
  };

  const logout = () => {
    api.clearAuthToken();
    localStorage.removeItem('logged_user');
    pageFetchSequence.current.movements += 1;
    pageFetchSequence.current.purchaseOrders += 1;
    pageFetchSequence.current.materialRequests += 1;
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
    setHasMorePurchaseOrders(false);
    setHasMoreMovements(false);
    setHasMoreMaterialRequests(false);
    setIsPurchaseOrdersPageLoading(false);
    setIsMovementsPageLoading(false);
    setIsMaterialRequestsPageLoading(false);
    setPurchaseOrdersPage(1);
    setMovementsPage(1);
    setMaterialRequestsPage(1);
    fullLoadInFlight.current.clear();
    setUser(null);
  };

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

  const handleUpdateInventoryQuantity = async (
    sku: string,
    qty: number,
    reason = 'Saída para Expedição',
    orderId?: string
  ) => {
    const item = inventory.find(i => i.sku === sku);
    if (!item) {
      showNotification(`Item ${sku} não encontrado no inventário.`, 'error');
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
      .eq('warehouse_id', activeWarehouse)
      .update({ quantity: newQuantity });

    if (!error) {
      setInventory(prev => prev.map(i => i.sku === sku ? { ...i, quantity: newQuantity } : i));
      await recordMovement('saida', item, qty, reason, orderId);
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


  return (
    <div className={`flex w-screen h-screen overflow-hidden ${isDarkMode ? 'dark' : ''}`}>
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
                onProcessPicking={handleUpdateInventoryQuantity}
                onRequestCreate={handleRequestCreate}
                onRequestUpdate={handleRequestUpdate}
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
                currentPage={purchaseOrdersPage}
                pageSize={PURCHASE_ORDERS_PAGE_SIZE}
                hasNextPage={hasMorePurchaseOrders}
                isPageLoading={isPurchaseOrdersPageLoading}
                onPageChange={setPurchaseOrdersPage}
              />
            )}
            {activeModule === 'cadastro' && (
              <MasterData
                inventory={inventory.filter(i => i.warehouseId === activeWarehouse)}
                vendors={vendors}
                vehicles={vehicles}
                onAddRecord={handleAddMasterRecord}
                onRemoveRecord={handleRemoveMasterRecord}
                onImportRecords={handleImportMasterRecords}
                onSyncAPI={handleSyncFleetAPI}
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
    </div>
  );
};



