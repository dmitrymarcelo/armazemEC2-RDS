
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { WarehouseSelector } from './components/WarehouseSelector';
import { Dashboard } from './pages/Dashboard';
import { Receiving } from './pages/Receiving';
import { Movements } from './pages/Movements';
import { Inventory } from './pages/Inventory';
import { Expedition, MaterialRequest } from './pages/Expedition';
type RequestStatus = 'aprovacao' | 'separacao' | 'entregue'; // Re-defining locally for simplicity or import if exported

import { CyclicInventory } from './pages/CyclicInventory';
import { PurchaseOrders } from './pages/PurchaseOrders';
import { MasterData } from './pages/MasterData';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Module, InventoryItem, Activity, Movement, Vendor, Vehicle, PurchaseOrder, Quote, ApprovalRecord, User, AppNotification, CyclicBatch, CyclicCount, Warehouse } from './types';
import { LoginPage } from './components/LoginPage';
import { api } from './api-client';


export const App: React.FC = () => {

  const [activeModule, setActiveModule] = useState<Module>('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
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
  const [materialRequests, setMaterialRequests] = useState<any[]>([]); // Using any for now to avoid extensive type updates in App.tsx imports yet

  // API Data Fetching
  useEffect(() => {
    const fetchData = async () => {
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

        const { data: invData } = await api.from('inventory').select('*');
        if (invData) setInventory(invData.map((item: any) => ({
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
        })));

        const { data: batchesData } = await api.from('cyclic_batches').select('*').order('created_at', { ascending: false });
        if (batchesData) setCyclicBatches(batchesData.map((b: any) => ({
          id: b.id,
          status: b.status,
          scheduledDate: b.scheduled_date,
          completedAt: b.completed_at,
          accuracyRate: b.accuracy_rate,
          totalItems: b.total_items,
          divergentItems: b.divergent_items,
          warehouseId: b.warehouse_id || 'ARMZ28'
        })));

        const { data: venData } = await api.from('vendors').select('*');
        if (venData) setVendors(venData);

        const { data: vehData } = await api.from('vehicles').select('*');
        if (vehData) setVehicles(vehData.map((v: any) => ({
          plate: v.plate,
          model: v.model,
          type: v.type,
          status: v.status,
          lastMaintenance: v.last_maintenance,
          costCenter: v.cost_center
        })));

        const { data: userData } = await api.from('users').select('*');
        if (userData) {
          const mappedUsers = userData.map((u: any) => ({
            ...u,
            lastAccess: u.last_access,
            allowedWarehouses: u.allowed_warehouses || ['ARMZ28']
          }));
          setUsers(mappedUsers);
        }

        const { data: poData } = await api.from('purchase_orders').select('*');
        if (poData) setPurchaseOrders(poData.map((po: any) => ({
          id: po.id,
          vendor: po.vendor,
          requestDate: po.request_date,
          status: po.status,
          priority: po.priority,
          total: po.total,
          requester: po.requester,
          items: po.items,
          quotes: po.quotes,
          selectedQuoteId: po.selected_quote_id,
          sentToVendorAt: po.sent_to_vendor_at,
          receivedAt: po.received_at,
          quotesAddedAt: po.quotes_added_at,
          approvedAt: po.approved_at,
          rejectedAt: po.rejected_at,
          vendorOrderNumber: po.vendor_order_number,
          approvalHistory: po.approval_history,
          warehouseId: po.warehouse_id || 'ARMZ28'
        })));

        const { data: movData } = await api.from('movements').select('*').order('timestamp', { ascending: false });
        if (movData) setMovements(movData.map((m: any) => ({
          id: m.id,
          sku: m.sku,
          productName: m.product_name || m.name || 'Produto Indefinido',
          type: m.type as Movement['type'],
          quantity: m.quantity,
          timestamp: m.timestamp || new Date().toISOString(),
          user: m.user || 'Sistema',
          location: m.location || 'N/A',
          reason: m.reason || 'Sem motivo registrado',
          orderId: m.order_id,
          warehouseId: m.warehouse_id || 'ARMZ28'
        })));

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




        const { data: reqData } = await api.from('material_requests').select('*').order('created_at', { ascending: false });
        if (reqData) setMaterialRequests(reqData.map((r: any) => ({
          id: r.id,
          sku: r.sku,
          name: r.name,
          qty: r.qty,
          plate: r.plate,
          dept: r.dept,
          priority: r.priority,
          status: r.status,
          timestamp: new Date(r.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          costCenter: r.cost_center,
          warehouseId: r.warehouse_id
        })));

      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    const initAuth = async () => {
      setIsLoading(true);
      try {
        // Primeiro garantimos que os dados (como warehouses) foram carregados pelo fetchData
        await fetchData();

        const savedUser = localStorage.getItem('logged_user');
        if (savedUser) {
          const parsedUser = JSON.parse(savedUser);
          handleLogin(parsedUser);
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
    return () => { };
  }, []);

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
      last_access: newUser.lastAccess,
      avatar: newUser.avatar,
      password: newUser.password,
      modules: JSON.stringify(newUser.modules),
      allowed_warehouses: JSON.stringify(newUser.allowedWarehouses)
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
      modules: JSON.stringify(updatedUser.modules),
      allowed_warehouses: JSON.stringify(updatedUser.allowedWarehouses)
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
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
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
    const newNotif = Array.isArray(newNotifs) ? newNotifs[0] : newNotifs;

    if (!error && newNotif) {
      // Local state update is handled by the real-time subscription in useEffect
      // but we can also set the temporary toast
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
    const newMovement: Movement = {
      id: `MOV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleString('pt-BR'),
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
      id: newMovement.id,
      timestamp: newMovement.timestamp,
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

        const autoPO: PurchaseOrder = {
          id: `AUTO-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          vendor: 'A definir via cotações',
          requestDate: new Date().toLocaleDateString('pt-BR'),
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
          warehouseId: activeWarehouse // NOVO
        };

        const { error } = await api.from('purchase_orders').insert({
          id: autoPO.id,
          vendor: autoPO.vendor,
          request_date: autoPO.requestDate,
          status: autoPO.status,
          priority: autoPO.priority,
          total: autoPO.total,
          requester: autoPO.requester,
          items: JSON.stringify(autoPO.items),
          warehouse_id: activeWarehouse
        });

        if (!error) {
          setPurchaseOrders(prev => [autoPO, ...prev]);
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

    const approvalRecord: ApprovalRecord = {
      id: `APR-${Date.now()}`,
      action: 'approved',
      by: 'Gestor de Compras',
      at: new Date().toLocaleString('pt-BR')
    };

    const newApprovalHistory = [...(po.approvalHistory || []), approvalRecord];

    const { error } = await api.from('purchase_orders').eq('id', id).update({
      status: 'aprovado',
      approval_history: JSON.stringify(newApprovalHistory),
      approved_at: approvalRecord.at
    });

    if (!error) {
      setPurchaseOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'aprovado', approvalHistory: newApprovalHistory, approvedAt: approvalRecord.at } : o));
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

    const rejectionRecord: ApprovalRecord = {
      id: `REJ-${Date.now()}`,
      action: 'rejected',
      by: 'Gestor de Compras',
      at: new Date().toLocaleString('pt-BR'),
      reason: reason || 'Sem justificativa'
    };

    const newApprovalHistory = [...(po.approvalHistory || []), rejectionRecord];

    const { error } = await api.from('purchase_orders').eq('id', id).update({
      status: 'requisicao', // Volta para o início do fluxo
      approval_history: JSON.stringify(newApprovalHistory),
      rejected_at: rejectionRecord.at
    });

    if (!error) {
      setPurchaseOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'requisicao', approvalHistory: newApprovalHistory, rejectedAt: rejectionRecord.at } : o));

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
      // Formato: "02/02/2026 15:30:00" ou similar
      const [datePart] = m.timestamp.split(' ');
      const [day, month, year] = datePart.split('/').map(Number);
      const mDate = new Date(year, month - 1, day);
      return m.type === 'saida' && mDate >= thirtyDaysAgo;
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
            await api.from('purchase_orders').eq('id', auto.id).update({ status: 'rejeitado' });
            setPurchaseOrders(prev => prev.map(p => p.id === auto.id ? { ...p, status: 'rejeitado' as const } : p));
            showNotification(`Pedido AUTO ${auto.id} cancelado: suprido por manual.`, 'success');
          } else {
            // Atualiza quantidades
            await api.from('purchase_orders').eq('id', auto.id).update({ items: JSON.stringify(updatedItems) });
            setPurchaseOrders(prev => prev.map(p => p.id === auto.id ? { ...p, items: updatedItems } : p));
          }
        }
      }
    }
  };

  const handleCreatePO = async (newOrder: PurchaseOrder) => {
    const orderWithStatus: PurchaseOrder = { ...newOrder, status: 'requisicao', warehouseId: activeWarehouse };
    const { error } = await api.from('purchase_orders').insert({
      id: orderWithStatus.id,
      vendor: orderWithStatus.vendor,
      status: orderWithStatus.status,
      priority: orderWithStatus.priority,
      total: orderWithStatus.total,
      requester: orderWithStatus.requester,
      items: JSON.stringify(orderWithStatus.items),
      plate: orderWithStatus.plate,
      cost_center: orderWithStatus.costCenter,
      request_date: new Date().toLocaleString('pt-BR'),
      warehouse_id: activeWarehouse
    });

    if (!error) {
      // Sincronizar com pedidos automáticos para evitar duplicidade
      await handleSyncAutoPOs(orderWithStatus.items.map(i => ({ sku: i.sku, qty: i.qty })));

      setPurchaseOrders(prev => [orderWithStatus, ...prev]);
      addActivity('compra', 'Nova Requisição', `Pedido manual ${orderWithStatus.id} criado - aguardando cotações`);
      showNotification(`Pedido ${orderWithStatus.id} criado! Adicione 3 cotações para prosseguir.`, 'success');
    }
  };

  const handleAddQuotes = async (poId: string, quotes: Quote[]) => {
    const quotesAddedAt = new Date().toLocaleString('pt-BR');
    const { error } = await api.from('purchase_orders').eq('id', poId).update({
      quotes: JSON.stringify(quotes),
      status: 'cotacao',
      quotes_added_at: quotesAddedAt
    });

    if (!error) {
      setPurchaseOrders(prev => prev.map(o =>
        o.id === poId ? { ...o, quotes, status: 'cotacao' as const, quotesAddedAt } : o
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

    const { error } = await api.from('purchase_orders').eq('id', poId).update({
      selected_quote_id: selectedQuoteId,
      vendor: selectedQuote.vendorName,
      total: selectedQuote.totalValue,
      status: 'pendente',
      quotes: JSON.stringify(updatedQuotes)
    });

    if (!error) {
      setPurchaseOrders(prev => prev.map(o => o.id === poId ? {
        ...o,
        selectedQuoteId,
        vendor: selectedQuote.vendorName,
        total: selectedQuote.totalValue,
        status: 'pendente' as const,
        quotes: updatedQuotes
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
    const sentAt = new Date().toLocaleString('pt-BR');
    const { error } = await api.from('purchase_orders').eq('id', poId).update({
      status: 'enviado',
      vendor_order_number: vendorOrderNumber,
      sent_to_vendor_at: sentAt
    });

    if (!error) {
      setPurchaseOrders(prev => prev.map(o =>
        o.id === poId ? {
          ...o,
          status: 'enviado' as const,
          vendorOrderNumber,
          sentToVendorAt: sentAt
        } : o
      ));
      addActivity('compra', 'Pedido Enviado', `PO ${poId} despachado ao fornecedor - Nº ${vendorOrderNumber}`);
      showNotification(`Pedido ${poId} marked as sent!`, 'success');
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
              await api.from('purchase_orders').update({ items: JSON.stringify(updatedItems) }).eq('id', autoPO.id);
              setPurchaseOrders(prev => prev.map(po => po.id === autoPO.id ? { ...po, items: updatedItems } : po));
            }
          } else {
            // Atualizar quantidade do item no pedido se houve mudança
            if (autoPO.items[itemIndex].qty !== newQty) {
              const updatedItems = autoPO.items.map(item =>
                item.sku === updatedItem.sku ? { ...item, qty: newQty } : item
              );

              await api.from('purchase_orders').update({ items: JSON.stringify(updatedItems) }).eq('id', autoPO.id);
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
    const batchId = `INV-${Date.now()}`;
    const { error: batchError } = await api.from('cyclic_batches').insert({
      id: batchId,
      status: 'aberto',
      total_items: items.length,
      warehouse_id: activeWarehouse
    });

    if (!batchError) {
      const counts = items.map(item => ({
        batch_id: batchId,
        sku: item.sku,
        expected_qty: item.expected,
        status: 'pendente'
      }));

      const { error: countsError } = await api.from('cyclic_counts').insert(counts);
      if (!countsError) {
        const { data: batches } = await api.from('cyclic_batches').select('*').eq('id', batchId);
        const newBatch = Array.isArray(batches) ? batches[0] : batches;
        if (newBatch) {
          setCyclicBatches(prev => [{
            id: newBatch.id,
            status: newBatch.status,
            scheduledDate: newBatch.scheduled_date,
            totalItems: newBatch.total_items,
            divergentItems: newBatch.divergent_items,
            warehouseId: activeWarehouse // NOVO
          }, ...prev]);
        }
        showNotification(`Lote ${batchId} criado com ${items.length} itens!`, 'success');
        return batchId;
      }
    }
    showNotification('Erro ao criar lote de inventário', 'error');
    return null;
  };

  const handleFinalizeCyclicBatch = async (batchId: string, counts: any[]) => {
    const divergentItems = counts.filter(c => c.countedQty !== c.expectedQty).length;
    const accuracyRate = ((counts.length - divergentItems) / counts.length) * 100;

    const { error: batchError } = await api.from('cyclic_batches').eq('id', batchId).update({
      status: 'concluido',
      completed_at: new Date().toISOString(),
      accuracy_rate: accuracyRate,
      divergent_items: divergentItems
    });

    if (!batchError) {
      // Registrar movimentos de ajuste para divergências
      for (const count of counts) {
        if (count.countedQty !== count.expectedQty) {
          const item = inventory.find(i => i.sku === count.sku);
          if (item) {
            const diff = count.countedQty - count.expectedQty;
            await recordMovement('ajuste', item, Math.abs(diff), `Ajuste automático via Inventário Cíclico (${batchId})`);

            // Atualizar estoque
            await api.from('inventory').eq('sku', item.sku).update({
              quantity: count.countedQty,
              last_counted_at: new Date().toISOString()
            });
          }
        } else {
          // Apenas atualizar data de última contagem
          await api.from('inventory').eq('sku', count.sku).update({
            last_counted_at: new Date().toISOString()
          });
        }
      }

      setCyclicBatches(prev => prev.map(b => b.id === batchId ? {
        ...b,
        status: 'concluido',
        completedAt: new Date().toISOString(),
        accuracyRate,
        divergentItems
      } : b));

      // Atualizar estado local do inventário
      const updatedInv = inventory.map(item => {
        const count = counts.find(c => c.sku === item.sku);
        if (count) {
          return { ...item, quantity: count.countedQty, lastCountedAt: new Date().toISOString() };
        }
        return item;
      });
      setInventory(updatedInv);

      addActivity('alerta', 'Inventário Finalizado', `Lote ${batchId} concluído com ${accuracyRate.toFixed(1)}% de acuracidade.`);
      showNotification(`Inventário ${batchId} finalizado!`, 'success');
    }
  };

  const handleClassifyABC = async () => {
    // Analisar movimentos dos últimos 30 dias
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Obter frequência de saída por SKU
    const skuFrequency: Record<string, number> = {};
    movements
      .filter(m => m.type === 'saida') // && new Date(m.timestamp) > thirtyDaysAgo)
      .forEach(m => {
        skuFrequency[m.sku] = (skuFrequency[m.sku] || 0) + m.quantity;
      });

    // Ordenar SKUs por frequência
    const sortedSkus = inventory.map(item => ({
      sku: item.sku,
      freq: skuFrequency[item.sku] || 0
    })).sort((a, b) => b.freq - a.freq);

    const total = sortedSkus.length;
    const aLimit = Math.ceil(total * 0.2);
    const bLimit = Math.ceil(total * 0.5);

    for (let i = 0; i < total; i++) {
      let category: 'A' | 'B' | 'C' = 'C';
      if (i < aLimit) category = 'A';
      else if (i < bLimit) category = 'B';

      await api.from('inventory').eq('sku', sortedSkus[i].sku).update({ abc_category: category });
    }

    // Recarregar inventário
    const { data: invData } = await api.from('inventory').select('*');
    if (invData) setInventory(invData.map((item: any) => ({
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
      warehouseId: item.warehouse_id
    })));

    showNotification('Classificação ABC atualizada com base no giro mensal!', 'success');
  };

  const handleFinalizeReceipt = async (receivedItems: any[], poId?: string) => {
    const newInventory = [...inventory];
    for (const received of receivedItems) {
      const index = newInventory.findIndex(i => i.sku === received.sku);
      if (index > -1) {
        const item = newInventory[index];
        const updatedQty = item.quantity + received.received;

        const { error } = await api.from('inventory').eq('sku', item.sku).update({ quantity: updatedQty });
        if (!error) {
          newInventory[index] = { ...item, quantity: updatedQty };
          await recordMovement('entrada', newInventory[index], received.received, `Entrada via Recebimento de ${poId || 'PO'}`, poId);
        }
      }
    }
    setInventory(newInventory);

    // Sincronizar com pedidos automáticos baseados no que foi recebido
    await handleSyncAutoPOs(receivedItems.map(r => ({ sku: r.sku, qty: r.received })));

    if (poId) {
      const receivedAt = new Date().toLocaleString('pt-BR');
      const { error } = await api.from('purchase_orders').eq('id', poId).update({ status: 'recebido' });
      if (!error) {
        setPurchaseOrders(prev => prev.map(po => po.id === poId ? { ...po, status: 'recebido', receivedAt } : po));
        addActivity('recebimento', 'Recebimento Finalizado', `Carga ${poId} conferida e armazenada`);
        addNotification(
          `Recebimento: ${poId}`,
          `Carga recebida com sucesso. Estoque atualizado.`,
          'success'
        );
      }
    }

    showNotification(`Recebimento finalizado${poId ? ` - ${poId}` : ''}`, 'success');
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
        const newVehicle: Vehicle = { ...data, status: 'Disponível', lastMaintenance: new Date().toLocaleDateString('pt-BR') };
        const { error } = await api.from('vehicles').insert({
          plate: newVehicle.plate,
          model: newVehicle.model,
          type: newVehicle.type,
          status: newVehicle.status,
          last_maintenance: newVehicle.lastMaintenance,
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
        last_maintenance: d.lastMaintenance,
        cost_center: d.costCenter
      }));
    }

    const { data: insertedData, error } = await api.from(table).insert(processedData);

    if (!error) {
      if (type === 'item' && insertedData) {
        // Reload inventory to get full struct
        const { data: invData } = await api.from('inventory').select('*');
        if (invData) setInventory(invData.map(item => ({ ...item, sku: item.sku, imageUrl: item.image_url, minQty: item.min_qty, maxQty: item.max_qty, leadTime: item.lead_time, safetyStock: item.safety_stock })));
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

      const edgeFunctionUrl = `http://localhost:3001/fleet-sync`;
      if (import.meta.env.PROD) {
        // En produção, o Nginx pode redirecionar /api/fleet-sync se houver essa rota no backend
      }

      while (nextUrl) {
        console.log(`Chamando Bridge para: ${nextUrl}`);

        const response = await fetch(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmaGZta3VxbmhmYmxzb3J2Zm9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMzc3ODYsImV4cCI6MjA4NTYxMzc4Nn0.YGVt8iW3rm2FHWqtHXub4db7avXLUBPvsfvcrPrpfos'
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
        last_maintenance: v.dta_ult_manut ? new Date(v.dta_ult_manut).toLocaleDateString('pt-BR') : 'Sem data',
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
        lastMaintenance: v.last_maintenance,
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

    const autoPO: PurchaseOrder = {
      id: `AUTO-${Date.now()}`,
      vendor: 'A definir via cotações',
      requestDate: new Date().toLocaleDateString('pt-BR'),
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
      warehouseId: activeWarehouse // NOVO
    };

    const { error } = await api.from('purchase_orders').insert({
      id: autoPO.id,
      vendor: autoPO.vendor,
      status: autoPO.status,
      priority: autoPO.priority,
      total: autoPO.total,
      requester: autoPO.requester,
      items: JSON.stringify(autoPO.items),
      request_date: new Date().toLocaleString('pt-BR'),
      warehouse_id: activeWarehouse
    });

    if (!error) {
      setPurchaseOrders(prev => [autoPO, ...prev]);
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
      case 'estoque': return 'Gestão de Inventário';
      case 'expedicao': return 'Solicitações SA';
      case 'cadastro': return 'Cadastro de Mestres';
      case 'compras': return 'Pedidos de Compra';
      default: return 'Norte Tech WMS';
    }
  };

  const handleLogin = (loggedInUser: User) => {
    // Salva no localStorage para persistir o F5
    localStorage.setItem('logged_user', JSON.stringify(loggedInUser));

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
    if (allowed.length > 0 && !allowed.includes(activeWarehouse)) {
      setActiveWarehouse(allowed[0]);
    }

    addActivity('alerta', 'Login Realizado', `Usuário ${loggedInUser.name} acessou o sistema`);
  };

  const logout = () => {
    localStorage.removeItem('logged_user');
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
    return <LoginPage users={users} onLogin={handleLogin} />;
  }

  const handleUpdateInventoryQuantity = async (sku: string, qty: number) => {
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

    const { error } = await api.from('inventory').eq('sku', sku).update({ quantity: newQuantity });

    if (!error) {
      setInventory(prev => prev.map(i => i.sku === sku ? { ...i, quantity: newQuantity } : i));
      await recordMovement('saida', item, qty, 'Saída para Expedição');
      showNotification(`Estoque de ${sku} atualizado para ${newQuantity}.`, 'success');
      return true;
    } else {
      showNotification(`Erro ao atualizar estoque de ${sku}: ${error.message}`, 'error');
      return false;
    }
  };

  const handleRequestCreate = async (data: MaterialRequest) => {
    const { error } = await api.from('material_requests').insert({
      id: data.id,
      sku: data.sku,
      name: data.name,
      qty: data.qty,
      plate: data.plate,
      dept: data.dept,
      priority: data.priority,
      status: data.status,
      cost_center: data.costCenter,
      warehouse_id: activeWarehouse
    });
    if (error) {
      showNotification('Erro ao criar solicitação', 'error');
    } else {
      showNotification('Solicitação criada com sucesso!', 'success');
      addActivity('expedicao', 'Nova Solicitação SA', `Item ${data.sku} solicitado para veículo ${data.plate}`);
    }
  };

  const handleRequestUpdate = async (id: string, status: RequestStatus) => {
    const { error } = await api.from('material_requests').update({ status }).eq('id', id);
    if (error) {
      showNotification('Erro ao atualizar status', 'error');
    } else {
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
              <span className="material-symbols-outlined">info</span>
              <span className="font-bold text-sm">{notification.message}</span>
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
              movements={movements.filter(m => m.warehouseId === activeWarehouse)}
            />
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
              requests={materialRequests.filter(r => r.warehouseId === activeWarehouse)}
              onProcessPicking={handleUpdateInventoryQuantity}
              onRequestCreate={handleRequestCreate}
              onRequestUpdate={handleRequestUpdate}
              activeWarehouse={activeWarehouse}
            />
          )}
          {
            activeModule === 'inventario_ciclico' && (
              <CyclicInventory
                inventory={inventory.filter(i => i.warehouseId === activeWarehouse)}
                batches={cyclicBatches.filter(b => b.warehouseId === activeWarehouse)}
                onCreateBatch={handleCreateCyclicBatch}
                onFinalizeBatch={handleFinalizeCyclicBatch}
                onClassifyABC={handleClassifyABC}
              />
            )
          }

          {activeModule === 'compras' && (
            <PurchaseOrders
              user={user}
              orders={purchaseOrders.filter(po => po.warehouseId === activeWarehouse)}
              vendors={vendors}
              inventory={inventory.filter(i => i.warehouseId === activeWarehouse)}
              onCreateOrder={handleCreatePO}
              onAddQuotes={handleAddQuotes}
              onSendToApproval={handleSendToApproval}
              onMarkAsSent={handleMarkAsSent}
              onApprove={handleApprovePO}
              onReject={handleRejectPO}
            />
          )}
          {activeModule === 'cadastro' && (
            <MasterData
              inventory={inventory.filter(i => i.warehouseId === activeWarehouse)}
              vendors={vendors}
              onAddRecord={handleAddMasterRecord}
              onRemoveRecord={handleRemoveMasterRecord}
              onImportRecords={handleImportMasterRecords}
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
        </main>
      </div>
    </div>
  );
};


