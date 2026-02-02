
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { Dashboard } from './pages/Dashboard';
import { Receiving } from './pages/Receiving';
import { Movements } from './pages/Movements';
import { Inventory } from './pages/Inventory';
import { Expedition } from './pages/Expedition';
import { PurchaseOrders } from './pages/PurchaseOrders';
import { MasterData } from './pages/MasterData';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Module, InventoryItem, Activity, Movement, Vendor, Vehicle, PurchaseOrder, Quote, ApprovalRecord, User } from './types';
import { LoginPage } from './components/LoginPage';
import { supabase } from './supabase';


const App: React.FC = () => {
  const [activeModule, setActiveModule] = useState<Module>('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activities, setActivities] = useState<Activity[]>([
    { id: '1', type: 'alerta', title: 'Sistema Norte Tech Conectado', subtitle: 'Banco de dados Supabase ativo', time: 'Agora' }
  ]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' | 'warning' } | null>(null);

  // Supabase Data Fetching
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: invData } = await supabase.from('inventory').select('*');
        if (invData) setInventory(invData.map(item => ({
          sku: item.sku,
          name: item.name,
          location: item.location,
          batch: item.batch,
          expiry: item.expiry,
          quantity: item.quantity,
          status: item.status,
          imageUrl: item.image_url,
          category: item.category,
          unit: item.unit || 'UN',
          minQty: item.min_qty,
          maxQty: item.max_qty
        })));

        const { data: venData } = await supabase.from('vendors').select('*');
        if (venData) setVendors(venData);

        const { data: vehData } = await supabase.from('vehicles').select('*');
        if (vehData) setVehicles(vehData);

        const { data: userData } = await supabase.from('users').select('*');
        if (userData) setUsers(userData.map(u => ({
          ...u,
          lastAccess: u.last_access
        })));

        const { data: poData } = await supabase.from('purchase_orders').select('*');
        if (poData) setPurchaseOrders(poData.map(po => ({
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
          vendorOrderNumber: po.vendor_order_number,
          approvalHistory: po.approval_history
        })));

        const { data: movData } = await supabase.from('movements').select('*').order('timestamp', { ascending: false });
        if (movData) setMovements(movData);

      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  const handleAddUser = async (newUser: User) => {
    const { error } = await supabase.from('users').insert([{
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      status: newUser.status,
      last_access: newUser.lastAccess,
      avatar: newUser.avatar,
      password: newUser.password,
      modules: newUser.modules
    }]);

    if (!error) {
      setUsers(prev => [...prev, newUser]);
      addActivity('alerta', 'Novo Usuário', `Usuário ${newUser.name} cadastrado`);
      showNotification(`Usuário ${newUser.name} cadastrado com sucesso!`, 'success');
    } else {
      showNotification('Erro ao cadastrar usuário', 'error');
    }
  };

  const handleUpdateUser = async (updatedUser: User) => {
    const { error } = await supabase.from('users').update({
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      status: updatedUser.status,
      avatar: updatedUser.avatar,
      password: updatedUser.password,
      modules: updatedUser.modules
    }).eq('id', updatedUser.id);

    if (!error) {
      setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
      showNotification('Usuário atualizado com sucesso!', 'success');
    } else {
      showNotification('Erro ao atualizar usuário', 'error');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const { error } = await supabase.from('users').delete().eq('id', userId);
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

  const showNotification = (message: string, type: 'success' | 'error' | 'warning') => {
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

  const recordMovement = async (type: Movement['type'], item: InventoryItem, quantity: number, reason: string, orderId?: string) => {
    const newMovement: Movement = {
      id: `MOV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleString('pt-BR'),
      type,
      sku: item.sku,
      productName: item.name,
      quantity: quantity,
      user: 'Ricardo Souza',
      location: item.location,
      reason: reason,
      orderId: orderId
    };

    const { error } = await supabase.from('movements').insert([newMovement]);
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

        if (!alreadyRequested) {
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
              qty: item.maxQty - item.quantity,
              price: 0
            }]
          };

          const { error } = await supabase.from('purchase_orders').insert([{
            id: autoPO.id,
            vendor: autoPO.vendor,
            request_date: autoPO.requestDate,
            status: autoPO.status,
            priority: autoPO.priority,
            total: autoPO.total,
            requester: autoPO.requester,
            items: autoPO.items
          }]);

          if (!error) {
            setPurchaseOrders(prev => [autoPO, ...prev]);
            addActivity('alerta', 'Reposição Automática', `Pedido gerado para ${item.sku} (Saldo: ${item.quantity})`);
            showNotification(`Estoque Crítico! Reposição gerada para ${item.sku}`, 'warning');
          }
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

    const { error } = await supabase.from('purchase_orders').update({
      status: 'aprovado',
      approval_history: newApprovalHistory
    }).eq('id', id);

    if (!error) {
      setPurchaseOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'aprovado', approvalHistory: newApprovalHistory } : o));
      addActivity('compra', 'Aprovação de Pedido', `Requisição ${id} aprovada - pronta para envio`);
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

    const { error } = await supabase.from('purchase_orders').update({
      status: 'requisicao',
      approval_history: newApprovalHistory
    }).eq('id', id);

    if (!error) {
      setPurchaseOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'requisicao', approvalHistory: newApprovalHistory } : o));
      addActivity('alerta', 'Pedido Rejeitado', `Requisição ${id} retornou para cotação`);
      showNotification(`Pedido ${id} rejeitado. Refaça as cotações.`, 'warning');
    }
  };

  const handleCreatePO = async (newOrder: PurchaseOrder) => {
    const orderWithStatus = { ...newOrder, status: 'requisicao' as const };
    const { error } = await supabase.from('purchase_orders').insert([{
      id: orderWithStatus.id,
      vendor: orderWithStatus.vendor,
      request_date: orderWithStatus.requestDate,
      status: orderWithStatus.status,
      priority: orderWithStatus.priority,
      total: orderWithStatus.total,
      requester: orderWithStatus.requester,
      items: orderWithStatus.items
    }]);

    if (!error) {
      setPurchaseOrders(prev => [orderWithStatus, ...prev]);
      addActivity('compra', 'Nova Requisição', `Pedido manual ${orderWithStatus.id} criado - aguardando cotações`);
      showNotification(`Pedido ${orderWithStatus.id} criado! Adicione 3 cotações para prosseguir.`, 'success');
    }
  };

  const handleAddQuotes = async (poId: string, quotes: Quote[]) => {
    const { error } = await supabase.from('purchase_orders').update({
      quotes,
      status: 'cotacao'
    }).eq('id', poId);

    if (!error) {
      setPurchaseOrders(prev => prev.map(o =>
        o.id === poId ? { ...o, quotes, status: 'cotacao' as const } : o
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

    const { error } = await supabase.from('purchase_orders').update({
      selected_quote_id: selectedQuoteId,
      vendor: selectedQuote.vendorName,
      total: selectedQuote.totalValue,
      status: 'pendente',
      quotes: updatedQuotes
    }).eq('id', poId);

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
      showNotification(`Pedido ${poId} enviado para aprovação!`, 'success');
    }
  };

  const handleMarkAsSent = async (poId: string, vendorOrderNumber: string) => {
    const sentAt = new Date().toLocaleString('pt-BR');
    const { error } = await supabase.from('purchase_orders').update({
      status: 'enviado',
      vendor_order_number: vendorOrderNumber,
      sent_to_vendor_at: sentAt
    }).eq('id', poId);

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

    const { error } = await supabase.from('inventory').update({ quantity: item.quantity - qty }).eq('sku', sku);

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

    const { error } = await supabase.from('inventory').update({
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
      max_qty: updatedItem.maxQty
    }).eq('sku', updatedItem.sku);

    if (!error) {
      const newInventory = inventory.map(i => i.sku === updatedItem.sku ? updatedItem : i);
      setInventory(newInventory);
      showNotification(`Item ${updatedItem.sku} atualizado com sucesso`, 'success');
      evaluateStockLevels(newInventory);
    } else {
      showNotification('Erro ao atualizar estoque', 'error');
    }
  };

  const handleFinalizeReceipt = async (receivedItems: any[], poId?: string) => {
    const newInventory = [...inventory];
    for (const received of receivedItems) {
      const index = newInventory.findIndex(i => i.sku === received.sku);
      if (index > -1) {
        const item = newInventory[index];
        const updatedQty = item.quantity + received.received;

        const { error } = await supabase.from('inventory').update({ quantity: updatedQty }).eq('sku', item.sku);
        if (!error) {
          newInventory[index] = { ...item, quantity: updatedQty };
          await recordMovement('entrada', newInventory[index], received.received, `Entrada via Recebimento de ${poId || 'PO'}`, poId);
        }
      }
    }
    setInventory(newInventory);

    if (poId) {
      const { error } = await supabase.from('purchase_orders').update({ status: 'recebido' }).eq('id', poId);
      if (!error) {
        setPurchaseOrders(prev => prev.map(po => po.id === poId ? { ...po, status: 'recebido' } : po));
        addActivity('recebimento', 'Recebimento Finalizado', `Carga ${poId} conferida e armazenada`);
      }
    }

    showNotification(`Recebimento finalizado${poId ? ` - ${poId}` : ''}`, 'success');
  };

  const handleAddMasterRecord = async (type: 'item' | 'vendor' | 'vehicle', data: any, isEdit: boolean) => {
    if (type === 'item') {
      if (isEdit) {
        const { error } = await supabase.from('inventory').update({
          name: data.name,
          category: data.category,
          unit: data.unit,
          image_url: data.imageUrl
        }).eq('sku', data.sku);

        if (!error) {
          setInventory(prev => prev.map(i => i.sku === data.sku ? { ...i, ...data } : i));
        }
      } else {
        const newItem: InventoryItem = { ...data, quantity: 0, status: 'disponivel', batch: 'N/A', expiry: 'N/A', location: 'DOCA-01', minQty: 10, maxQty: 1000 };
        const { error } = await supabase.from('inventory').insert([{
          sku: newItem.sku,
          name: newItem.name,
          category: newItem.category,
          unit: newItem.unit,
          image_url: newItem.imageUrl,
          quantity: 0,
          status: 'disponivel',
          location: 'DOCA-01',
          min_qty: 10,
          max_qty: 1000
        }]);

        if (!error) {
          setInventory(prev => [...prev, newItem]);
          await recordMovement('entrada', newItem, 0, 'Criação de novo SKU mestre');
        }
      }
    } else if (type === 'vendor') {
      if (isEdit) {
        const { error } = await supabase.from('vendors').update(data).eq('id', data.id);
        if (!error) setVendors(prev => prev.map(v => v.id === data.id ? { ...v, ...data } : v));
      } else {
        const newVendor: Vendor = { ...data, id: Date.now().toString(), status: 'Ativo' };
        const { error } = await supabase.from('vendors').insert([newVendor]);
        if (!error) setVendors(prev => [...prev, newVendor]);
      }
    } else if (type === 'vehicle') {
      if (isEdit) {
        const { error } = await supabase.from('vehicles').update(data).eq('plate', data.plate);
        if (!error) setVehicles(prev => prev.map(v => v.plate === data.plate ? { ...v, ...data } : v));
      } else {
        const newVehicle: Vehicle = { ...data, status: 'Disponível', lastMaintenance: new Date().toLocaleDateString('pt-BR') };
        const { error } = await supabase.from('vehicles').insert([newVehicle]);
        if (!error) setVehicles(prev => [...prev, newVehicle]);
      }
    }
    showNotification(`${isEdit ? 'Registro atualizado' : 'Cadastro realizado'} com sucesso`, 'success');
  };

  const handleImportMasterRecords = async (type: 'item' | 'vendor' | 'vehicle', data: any[]) => {
    let table = '';
    let processedData = [];

    if (type === 'item') {
      table = 'inventory';
      processedData = data.map(d => ({
        sku: d.sku,
        name: d.name,
        category: d.category,
        unit: d.unit,
        image_url: d.imageUrl,
        quantity: d.quantity,
        status: d.status,
        location: d.location,
        min_qty: d.minQty,
        max_qty: d.maxQty
      }));
    } else if (type === 'vendor') {
      table = 'vendors';
      processedData = data.map(d => ({
        id: d.id,
        name: d.name,
        cnpj: d.cnpj,
        contact: d.contact,
        status: d.status
      }));
    } else if (type === 'vehicle') {
      table = 'vehicles';
      processedData = data.map(d => ({
        plate: d.plate,
        model: d.model,
        driver: d.driver,
        type: d.type,
        status: d.status,
        last_maintenance: d.lastMaintenance
      }));
    }

    const { error } = await supabase.from(table).insert(processedData);

    if (!error) {
      if (type === 'item') setInventory(prev => [...prev, ...data]);
      else if (type === 'vendor') setVendors(prev => [...prev, ...data]);
      else if (type === 'vehicle') setVehicles(prev => [...prev, ...data]);

      showNotification(`${data.length} registros importados com sucesso!`, 'success');
      addActivity('alerta', 'Importação XLSX', `${data.length} registros de ${type} adicionados`);
    } else {
      showNotification('Erro ao importar registros. Verifique duplicidade de SKUs/Placas.', 'error');
      console.error('Import error:', error);
    }
  };

  const handleRemoveMasterRecord = async (type: 'item' | 'vendor' | 'vehicle', id: string) => {
    if (type === 'item') {
      const { error } = await supabase.from('inventory').delete().eq('sku', id);
      if (!error) {
        setInventory(prev => prev.filter(i => i.sku !== id));
        showNotification(`Item ${id} removido com sucesso`, 'success');
      }
    } else if (type === 'vendor') {
      const { error } = await supabase.from('vendors').delete().eq('id', id);
      if (!error) {
        setVendors(prev => prev.filter(v => v.id !== id));
        showNotification(`Fornecedor removido com sucesso`, 'success');
      }
    } else if (type === 'vehicle') {
      const { error } = await supabase.from('vehicles').delete().eq('plate', id);
      if (!error) {
        setVehicles(prev => prev.filter(v => v.plate !== id));
        showNotification(`Veículo ${id} removido com sucesso`, 'success');
      }
    }
  };

  const handleCreateAutoPO = async (item: InventoryItem) => {
    const alreadyRequested = purchaseOrders.some(po =>
      (po.status === 'requisicao' || po.status === 'cotacao' || po.status === 'pendente') &&
      po.items.some(i => i.sku === item.sku)
    );

    if (alreadyRequested) {
      showNotification(`Já existe uma requisição em andamento para ${item.name}`, 'warning');
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
        qty: item.maxQty - item.quantity,
        price: 0
      }]
    };

    const { error } = await supabase.from('purchase_orders').insert([{
      id: autoPO.id,
      vendor: autoPO.vendor,
      request_date: autoPO.requestDate,
      status: autoPO.status,
      priority: autoPO.priority,
      total: autoPO.total,
      requester: autoPO.requester,
      items: autoPO.items
    }]);

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
      case 'expedicao': return 'Expedição e Picking';
      case 'cadastro': return 'Cadastro de Mestres';
      case 'compras': return 'Pedidos de Compra';
      default: return 'Norte Tech WMS';
    }
  };

  const [user, setUser] = useState<User | null>(null);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    addActivity('alerta', 'Login Realizado', `Usuário ${loggedInUser.name} acessou o sistema`);
  };

  const logout = () => {
    setUser(null);
  };

  if (!user) {
    return <LoginPage users={users} onLogin={handleLogin} />;
  }

  return (
    <div className={`flex w-screen h-screen overflow-hidden ${isDarkMode ? 'dark' : ''}`}>
      <Sidebar activeModule={activeModule} onModuleChange={setActiveModule} user={user} />
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <TopBar isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} title={getPageTitle(activeModule)} />
        <main className="flex-1 overflow-y-auto bg-background-light dark:bg-background-dark p-6 lg:p-10 relative">
          {notification && (
            <div className={`fixed top-20 right-8 z-50 animate-in slide-in-from-right px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 border ${notification.type === 'success' ? 'bg-emerald-500 text-white border-emerald-400' :
              notification.type === 'error' ? 'bg-red-500 text-white border-red-400' : 'bg-amber-500 text-white border-amber-400'
              }`}>
              <span className="material-symbols-outlined">info</span>
              <span className="font-bold text-sm">{notification.message}</span>
            </div>
          )}

          {activeModule === 'dashboard' && <Dashboard inventory={inventory} activities={activities} />}
          {activeModule === 'recebimento' && (
            <Receiving
              onFinalize={handleFinalizeReceipt}
              availablePOs={purchaseOrders.filter(po => po.status === 'enviado')}
            />
          )}
          {activeModule === 'movimentacoes' && <Movements movements={movements} />}
          {activeModule === 'estoque' && <Inventory items={inventory} onUpdateItem={handleUpdateInventoryItem} onCreateAutoPO={handleCreateAutoPO} />}
          {activeModule === 'expedicao' && <Expedition inventory={inventory} onProcessPicking={handleProcessPicking} />}
          {activeModule === 'compras' && (
            <PurchaseOrders
              user={user}
              orders={purchaseOrders}
              vendors={vendors}
              inventory={inventory}
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
              inventory={inventory}
              vendors={vendors}
              vehicles={vehicles}
              onAddRecord={handleAddMasterRecord}
              onRemoveRecord={handleRemoveMasterRecord}
              onImportRecords={handleImportMasterRecords}
            />
          )}
          {activeModule === 'relatorios' && <Reports />}
          {activeModule === 'configuracoes' && (
            <Settings
              users={users}
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

export default App;
