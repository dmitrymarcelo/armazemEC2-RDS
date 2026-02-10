
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { InventoryItem, Vehicle } from '../types';
import { PaginationBar } from '../components/PaginationBar';

type RequestStatus = 'aprovacao' | 'separacao' | 'entregue';

// Update the MaterialRequest interface to support multiple items
export interface MaterialRequest {
  id: string;
  sku: string;
  name: string;
  qty: number;
  plate: string;
  dept: string;
  priority: 'normal' | 'alta' | 'urgente';
  status: RequestStatus;
  timestamp: string;
  costCenter?: string;
  warehouseId?: string;
  items?: { sku: string; name: string; qty: number }[]; // Support for multiple items
}

interface OrderItem {
  sku: string;
  name: string;
  qty: number;
}

interface Order {
  id: string;
  customer: string;
  items: OrderItem[];
  status: 'pendente' | 'separacao' | 'enviado';
  carrier: string;
  priority: 'normal' | 'alta' | 'urgente';
}

interface ExpeditionProps {
  inventory: InventoryItem[];
  vehicles?: Vehicle[];
  canApproveRequests: boolean;
  onProcessPicking: (sku: string, qty: number, reason?: string, orderId?: string, warehouseId?: string) => Promise<boolean>;
  requests: MaterialRequest[];
  onRequestCreate: (data: MaterialRequest) => Promise<void>;
  onRequestUpdate: (id: string, status: RequestStatus) => Promise<void>;
  onRequestEdit?: (id: string, data: Partial<MaterialRequest>) => Promise<void>;
  onRequestDelete?: (id: string) => Promise<void>;
  activeWarehouse: string;
  currentPage: number;
  pageSize: number;
  hasNextPage: boolean;
  isPageLoading: boolean;
  onPageChange: (page: number) => void;
}

const INITIAL_ORDERS: Order[] = [];

export const Expedition: React.FC<ExpeditionProps> = ({
  inventory,
  vehicles = [],
  canApproveRequests,
  onProcessPicking,
  requests,
  onRequestCreate,
  onRequestUpdate,
  onRequestEdit,
  onRequestDelete,
  activeWarehouse,
  currentPage,
  pageSize,
  hasNextPage,
  isPageLoading,
  onPageChange,
}) => {
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  
  // Edit and Delete states
  const [editingRequest, setEditingRequest] = useState<MaterialRequest | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Edit form states
  const [editItems, setEditItems] = useState<{ sku: string; name: string; qty: number }[]>([]);
  const [editPlate, setEditPlate] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editCostCenter, setEditCostCenter] = useState('');
  const [editPriority, setEditPriority] = useState<'normal' | 'alta' | 'urgente'>('normal');
  const [editStatus, setEditStatus] = useState<RequestStatus>('aprovacao');
  const [isEditPlateSearchOpen, setIsEditPlateSearchOpen] = useState(false);
  const editPlateSearchRef = useRef<HTMLDivElement>(null);

  // Form States
  const [reqSku, setReqSku] = useState('');
  const [reqItemSearch, setReqItemSearch] = useState('');
  const [reqQty, setReqQty] = useState<number | string>(''); // Start empty
  const [reqDept, setReqDept] = useState('');
  const [reqPlate, setReqPlate] = useState('');
  const [reqCostCenter, setReqCostCenter] = useState('');
  const [reqPriority, setReqPriority] = useState<'normal' | 'alta' | 'urgente'>('normal');

  const [isPlateSearchOpen, setIsPlateSearchOpen] = useState(false);
  const plateSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (plateSearchRef.current && !plateSearchRef.current.contains(event.target as Node)) {
        setIsPlateSearchOpen(false);
      }
      if (editPlateSearchRef.current && !editPlateSearchRef.current.contains(event.target as Node)) {
        setIsEditPlateSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredVehicles = useMemo(() => {
    const search = reqPlate.toLowerCase().trim();
    if (!search || !isPlateSearchOpen) return [];
    return vehicles
      .filter(v => v.plate.toLowerCase().includes(search) || v.model.toLowerCase().includes(search))
      .slice(0, 5);
  }, [reqPlate, vehicles, isPlateSearchOpen]);

  const filteredInventoryItems = useMemo(() => {
    const term = reqItemSearch.toLowerCase().trim();
    if (!term) return inventory.slice(0, 250);
    return inventory
      .filter((item) =>
        item.sku.toLowerCase().includes(term) ||
        item.name.toLowerCase().includes(term)
      )
      .slice(0, 250);
  }, [reqItemSearch, inventory]);

  const getStockForSku = (sku: string) => {
    return inventory
      .filter(i => i.sku === sku)
      .reduce((acc, curr) => acc + curr.quantity, 0);
  };

  const selectedItemStock = reqSku ? getStockForSku(reqSku) : 0;
  const isInvalidRequest = Number(reqQty) > selectedItemStock || Number(reqQty) <= 0;

  const handleStartPicking = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    let allOk = true;
    for (const item of order.items) {
      const success = await onProcessPicking(
        item.sku,
        item.qty,
        `Saída para Expedição / Ordem ${orderId}`,
        orderId,
        activeWarehouse
      );
      if (!success) {
        allOk = false;
        break;
      }
    }

    if (allOk) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'enviado' } : o));
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isInvalidRequest) return;

    const newRequest: MaterialRequest = {
      id: `REQ-${Math.floor(Math.random() * 9000) + 1000}`,
      sku: reqSku,
      name: inventory.find(i => i.sku === reqSku)?.name || 'Produto',
      qty: Number(reqQty),
      plate: reqPlate.toUpperCase(),
      dept: reqDept,
      priority: reqPriority,
      status: 'aprovacao',
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      costCenter: reqCostCenter,
      warehouseId: activeWarehouse
    };

    await onRequestCreate(newRequest);
    setIsRequestModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setReqSku('');
    setReqItemSearch('');
    setReqQty('');
    setReqDept('');
    setReqPlate('');
    setReqCostCenter('');
    setReqPriority('normal');
  };

  const advanceWorkflow = async (requestId: string) => {
    try {
      const request = requests.find(r => r.id === requestId);
      if (!request) {
        console.error('Request not found:', requestId);
        alert('Erro: Solicitação não encontrada');
        return;
      }

      console.log('=== Advance Workflow ===');
      console.log('Request ID:', requestId);
      console.log('Current Status:', request.status);
      console.log('Request items:', request.items);
      console.log('Request SKU:', request.sku, 'QTY:', request.qty);

      if (request.status === 'aprovacao') {
        if (!canApproveRequests) {
          alert('Apenas administrador pode aprovar solicitações SA.');
          return;
        }
        console.log('Updating to separacao...');
        await onRequestUpdate(requestId, 'separacao');
        console.log('Updated to separacao successfully!');
      } else if (request.status === 'separacao') {
        // Processar todos os itens da solicitação
        const itemsToProcess = request.items && request.items.length > 0 
          ? request.items 
          : [{ sku: request.sku, name: request.name, qty: request.qty }];
        
        console.log('Items to process:', itemsToProcess);
        
        let allSuccess = true;
        
        for (const item of itemsToProcess) {
          if (!item.sku || item.qty <= 0) {
            console.log('Skipping invalid item:', item);
            continue;
          }
          
          console.log('Processing item:', item.sku, 'QTY:', item.qty);
          
          try {
            const success = await onProcessPicking(
              item.sku,
              item.qty,
              `Saída por Solicitação SA ${request.id} - Placa ${request.plate}`,
              request.id,
              request.warehouseId || activeWarehouse
            );
            
            console.log('Process result for', item.sku, ':', success);
            
            if (!success) {
              allSuccess = false;
              console.error(`Falha ao processar item ${item.sku}`);
            }
          } catch (pickingError) {
            console.error('Error processing picking for', item.sku, ':', pickingError);
            allSuccess = false;
          }
        }
        
        console.log('All success:', allSuccess);
        
        if (allSuccess) {
          console.log('Updating status to entregue...');
          try {
            await onRequestUpdate(requestId, 'entregue');
            console.log('Status updated to entregue successfully!');
          } catch (updateError) {
            console.error('Error updating status:', updateError);
            alert('Erro ao atualizar status: ' + (updateError?.message || 'Erro desconhecido'));
          }
        } else {
          alert('Erro ao processar alguns itens. Verifique o estoque disponível.');
        }
      }
    } catch (error) {
      console.error('=== Advance Workflow Error ===');
      console.error('Error:', error);
      console.error('Stack:', error?.stack);
      alert('Erro no workflow: ' + (error?.message || 'Erro desconhecido'));
    }
  };

  const handleDeleteRequest = async () => {
    if (!deleteConfirmId) return;
    
    if (!onRequestDelete) {
      alert('Função de exclusão não está disponível. Verifique se o componente pai forneceu a prop onRequestDelete.');
      setDeleteConfirmId(null);
      return;
    }
    
    try {
      await onRequestDelete(deleteConfirmId);
      setDeleteConfirmId(null);
      alert('Solicitação removida com sucesso!');
    } catch (error) {
      alert('Erro ao remover solicitação. Tente novamente.');
      console.error('Error deleting request:', error);
    }
  };

  // Open edit modal and initialize form states
  const openEditModal = (req: MaterialRequest) => {
    setEditingRequest(req);
    // Initialize items array - if req has items use them, otherwise create single item from legacy fields
    if (req.items && req.items.length > 0) {
      setEditItems([...req.items]);
    } else {
      setEditItems([{ sku: req.sku, name: req.name, qty: req.qty }]);
    }
    setEditPlate(req.plate);
    setEditDept(req.dept);
    setEditCostCenter(req.costCenter || '');
    setEditPriority(req.priority);
    setEditStatus(req.status);
  };

  // Save edited request
  const handleSaveEdit = async () => {
    if (!editingRequest) return;
    
    // Validate basic item data (sku and qty)
    const hasInvalidItems = editItems.some(item => !item.sku || item.qty <= 0);
    if (hasInvalidItems) {
      alert('Existem itens com dados inválidos. Selecione um produto e informe a quantidade.');
      return;
    }
    
    // Calculate total quantity from all items
    const totalQty = editItems.reduce((sum, item) => sum + item.qty, 0);
    
    // Update the request with edited data
    const updatedRequest: MaterialRequest = {
      ...editingRequest,
      items: editItems,
      sku: editItems[0]?.sku || '',
      name: editItems[0]?.name || '',
      qty: totalQty,
      plate: editPlate,
      dept: editDept,
      costCenter: editCostCenter,
      priority: editPriority,
      status: editStatus,
    };

    try {
      // Call onRequestEdit if provided to save the full request data
      console.log('Tentando salvar...', editingRequest.id, updatedRequest);
      console.log('onRequestEdit existe?', !!onRequestEdit);
      if (onRequestEdit) {
        await onRequestEdit(editingRequest.id, updatedRequest);
        console.log('Salvo com sucesso!');
      } else {
        console.warn('onRequestEdit não foi fornecido!');
        alert('Erro: Função de edição não disponível. Verifique se o componente pai forneceu a prop onRequestEdit.');
        return;
      }
      
      // Close the modal after successful save
      setEditingRequest(null);
      alert('Solicitação atualizada com sucesso!');
    } catch (error: any) {
      alert('Erro ao salvar alterações. Tente novamente. Detalhes: ' + (error?.message || 'Erro desconhecido'));
      console.error('Error saving request:', error);
    }
  };

  // Add new item to edit form
  const handleAddEditItem = () => {
    setEditItems([...editItems, { sku: '', name: '', qty: 1 }]);
  };

  // Remove item from edit form
  const handleRemoveEditItem = (index: number) => {
    setEditItems(editItems.filter((_, i) => i !== index));
  };

  // Update item in edit form
  const handleUpdateEditItem = (index: number, field: string, value: string | number) => {
    const newItems = [...editItems];
    if (field === 'sku') {
      const selectedItem = inventory.find(i => i.sku === value);
      newItems[index] = { 
        ...newItems[index], 
        sku: value, 
        name: selectedItem?.name || '' 
      };
    } else if (field === 'qty') {
      newItems[index] = { ...newItems[index], qty: Number(value) };
    }
    setEditItems(newItems);
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl lg:text-4xl font-black tracking-tighter text-slate-800 dark:text-white">Solicitações SA</h2>
          <p className="text-slate-500 text-sm font-medium">Gestão de picking e solicitações internas com workflow de aprovação.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsRequestModalOpen(true)}
            className="px-8 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 flex items-center gap-3 hover:bg-blue-600 transition-all active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <path d="M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z" />
              <path d="M15 14H9" />
              <path d="M12 11v6" />
            </svg>
            Nova Solicitação
          </button>
        </div>
      </div>

      {/* Seção de Workflow Interno */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 px-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="size-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3h12" />
            <path d="M6 8h12" />
            <path d="m6 13 2 2 4-4" />
            <path d="M6 18h12" />
          </svg>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Requisicoes em Fluxo Interno</h3>
        </div>

        <PaginationBar
          currentPage={currentPage}
          currentCount={requests.length}
          pageSize={pageSize}
          hasNextPage={hasNextPage}
          isLoading={isPageLoading}
        itemLabel="solicitações"
          onPageChange={onPageChange}
        />

        {requests.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {requests.map((req) => (
              <div key={req.id} className={`bg-white dark:bg-slate-900 rounded-[2rem] border-2 ${req.status === 'entregue' ? 'border-emerald-100 opacity-60' : 'border-slate-100'} p-6 shadow-sm transition-all`}>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-slate-800 dark:text-white">{req.id}</span>
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${req.priority === 'urgente' ? 'bg-red-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                        }`}>{req.priority}</span>
                    </div>
                    <p className="text-[10px] font-black text-primary uppercase tracking-wider">{req.dept} - PLACA: {req.plate}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(req)}
                      disabled={req.status !== 'aprovacao'}
                      className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      title={req.status !== 'aprovacao' ? 'Só é possível editar antes da aprovação' : 'Editar'}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(req.id)}
                      disabled={req.status === 'entregue'}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      title={req.status === 'entregue' ? 'Não é possível remover solicitações entregues' : 'Remover'}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-sm font-black text-slate-700 dark:text-slate-200 truncate">{req.name}</p>
                  <p className="text-xs font-bold text-slate-400 mt-1">{req.qty} un - {req.sku}</p>
                </div>

                {/* Workflow Stepper */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Progresso do Workflow</span>
                    <span className="text-[9px] font-black text-primary uppercase">{req.status}</span>
                  </div>
                  <div className="flex gap-1 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-500 ${req.status === 'aprovacao' ? 'w-1/3 bg-blue-400' : req.status === 'separacao' ? 'w-2/3 bg-amber-400' : 'w-full bg-emerald-500'}`}></div>
                  </div>

                  <div className="flex justify-between mt-6">
                    {req.status !== 'entregue' ? (
                      <button
                        onClick={() => { void advanceWorkflow(req.id); }}
                        disabled={req.status === 'aprovacao' && !canApproveRequests}
                        title={req.status === 'aprovacao' && !canApproveRequests ? 'Somente administrador pode aprovar solicitações SA.' : undefined}
                        className={`w-full py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${req.status === 'aprovacao' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                          }`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          {req.status === 'aprovacao' ? (
                            <>
                              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                              <path d="m9 12 2 2 4-4" />
                            </>
                          ) : (
                            <>
                              <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
                              <path d="M15 18H9" />
                              <path d="M19 18h2a1 1 0 0 0 1-1v-4.2c0-.3-.1-.6-.3-.8l-.7-.7c-.6-.6-1.6-1-2.4-1H15" />
                              <circle cx="7" cy="18" r="2" />
                              <circle cx="17" cy="18" r="2" />
                            </>
                          )}
                        </svg>
                        {req.status === 'aprovacao' ? 'Aprovar e Enviar p/ Separacao' : 'Confirmar Entrega e Baixar Estoque'}
                      </button>
                    ) : (
                      <div className="w-full py-3 bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                          <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        Fluxo Finalizado
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl px-6 py-16 text-center text-slate-400 text-xs font-black uppercase tracking-widest">
            {isPageLoading ? 'Carregando solicitações...' : 'Nenhuma solicitação registrada neste armazém.'}
          </div>
        )}
      </div>

      {/* Ordens de Saída Padrão */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 px-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="size-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 6h13" />
            <path d="M8 12h13" />
            <path d="M8 18h13" />
            <path d="M3 6h.01" />
            <path d="M3 12h.01" />
            <path d="M3 18h.01" />
          </svg>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Ordens de Saída de Clientes</h3>
        </div>
        <div className="grid grid-cols-1 gap-6">
          {orders.map((order) => (
            <div key={order.id} className={`bg-white dark:bg-slate-900 rounded-[2.5rem] border ${order.status === 'enviado' ? 'border-emerald-100 dark:border-emerald-900/30 opacity-75' : 'border-slate-200 dark:border-slate-800'} shadow-sm overflow-hidden transition-all`}>
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`size-12 rounded-2xl flex items-center justify-center ${order.status === 'enviado' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      {order.status === 'enviado' ? (
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      ) : (
                        <>
                          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                          <path d="m3.3 7 8.7 5 8.7-5" />
                          <path d="M12 22V12" />
                        </>
                      )}
                      {order.status === 'enviado' && <polyline points="22 4 12 14.01 9 11.01" />}
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">{order.id}</h3>
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${order.priority === 'urgente' ? 'bg-red-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}>
                        {order.priority}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-tighter">{order.customer} - Transp: {order.carrier}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {order.status === 'pendente' ? (
                    <button
                      onClick={() => { void handleStartPicking(order.id); }}
                      className="px-6 py-3 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:bg-blue-600 transition-all flex items-center gap-2 active:scale-95"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m9 11 3 3L22 4" />
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                      </svg>
                      Iniciar Separação
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 text-emerald-600 font-black text-[10px] uppercase tracking-widest bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
                      <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <path d="m9 12 2 2 4-4" />
                      </svg>
                      Carga Despachada
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 bg-slate-50/30 dark:bg-slate-800/20">
                <div className="space-y-3">
                  {order.items.map((item, idx) => {
                    const currentStock = getStockForSku(item.sku);
                    const isInsufficient = currentStock < item.qty && order.status !== 'enviado';

                    return (
                      <div key={idx} className={`flex items-center justify-between p-5 rounded-2xl border ${isInsufficient ? 'bg-red-50 border-red-100' : 'bg-white border-slate-100'
                        } dark:bg-slate-800 dark:border-slate-700 transition-all`}>
                        <div className="flex items-center gap-4">
                          <div className="size-10 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center text-[10px] font-black">
                            {idx + 1}
                          </div>
                          <div>
                            <p className="text-base font-black text-slate-800 dark:text-slate-200 leading-tight">{item.name}</p>
                            <p className="text-[10px] font-black text-primary uppercase mt-1">Cód. Produto: {item.sku}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-12 text-right">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-2 tracking-widest">Solicitado</p>
                            <p className="text-xl font-black">{item.qty} un.</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-2 tracking-widest">Disponível</p>
                            <p className={`text-xl font-black ${isInsufficient ? 'text-red-600' : 'text-slate-800 dark:text-slate-200'}`}>
                              {currentStock} un.
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal de Nova Solicitação */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black tracking-tight text-slate-800 dark:text-white">Requisição de Material</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Fluxo Interno CD Manaus</p>
              </div>
              <button onClick={() => setIsRequestModalOpen(false)} className="size-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-800 dark:text-white hover:text-red-500 transition-all font-black text-xl">
                ×
              </button>
            </div>

            <form onSubmit={handleSubmitRequest} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selecione o Item (Cód. Produto)</label>
                  <input
                    type="text"
                    value={reqItemSearch}
                    onChange={(e) => setReqItemSearch(e.target.value)}
                    placeholder="Digite o código ou nome do item..."
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 focus:border-primary focus:ring-0 rounded-2xl font-bold text-sm transition-all text-slate-800 dark:text-white"
                  />
                  <select
                    required
                    value={reqSku}
                    onChange={(e) => setReqSku(e.target.value)}
                    className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 focus:border-primary focus:ring-0 rounded-2xl font-black text-sm transition-all text-slate-800 dark:text-white"
                  >
                    <option value="">
                      {reqItemSearch ? `Resultados: ${filteredInventoryItems.length}` : 'Pesquisar no inventário...'}
                    </option>
                    {filteredInventoryItems.map(item => (
                      <option key={item.sku} value={item.sku}>{item.sku} - {item.name}</option>
                    ))}
                  </select>
                </div>
                {reqSku && (
                  <div className="flex items-center gap-2 mt-2 px-1">
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">
                      Estoque Disponível: <span className="text-sm">{selectedItemStock}</span> un.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantidade</label>
                    <input
                      required
                      type="number"
                      value={reqQty}
                      onChange={(e) => setReqQty(e.target.value)}
                      placeholder="0"
                      className={`w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 rounded-2xl font-black text-sm transition-all ${Number(reqQty) > selectedItemStock ? 'border-red-500 text-red-500' : 'border-slate-100 dark:border-slate-700'
                        }`}
                    />
                  </div>
                  <div className="space-y-2 relative" ref={plateSearchRef}>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Placa do Veículo / ID</label>
                    <input
                      required
                      placeholder="ABC-1234"
                      value={reqPlate}
                      onChange={(e) => {
                        setReqPlate(e.target.value);
                        setIsPlateSearchOpen(true);
                      }}
                      onFocus={() => setIsPlateSearchOpen(true)}
                      className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 focus:border-primary focus:ring-0 rounded-2xl font-black text-sm transition-all uppercase"
                    />
                    {isPlateSearchOpen && filteredVehicles.length > 0 && (
                      <div className="absolute z-[110] left-0 right-0 top-full mt-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                        <div className="p-2">
                          {filteredVehicles.map(v => (
                            <button
                              key={v.plate}
                              type="button"
                              onClick={() => {
                                setReqPlate(v.plate);
                                setReqCostCenter(v.costCenter || '');
                                setIsPlateSearchOpen(false);
                              }}
                              className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all text-left"
                            >
                              <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="1" y="3" width="15" height="13" />
                                  <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                                  <circle cx="5.5" cy="18.5" r="2.5" />
                                  <circle cx="18.5" cy="18.5" r="2.5" />
                                </svg>
                              </div>
                              <div>
                                <p className="text-xs font-black text-slate-800 dark:text-white uppercase">{v.plate}</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase">{v.model} - {v.costCenter}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Setor / Departamento Solicitante</label>
                    <input
                      required
                      placeholder="Ex: Manutenção Elétrica"
                      value={reqDept}
                      onChange={(e) => setReqDept(e.target.value)}
                      className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 focus:border-primary focus:ring-0 rounded-2xl font-black text-sm transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Centro de Custo</label>
                    <input
                      placeholder="Automático via Placa"
                      value={reqCostCenter}
                      onChange={(e) => setReqCostCenter(e.target.value)}
                      className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 focus:border-primary focus:ring-0 rounded-2xl font-black text-sm transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nível de Prioridade</label>
                  <div className="flex gap-2">
                    {(['normal', 'alta', 'urgente'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setReqPriority(p)}
                        className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border-2 transition-all ${reqPriority === p
                          ? (p === 'urgente' ? 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/20' : p === 'alta' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-primary border-primary text-white')
                          : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400'
                          }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="flex-1 py-5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isInvalidRequest || !reqSku || !reqPlate}
                  className="flex-[2] py-5 bg-primary text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50 active:scale-95"
                >
                  Confirmar e Iniciar Workflow
                </button>
              </div>
            </form>
          </div>
        </div >
      )}

      {/* Edit Modal */}
      {editingRequest && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-blue-50 dark:bg-blue-900/20">
              <div className="flex items-center gap-3">
                <div className="size-10 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="size-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-black tracking-tight text-slate-800 dark:text-white">Editar Solicitação</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{editingRequest.id}</p>
                </div>
              </div>
              <button onClick={() => setEditingRequest(null)} className="size-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-800 dark:text-white hover:text-red-500 transition-all font-black text-xl">
                ×
              </button>
            </div>
            
            <div className="p-6 space-y-6">
                <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Itens da Solicitação</label>
                  <button
                    onClick={handleAddEditItem}
                    disabled={!editItems.every(item => item.sku && item.qty > 0)}
                    className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    Adicionar Item
                  </button>
                </div>
                
                {editItems.map((item, index) => {
                  const stock = getStockForSku(item.sku);
                  const isInsufficient = item.sku && item.qty > stock;
                  return (
                  <div key={index} className={`flex gap-2 items-start p-3 rounded-xl border ${isInsufficient ? 'bg-red-50 border-red-300' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                    <div className="flex-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Produto (SKU)</label>
                      <select
                        value={item.sku}
                        onChange={(e) => handleUpdateEditItem(index, 'sku', e.target.value)}
                        className={`w-full px-3 py-2 bg-white dark:bg-slate-700 border rounded-lg font-bold text-sm ${isInsufficient ? 'border-red-300' : 'border-slate-200 dark:border-slate-600'}`}
                      >
                        <option value="">Selecione...</option>
                        {inventory.map(invItem => (
                          <option key={invItem.sku} value={invItem.sku}>{invItem.sku} - {invItem.name} (Estoque: {invItem.quantity})</option>
                        ))}
                      </select>
                      {isInsufficient && (
                        <p className="text-[9px] text-red-500 font-bold mt-1">Estoque insuficiente! Disponível: {stock} un</p>
                      )}
                    </div>
                    <div className="w-24">
                      <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Qtd</label>
                      <input
                        type="number"
                        value={item.qty}
                        onChange={(e) => handleUpdateEditItem(index, 'qty', e.target.value)}
                        className={`w-full px-3 py-2 bg-white dark:bg-slate-700 border rounded-lg font-bold text-sm text-center ${isInsufficient ? 'border-red-300 text-red-600' : 'border-slate-200 dark:border-slate-600'}`}
                        min="1"
                      />
                    </div>
                    {editItems.length > 1 && (
                      <button
                        onClick={() => handleRemoveEditItem(index)}
                        className="mt-6 p-2 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Remover item"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18" />
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                )})}
              </div>

              {/* Plate and Cost Center */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 relative" ref={editPlateSearchRef}>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Placa do Veículo</label>
                  <input
                    value={editPlate}
                    onChange={(e) => {
                      setEditPlate(e.target.value);
                      setIsEditPlateSearchOpen(true);
                    }}
                    onFocus={() => setIsEditPlateSearchOpen(true)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl font-black text-sm uppercase"
                  />
                  {isEditPlateSearchOpen && vehicles.filter(v => v.plate.toLowerCase().includes(editPlate.toLowerCase())).length > 0 && (
                    <div className="absolute z-[110] left-0 right-0 top-full mt-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden">
                      <div className="p-2">
                        {vehicles.filter(v => v.plate.toLowerCase().includes(editPlate.toLowerCase())).slice(0, 5).map(v => (
                          <button
                            key={v.plate}
                            type="button"
                            onClick={() => {
                              setEditPlate(v.plate);
                              setEditCostCenter(v.costCenter || '');
                              setIsEditPlateSearchOpen(false);
                            }}
                            className="w-full flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-all text-left"
                          >
                            <span className="text-xs font-black text-slate-800 dark:text-white uppercase">{v.plate}</span>
                            <span className="text-[10px] text-slate-400 font-bold">{v.model}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Centro de Custo</label>
                  <input
                    value={editCostCenter}
                    onChange={(e) => setEditCostCenter(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl font-black text-sm"
                  />
                </div>
              </div>

              {/* Department */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Departamento</label>
                <input
                  value={editDept}
                  onChange={(e) => setEditDept(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl font-black text-sm"
                />
              </div>

              {/* Priority and Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prioridade</label>
                  <div className="flex gap-2">
                    {(['normal', 'alta', 'urgente'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setEditPriority(p)}
                        className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border-2 transition-all ${editPriority === p
                          ? (p === 'urgente' ? 'bg-red-500 border-red-500 text-white' : p === 'alta' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-blue-500 border-blue-500 text-white')
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                          }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as RequestStatus)}
                    disabled={editingRequest?.status === 'aprovacao' && !canApproveRequests}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl font-black text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="aprovacao">Aprovação</option>
                    <option value="separacao">Separação</option>
                    <option value="entregue">Entregue</option>
                  </select>
                  {editingRequest?.status === 'aprovacao' && !canApproveRequests && (
                    <p className="text-[10px] font-bold text-amber-600">Somente administrador pode aprovar esta solicitação.</p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex gap-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setEditingRequest(null)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={!editItems.every(item => item.sku && item.qty > 0) || editItems.length === 0}
                  className="flex-[2] py-3 bg-blue-500 text-white rounded-xl text-sm font-black uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  Salvar Alterações
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/20">
              <div className="flex items-center gap-3">
                <div className="size-10 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="size-5 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-white">Confirmar Exclusão</h3>
                  <p className="text-sm text-slate-500">Esta ação não pode ser desfeita</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                Tem certeza que deseja remover a solicitação <strong>{deleteConfirmId}</strong>? Todos os dados serão perdidos.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-black hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteRequest}
                  className="flex-1 py-3 bg-red-500 text-white rounded-xl text-sm font-black hover:bg-red-600 transition-all"
                >
                  Sim, Remover
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div >
  );
};

