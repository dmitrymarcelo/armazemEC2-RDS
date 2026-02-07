
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { PurchaseOrder, Vendor, InventoryItem, Quote, User, PO_STATUS_LABELS, CyclicBatch, CyclicCount, Vehicle } from '../types';

interface PurchaseOrdersProps {
  user: User;
  orders: PurchaseOrder[];
  vendors: Vendor[];
  inventory: InventoryItem[];
  vehicles?: Vehicle[];
  onCreateOrder: (order: PurchaseOrder) => void;
  onAddQuotes: (poId: string, quotes: Quote[]) => void;
  onSendToApproval: (poId: string, selectedQuoteId: string) => void;
  onMarkAsSent: (poId: string, vendorOrderNumber: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string, reason?: string) => void;
}
const getStatusColor = (status: PurchaseOrder['status']) => {
  switch (status) {
    case 'requisicao': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'cotacao': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'pendente': return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'aprovado': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'enviado': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    case 'recebido': return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'cancelado': return 'bg-red-100 text-red-700 border-red-200';
    default: return 'bg-slate-100 text-slate-500 border-slate-200';
  }
};

const StatusProgressBar: React.FC<{ order: PurchaseOrder }> = ({ order }) => {
  const { status } = order;

  // Colored Illustrative SVGs
  const IconOrder = ({ active }: { active: boolean }) => (
    <div className={`p-2 rounded-2xl transition-all duration-500 ${active ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
      <svg xmlns="http://www.w3.org/2000/svg" className={`size-6 ${active ? 'text-amber-500' : 'text-slate-300'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    </div>
  );
  const IconPayment = ({ active }: { active: boolean }) => (
    <div className={`p-2 rounded-2xl transition-all duration-500 ${active ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
      <svg xmlns="http://www.w3.org/2000/svg" className={`size-6 ${active ? 'text-emerald-500' : 'text-slate-300'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
        <path d="M12 18V6" />
      </svg>
    </div>
  );
  const IconApprove = ({ active }: { active: boolean }) => (
    <div className={`p-2 rounded-2xl transition-all duration-500 ${active ? 'bg-indigo-100 dark:bg-indigo-900/30' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
      <svg xmlns="http://www.w3.org/2000/svg" className={`size-6 ${active ? 'text-indigo-500' : 'text-slate-300'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2c0 1.1.9 2 2 2h5v5c0 1.1.9 2 2 2h2c1.1 0 2-.9 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2h-2z" />
      </svg>
    </div>
  );
  const IconTransport = ({ active }: { active: boolean }) => (
    <div className={`p-2 rounded-2xl transition-all duration-500 ${active ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
      <svg xmlns="http://www.w3.org/2000/svg" className={`size-6 ${active ? 'text-blue-500' : 'text-slate-300'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 17h4V5H2v12h3" />
        <path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5" />
        <circle cx="7.5" cy="17.5" r="2.5" />
        <circle cx="17.5" cy="17.5" r="2.5" />
      </svg>
    </div>
  );
  const IconDelivered = ({ active }: { active: boolean }) => (
    <div className={`p-2 rounded-2xl transition-all duration-500 ${active ? 'bg-slate-100 dark:bg-slate-800/80' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
      <svg xmlns="http://www.w3.org/2000/svg" className={`size-6 ${active ? 'text-slate-700 dark:text-slate-300' : 'text-slate-300'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </svg>
    </div>
  );

  const steps = [
    { label: 'Pedido Realizado', icon: (a: boolean) => <IconOrder active={a} />, date: order.requestDate, status: 'requisicao' },
    { label: 'Cotação Realizada', icon: (a: boolean) => <IconPayment active={a} />, date: order.quotesAddedAt, status: 'cotacao' },
    { label: 'Aprovação Concluída', icon: (a: boolean) => <IconApprove active={a} />, date: order.approvedAt, status: 'aprovado' },
    { label: 'Pedido Enviado', icon: (a: boolean) => <IconTransport active={a} />, date: order.sentToVendorAt, status: 'enviado' },
    { label: 'Pedido Entregue', icon: (a: boolean) => <IconDelivered active={a} />, date: order.receivedAt, status: 'recebido' }
  ];

  // Injetar Rejeição se houver
  if (order.rejectedAt) {
    steps.splice(3, 0, { label: 'Pedido Rejeitado', icon: (a: boolean) => <IconApprove active={a} />, date: order.rejectedAt, status: 'cancelado' as any });
  }

  const currentStepIndex = steps.findIndex(s => s.status === status) === -1
    ? (status === 'cancelado' ? -1 : steps.length - 1)
    : steps.findIndex(s => s.status === status);

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return { date: '--/--/----', time: '--:--' };
    const parts = dateStr.split(', ');
    return {
      date: parts[0] || dateStr,
      time: parts[1] || '00:00'
    };
  };

  return (
    <div className="bg-white dark:bg-[#1a222c] p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 space-y-12">
      <h3 className="text-lg font-black text-[#0f172a] dark:text-white tracking-tight">Histórico de Status</h3>

      {/* Timeline Graphic */}
      <div className="relative pt-8 px-4">
        {/* Progress Line Segments */}
        <div className="absolute top-[4.75rem] left-8 right-8 h-1 flex">
          {Array.from({ length: steps.length - 1 }).map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-full transition-all duration-1000 ease-in-out ${i < currentStepIndex ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-slate-100 dark:bg-slate-800'}`}
            />
          ))}
        </div>

        <div className="flex justify-between relative z-10 items-end">
          {steps.map((step, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isActive = idx === currentStepIndex;
            const isFuture = idx > currentStepIndex;
            const { date } = formatDateTime(step.date);

            return (
              <div key={idx} className={`flex flex-col items-center text-center space-y-4 max-w-[120px] group transition-all duration-300 ${isActive ? 'scale-110' : 'hover:scale-105'}`}>
                {/* Descriptive Colored Icon */}
                <div className={`mb-2 transform transition-all duration-500 ${isActive ? 'translate-y-[-8px]' : ''}`}>
                  {step.icon(isCompleted || isActive)}
                </div>

                {/* Node with Interaction */}
                <div className={`relative flex items-center justify-center transition-all duration-500`}>
                  {/* Step Node */}
                  <div className={`size-8 rounded-full border-4 border-white dark:border-[#1a222c] shadow-lg flex items-center justify-center transition-all duration-500 z-20 ${isCompleted ? 'bg-blue-500' :
                    isActive ? 'bg-white dark:bg-slate-900 border-blue-500 ring-4 ring-blue-500/20' :
                      'bg-slate-200 dark:bg-slate-700'
                    }`}>
                    {isCompleted ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17 4 12" />
                      </svg>
                    ) : isActive ? (
                      <div className="size-2.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_12px_rgba(59,130,246,0.8)]" />
                    ) : null}
                  </div>

                  {/* Ripple Effect for Active Step */}
                  {isActive && (
                    <div className="absolute inset-0 size-8 bg-blue-500 rounded-full animate-ping opacity-20 z-10" />
                  )}
                </div>

                <div className="space-y-1">
                  <p className={`text-[10px] font-black uppercase tracking-tight transition-colors duration-300 ${isActive ? 'text-blue-600 dark:text-blue-400' :
                    isCompleted ? 'text-[#0f172a] dark:text-white' :
                      'text-slate-400'
                    }`}>
                    {step.label}
                  </p>
                  <p className={`text-[9px] font-bold transition-colors duration-300 ${isActive ? 'text-blue-500/80' : 'text-slate-500'}`}>
                    {step.date ? date : (isActive ? 'Em Andamento' : 'Pendente')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Package Info Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-t border-slate-100 dark:border-slate-800 pt-8 gap-6">
        <div className="space-y-4">
          <div className="space-y-1">
            <h4 className="text-sm font-black text-[#0f172a] dark:text-white uppercase tracking-wider">Pedido</h4>
            <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
              Entrega até <span className="text-[#0f172a] dark:text-primary">
                {order.selectedQuoteId && order.quotes?.find(q => q.id === order.selectedQuoteId)?.validUntil
                  ? formatDateTime(order.quotes?.find(q => q.id === order.selectedQuoteId)?.validUntil).date
                  : formatDateTime(order.receivedAt || order.sentToVendorAt).date}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-slate-500">Método de envio:</span>
            <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-[#0f172a] dark:text-white text-[10px] font-black rounded-lg border border-slate-200 dark:border-slate-700">1.Convencional</span>
          </div>
        </div>

        <button className="flex items-center gap-2 group text-[#0f172a] dark:text-primary transition-all hover:translate-x-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span className="text-[10px] font-black uppercase tracking-widest underline underline-offset-4">Visualizar Nota Fiscal Eletrônica</span>
        </button>
      </div>

      {/* Detailed Log Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 dark:bg-slate-800/50">
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800">Data</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800">Hora</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {/* Log de Aprovação/Rejeição do Histórico */}
            {(order.approvalHistory || []).slice().reverse().map((log, lidx) => {
              const { date, time } = formatDateTime(log.at);
              return (
                <tr key={`log-${lidx}`} className={log.action === 'rejected' ? "bg-red-50/30 dark:bg-red-900/10" : "bg-emerald-50/30 dark:bg-emerald-900/10"}>
                  <td className={`px-6 py-4 text-[11px] font-bold ${log.action === 'rejected' ? 'text-red-600' : 'text-emerald-600'}`}>{date}</td>
                  <td className={`px-6 py-4 text-[11px] font-bold ${log.action === 'rejected' ? 'text-red-600' : 'text-emerald-600'}`}>{time}</td>
                  <td className={`px-6 py-4 text-[11px] font-black uppercase ${log.action === 'rejected' ? 'text-red-600' : 'text-emerald-600'} tracking-widest`}>
                    {log.action === 'rejected' ? `REJEITADO: ${log.reason}` : 'APROVADO POR GESTOR'}
                  </td>
                </tr>
              );
            })}

            {steps.filter(s => s.date && s.label !== 'Pedido Rejeitado').reverse().map((step, idx) => {
              const { date, time } = formatDateTime(step.date);
              let statusDesc = "";
              switch (step.status) {
                case 'requisicao': statusDesc = "Pedido criado via painel LogiWMS"; break;
                case 'cotacao': statusDesc = "Cotação de fornecedores vinculada"; break;
                case 'aprovado': statusDesc = "Aprovação financeira e operacional concluída"; break;
                case 'enviado': statusDesc = "Produto em trânsito para a unidade"; break;
                case 'recebido': statusDesc = "Entrega realizada normalmente"; break;
              }

              return (
                <tr key={idx} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 text-[11px] font-bold text-slate-700 dark:text-slate-300 tracking-tight">{date}</td>
                  <td className="px-6 py-4 text-[11px] font-bold text-slate-700 dark:text-slate-300 tracking-tight">{time}</td>
                  <td className="px-6 py-4 text-[11px] font-medium text-slate-600 dark:text-slate-400">{statusDesc}</td>
                </tr>
              );
            })}
            {status === 'cancelado' && !order.rejectedAt && (
              <tr className="bg-red-50/30 dark:bg-red-900/10">
                <td className="px-6 py-4 text-[11px] font-bold text-red-600">--/--/----</td>
                <td className="px-6 py-4 text-[11px] font-bold text-red-600">--:--</td>
                <td className="px-6 py-4 text-[11px] font-black uppercase text-red-600 tracking-widest">Pedido Rejeitado/Cancelado</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};


// Helper to normalize strings for comparison (remove dots, dashes, etc)
const normalize = (val: string) => (val || '').replace(/\D/g, '');

export const PurchaseOrders: React.FC<PurchaseOrdersProps> = ({
  user,
  orders,
  vendors,
  inventory,
  vehicles = [],
  onCreateOrder,
  onAddQuotes,
  onSendToApproval,
  onMarkAsSent,
  onApprove,
  onReject
}) => {
  const [viewingOrder, setViewingOrder] = useState<PurchaseOrder | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isQuotationModalOpen, setIsQuotationModalOpen] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [quotingPO, setQuotingPO] = useState<PurchaseOrder | null>(null);
  const [sendingPO, setSendingPO] = useState<PurchaseOrder | null>(null);
  const [vendorOrderNum, setVendorOrderNum] = useState('');
  const [quotationMode, setQuotationMode] = useState<'edit' | 'analyze'>('edit');

  // Form State
  const [plate, setPlate] = useState('');
  const [costCenter, setCostCenter] = useState('');
  const [isPlateSearchOpen, setIsPlateSearchOpen] = useState(false);
  const plateSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (plateSearchRef.current && !plateSearchRef.current.contains(event.target as Node)) {
        setIsPlateSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredVehicles = useMemo(() => {
    const search = plate.toLowerCase().trim();
    if (!search || !isPlateSearchOpen) return [];
    return vehicles
      .filter(v => (v.plate || '').toLowerCase().includes(search) || (v.model || '').toLowerCase().includes(search))
      .slice(0, 5);
  }, [plate, vehicles, isPlateSearchOpen]);

  // Form State
  // Rejection Modal State
  const [rejectionOrderId, setRejectionOrderId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  // Form State
  const [selectedVendor, setSelectedVendor] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgente'>('normal');
  const [itemsList, setItemsList] = useState<{ sku: string; name: string; qty: number; price: number }[]>([]);

  // Quotation Form State
  const [quote1Vendor, setQuote1Vendor] = useState('');
  const [quote1Price, setQuote1Price] = useState('');
  const [quote1Notes, setQuote1Notes] = useState('');
  const [quote1Valid, setQuote1Valid] = useState('');
  const [quote1Search, setQuote1Search] = useState('');
  const [isQuote1SearchOpen, setIsQuote1SearchOpen] = useState(false);

  const [quote2Vendor, setQuote2Vendor] = useState('');
  const [quote2Price, setQuote2Price] = useState('');
  const [quote2Notes, setQuote2Notes] = useState('');
  const [quote2Valid, setQuote2Valid] = useState('');
  const [quote2Search, setQuote2Search] = useState('');
  const [isQuote2SearchOpen, setIsQuote2SearchOpen] = useState(false);

  const [quote3Vendor, setQuote3Vendor] = useState('');
  const [quote3Price, setQuote3Price] = useState('');
  const [quote3Notes, setQuote3Notes] = useState('');
  const [quote3Valid, setQuote3Valid] = useState('');
  const [quote3Search, setQuote3Search] = useState('');
  const [isQuote3SearchOpen, setIsQuote3SearchOpen] = useState(false);

  const [selectedQuoteId, setSelectedQuoteId] = useState('');

  // Single Item Draft
  const [draftSku, setDraftSku] = useState('');
  const [draftQty, setDraftQty] = useState(0);
  const [draftPrice, setDraftPrice] = useState(0);
  const [itemSearch, setItemSearch] = useState('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const quote1SearchRef = useRef<HTMLDivElement>(null);
  const quote2SearchRef = useRef<HTMLDivElement>(null);
  const quote3SearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchDropdownOpen(false);
      }
      if (quote1SearchRef.current && !quote1SearchRef.current.contains(event.target as Node)) {
        setIsQuote1SearchOpen(false);
      }
      if (quote2SearchRef.current && !quote2SearchRef.current.contains(event.target as Node)) {
        setIsQuote2SearchOpen(false);
      }
      if (quote3SearchRef.current && !quote3SearchRef.current.contains(event.target as Node)) {
        setIsQuote3SearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get selected product details for preview (Header of Sub-Form)
  const selectedProductPreview = useMemo(() => {
    return inventory.find(p => p.sku === draftSku);
  }, [draftSku, inventory]);

  const filteredSearchItems = useMemo(() => {
    const search = itemSearch.toLowerCase().trim();
    if (!search) return [];
    return inventory
      .filter(i => (i.sku || '').toLowerCase().includes(search) || (i.name || '').toLowerCase().includes(search))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [itemSearch, inventory]);

  const totalOrder = useMemo(() => itemsList.reduce((acc, curr) => acc + (curr.qty * curr.price), 0), [itemsList]);

  const handleAddItem = () => {
    if (!draftSku || draftQty <= 0) return;
    const prod = inventory.find(p => p.sku === draftSku);
    if (!prod) return;

    setItemsList(prev => [...prev, {
      sku: prod.sku,
      name: prod.name,
      qty: draftQty,
      price: 0
    }]);

    setDraftSku('');
    setDraftQty(0);
    setDraftPrice(0);
    setItemSearch('');
  };

  const handleFinalize = () => {
    if (itemsList.length === 0) return;

    const newPO: PurchaseOrder = {
      id: `PO-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`,
      vendor: 'A definir via cotações',
      requestDate: new Date().toLocaleDateString('pt-BR'),
      status: 'requisicao',
      priority,
      total: 0,
      requester: 'Ricardo Souza (Manual)',
      plate: plate.toUpperCase(),
      costCenter: costCenter,
      warehouseId: user.allowedWarehouses[0] || 'default', // NOVO: Armazém padrão do usuário
      items: itemsList.map(item => ({ ...item, price: 0 }))
    };

    onCreateOrder(newPO);
    setIsCreateModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setSelectedVendor('');
    setPriority('normal');
    setItemsList([]);
    setPlate('');
    setCostCenter('');
  };

  const getStatusColor = (status: PurchaseOrder['status']) => {
    switch (status) {
      case 'requisicao': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'cotacao': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'pendente': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'aprovado': return 'bg-green-100 text-green-700 border-green-200';
      case 'enviado': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'recebido': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'cancelado': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  const handleOpenQuotationModal = (order: PurchaseOrder) => {
    setQuotingPO(order);
    setQuotationMode('edit');

    // Pre-fill existing quotes (Safe checks)
    if (order.quotes) {
      if (order.quotes[0]) {
        setQuote1Vendor(order.quotes[0].vendorId);
        setQuote1Search(order.quotes[0].vendorName || '');
        setQuote1Price(order.quotes[0].totalValue.toString());
        setQuote1Notes(order.quotes[0].notes || '');
        setQuote1Valid(order.quotes[0].validUntil);
      }
      if (order.quotes[1]) {
        setQuote2Vendor(order.quotes[1].vendorId);
        setQuote2Search(order.quotes[1].vendorName || '');
        setQuote2Price(order.quotes[1].totalValue.toString());
        setQuote2Notes(order.quotes[1].notes || '');
        setQuote2Valid(order.quotes[1].validUntil);
      }
      if (order.quotes[2]) {
        setQuote3Vendor(order.quotes[2].vendorId);
        setQuote3Search(order.quotes[2].vendorName || '');
        setQuote3Price(order.quotes[2].totalValue.toString());
        setQuote3Notes(order.quotes[2].notes || '');
        setQuote3Valid(order.quotes[2].validUntil);
      }
    }

    setIsQuotationModalOpen(true);
  };

  const handleOpenAnalyzeQuotation = (order: PurchaseOrder) => {
    setQuotingPO(order);
    setQuotationMode('analyze');

    // Pre-fill existing quotes
    if (order.quotes) {
      if (order.quotes[0]) {
        setQuote1Vendor(order.quotes[0].vendorId);
        setQuote1Search(order.quotes[0].vendorName || '');
        setQuote1Price(order.quotes[0].totalValue.toString());
        setQuote1Notes(order.quotes[0].notes || '');
        setQuote1Valid(order.quotes[0].validUntil);
      }
      if (order.quotes[1]) {
        setQuote2Vendor(order.quotes[1].vendorId);
        setQuote2Search(order.quotes[1].vendorName || '');
        setQuote2Price(order.quotes[1].totalValue.toString());
        setQuote2Notes(order.quotes[1].notes || '');
        setQuote2Valid(order.quotes[1].validUntil);
      }
      if (order.quotes[2]) {
        setQuote3Vendor(order.quotes[2].vendorId);
        setQuote3Search(order.quotes[2].vendorName || '');
        setQuote3Price(order.quotes[2].totalValue.toString());
        setQuote3Notes(order.quotes[2].notes || '');
        setQuote3Valid(order.quotes[2].validUntil);
      }
    }

    setIsQuotationModalOpen(true);
  };

  const handleSubmitQuotations = () => {
    if (!quotingPO) return;

    // Verificar se pelo menos uma cotação foi preenchida (Vendor + Price)
    const quote1Valid = quote1Vendor && quote1Price;
    const quote2Valid = quote2Vendor && quote2Price;
    const quote3Valid = quote3Vendor && quote3Price;

    if (!quote1Valid && !quote2Valid && !quote3Valid) {
      alert('Por favor, preencha pelo menos 1 cotação (Fornecedor e Valor)');
      return;
    }

    // Validar fornecedores diferentes (apenas entre os preenchidos)
    const filledVendorIds = [quote1Vendor, quote2Vendor, quote3Vendor].filter(Boolean);
    const uniqueVendors = new Set(filledVendorIds);
    if (filledVendorIds.length !== uniqueVendors.size) {
      alert('Os fornecedores devem ser diferentes!');
      return;
    }

    const quotes: Quote[] = [];

    if (quote1Valid) {
      quotes.push({
        id: `Q1-${Date.now()}`,
        vendorId: quote1Vendor,
        vendorName: vendors.find(v => v.id === quote1Vendor)?.name || '',
        items: quotingPO.items.map(item => ({ sku: item.sku, unitPrice: parseFloat(quote1Price) / quotingPO.items.reduce((sum, i) => sum + i.qty, 0), leadTime: quote1Valid ? '7 dias' : '' })),
        totalValue: parseFloat(quote1Price),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
        notes: quote1Notes,
        quotedBy: 'Comprador',
        quotedAt: new Date().toLocaleString('pt-BR'),
        isSelected: false
      });
    }

    if (quote2Valid) {
      quotes.push({
        id: `Q2-${Date.now() + 1}`,
        vendorId: quote2Vendor,
        vendorName: vendors.find(v => v.id === quote2Vendor)?.name || '',
        items: quotingPO.items.map(item => ({ sku: item.sku, unitPrice: parseFloat(quote2Price) / quotingPO.items.reduce((sum, i) => sum + i.qty, 0), leadTime: quote2Valid ? '7 dias' : '' })),
        totalValue: parseFloat(quote2Price),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
        notes: quote2Notes,
        quotedBy: 'Comprador',
        quotedAt: new Date().toLocaleString('pt-BR'),
        isSelected: false
      });
    }

    if (quote3Valid) {
      quotes.push({
        id: `Q3-${Date.now() + 2}`,
        vendorId: quote3Vendor,
        vendorName: vendors.find(v => v.id === quote3Vendor)?.name || '',
        items: quotingPO.items.map(item => ({ sku: item.sku, unitPrice: parseFloat(quote3Price) / quotingPO.items.reduce((sum, i) => sum + i.qty, 0), leadTime: quote3Valid ? '7 dias' : '' })),
        totalValue: parseFloat(quote3Price),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
        notes: quote3Notes,
        quotedBy: 'Comprador',
        quotedAt: new Date().toLocaleString('pt-BR'),
        isSelected: false
      });
    }

    // Fix vendor names
    // Note: I cannot access 'vendors' prop arrays easily inside this function without more context of 'vendors' variable scope. 
    // Assuming 'vendors' is available in scope as per previous view_file.

    onAddQuotes(quotingPO.id, quotes);
    setIsQuotationModalOpen(false);
    resetQuotationForm();
  };

  const resetQuotationForm = () => {
    setQuote1Vendor('');
    setQuote1Search('');
    setQuote1Price('');
    setQuote1Notes('');
    setQuote1Valid('');
    setQuote2Vendor('');
    setQuote2Search('');
    setQuote2Price('');
    setQuote2Notes('');
    setQuote2Valid('');
    setQuote3Vendor('');
    setQuote3Search('');
    setQuote3Price('');
    setQuote3Notes('');
    setQuote3Valid('');
    setSelectedQuoteId('');
  };

  const handleSendQuotationToApproval = (order: PurchaseOrder) => {
    if (!order.quotes || order.quotes.length < 1) {
      alert('Adicione pelo menos 1 cotação antes de enviar para aprovação');
      return;
    }

    // Auto-select the quote with the lowest total value
    const bestQuote = order.quotes.reduce((prev, curr) =>
      curr.totalValue < prev.totalValue ? curr : prev
    );

    onSendToApproval(order.id, bestQuote.id);
  };

  const handleOpenSendModal = (order: PurchaseOrder) => {
    setSendingPO(order);
    setIsSendModalOpen(true);
  };

  const handleConfirmSend = () => {
    if (!sendingPO || !vendorOrderNum.trim()) {
      alert('Informe o número do pedido do fornecedor');
      return;
    }

    onMarkAsSent(sendingPO.id, vendorOrderNum);
    setIsSendModalOpen(false);
    setVendorOrderNum('');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-black tracking-tight text-slate-800 dark:text-white">Pedidos de Compra</h2>
          <p className="text-slate-500 text-sm font-medium">Gestão de reposições automáticas e requisições manuais.</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-8 py-3.5 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/25 hover:bg-blue-600 transition-all active:scale-95 flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="21" r="1" />
            <circle cx="19" cy="21" r="1" />
            <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
            <line x1="12" y1="5" x2="12" y2="11" />
            <line x1="9" y1="8" x2="15" y2="8" />
          </svg>
          Nova Requisição Manual
        </button>
      </div>



      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-8 py-6">ID Pedido</th>
                <th className="px-8 py-6">Produto / Cód. Produto</th>
                <th className="px-8 py-6">Fornecedor / Origem</th>
                <th className="px-8 py-6 text-center">Status</th>
                <th className="px-8 py-6 text-center">Prioridade</th>
                <th className="px-8 py-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {orders.length > 0 ? orders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors group">
                  <td className="px-8 py-5">
                    <span className="font-black text-sm text-slate-800 dark:text-white">{order.id}</span>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{order.requestDate}</p>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col max-w-[200px]">
                      <span className="text-sm font-black text-slate-800 dark:text-white truncate" title={order.items[0]?.name}>{order.items[0]?.name || 'N/A'}</span>
                      <span className="text-[10px] text-primary font-black uppercase tracking-tight">Cód. Produto: {order.items[0]?.sku || '---'}</span>
                      {order.items.length > 1 && (
                        <span className="text-[9px] font-black text-slate-400 mt-1 uppercase tracking-widest">+ {order.items.length - 1} outros</span>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-sm font-black text-slate-800 dark:text-white">{order.vendor}</p>
                    <p className="text-[10px] text-primary font-black uppercase tracking-tight">
                      {order.requester || 'Solicitação Manual'}
                    </p>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusColor(order.status)}`}>
                      {PO_STATUS_LABELS[order.status]}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded ${order.priority === 'urgente' ? 'bg-red-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}>
                      {order.priority.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setViewingOrder(order)}
                        className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-white rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-all active:scale-95"
                      >
                        Visualizar
                      </button>

                      {/* Botão Adicionar Cotações - apenas para status requisicao */}
                      {order.status === 'requisicao' && (
                        <button
                          onClick={() => handleOpenQuotationModal(order)}
                          className="px-4 py-2 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-600 transition-all active:scale-95"
                        >
                          Adicionar Cotações
                        </button>
                      )}

                      {/* Botão Enviar para Aprovação - apenas para status cotacao */}
                      {order.status === 'cotacao' && (
                        <button
                          onClick={() => handleSendQuotationToApproval(order)}
                          className="px-4 py-2 bg-purple-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-600 transition-all active:scale-95"
                        >
                          Enviar p/ Aprovação
                        </button>
                      )}

                      {/* Botões de Aprovação/Rejeição - apenas para status pendente e ADMIN */}
                      {order.status === 'pendente' && user.role === 'admin' && (
                        <>
                          <button
                            onClick={() => setRejectionOrderId(order.id)}
                            className="px-4 py-2 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-all active:scale-95"
                          >
                            Rejeitar
                          </button>
                          <button
                            onClick={() => handleOpenAnalyzeQuotation(order)}
                            className="px-4 py-2 bg-green-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-600 transition-all active:scale-95"
                          >
                            Analisar e Aprovar
                          </button>
                        </>
                      )}

                      {/* Botão Marcar como Enviado - apenas para status aprovado */}
                      {order.status === 'aprovado' && (
                        <button
                          onClick={() => handleOpenSendModal(order)}
                          className="px-4 py-2 bg-green-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-600 transition-all active:scale-95"
                        >
                          Marcar como Enviado
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center text-slate-400 font-black uppercase text-xs tracking-widest">
                    Nenhum pedido de compra registrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Criação Manual */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500 border border-slate-100 dark:border-slate-800">
            <div className="p-10 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Nova Requisição de Compra</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Geração de Ordem Manual para Fornecedores</p>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="size-12 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-400 hover:text-red-500 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="p-10 grid grid-cols-1 lg:grid-cols-12 gap-10 max-h-[70vh] overflow-y-auto">
              {/* Coluna Dados Mestre do Pedido */}
              <div className="lg:col-span-4 space-y-6">
                <div className="space-y-2 pb-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Fluxo de Requisição</p>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
                    <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 leading-tight">
                      A seleção de Fornecedor e Preço será realizada na etapa de **Cotação de Mercado**.
                    </p>
                  </div>
                </div>
                <div className="space-y-2 relative" ref={plateSearchRef}>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Placa do Veículo / ID</label>
                  <input
                    type="text"
                    placeholder="ABC-1234"
                    value={plate}
                    onChange={(e) => {
                      setPlate(e.target.value);
                      setIsPlateSearchOpen(true);
                    }}
                    onFocus={() => setIsPlateSearchOpen(true)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl text-sm font-black focus:border-primary transition-all uppercase"
                  />
                  {isPlateSearchOpen && filteredVehicles.length > 0 && (
                    <div className="absolute z-[110] left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1">
                      <div className="p-2">
                        {filteredVehicles.map(v => (
                          <button
                            key={v.plate}
                            type="button"
                            onClick={() => {
                              console.log('🚗 Veículo selecionado:', v.plate, 'Centro de Custo:', v.costCenter);
                              setPlate(v.plate);
                              setCostCenter(v.costCenter || '');
                              setIsPlateSearchOpen(false);
                            }}
                            className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all text-left"
                          >
                            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                              <span className="material-symbols-outlined text-sm">local_shipping</span>
                            </div>
                            <div>
                              <p className="text-xs font-black text-slate-800 dark:text-white uppercase">{v.plate}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">{v.model} • {v.costCenter}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Centro de Custo</label>
                  <input
                    type="text"
                    placeholder="Auto via Placa"
                    value={costCenter}
                    onChange={(e) => setCostCenter(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl text-sm font-black focus:border-primary transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Prioridade</label>
                  <div className="flex gap-2">
                    {(['normal', 'urgente'] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => setPriority(p)}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${priority === p ? 'bg-primary border-primary text-white' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400'
                          }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-8 bg-slate-900 text-white rounded-[2rem] space-y-4 shadow-xl">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total da Requisição</p>
                  <div>
                    <p className="text-4xl font-black tracking-tighter">R$ {totalOrder.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase mt-2">Baseado nos itens adicionados abaixo</p>
                  </div>
                </div>
              </div>

              {/* Coluna Sub-Form de Itens */}
              <div className="lg:col-span-8 space-y-8">
                {/* Cabeçalho do Sub-Form: Preview do Produto */}
                <div className="bg-slate-50 dark:bg-slate-800/30 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 relative">
                  <div className="flex items-center justify-between mb-6">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Área de Inserção de Itens</p>
                    {selectedProductPreview && (
                      <span className="px-3 py-1 bg-emerald-500 text-white text-[9px] font-black rounded-lg uppercase tracking-widest animate-in slide-in-from-right duration-300">Item Selecionado</span>
                    )}
                  </div>

                  {/* HEADER DO FORMULÁRIO COM DESCRIÇÃO DO PRODUTO SELECIONADO */}
                  {selectedProductPreview ? (
                    <div className="mb-8 flex items-center gap-6 p-6 bg-white dark:bg-slate-900 rounded-3xl border border-primary/20 shadow-lg animate-in fade-in zoom-in-95 duration-300">
                      <div className="size-24 rounded-2xl overflow-hidden border-2 border-slate-50 dark:border-slate-800 flex-shrink-0 shadow-sm">
                        <img src={selectedProductPreview.imageUrl} className="w-full h-full object-cover" alt={selectedProductPreview.name} />
                      </div>
                      <div className="flex-1">
                        <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mb-1">Ficha Técnica do Ativo</p>
                        <h4 className="text-xl font-black text-slate-800 dark:text-white leading-tight mb-2">{selectedProductPreview.name}</h4>
                        <div className="flex flex-wrap gap-4">
                          <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase">
                            <svg xmlns="http://www.w3.org/2000/svg" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="m7.5 4.27 9 5.15" />
                              <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                              <path d="m3.3 7 8.7 5 8.7-5" />
                              <path d="M12 22V12" />
                            </svg>
                            {selectedProductPreview.category}
                          </span>
                          <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase">
                            <svg xmlns="http://www.w3.org/2000/svg" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                              <polyline points="7.5 4.21 12 6.81 16.5 4.21" />
                              <polyline points="7.5 19.79 7.5 14.6 3 12" />
                              <polyline points="21 12 16.5 14.6 16.5 19.79" />
                              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                              <line x1="12" y1="22.08" x2="12" y2="12" />
                            </svg>
                            Saldo: {selectedProductPreview.quantity} un.
                          </span>
                        </div>
                        {selectedProductPreview.quantity > 0 && (
                          <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
                            <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                              <line x1="12" y1="9" x2="12" y2="13" />
                              <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                            <p className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-tight">
                              Temos em estoque o item {selectedProductPreview.name} com {selectedProductPreview.quantity} unidades.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mb-8 p-10 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl flex flex-col items-center justify-center text-center opacity-40">
                      <svg xmlns="http://www.w3.org/2000/svg" className="size-10 mb-2 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.3-4.3" />
                        <path d="M11 8a3 3 0 0 0-3 3" />
                      </svg>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aguardando seleção de Cód. Produto no catálogo</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-8 relative" ref={searchRef}>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Produto / Cód. Produto</label>
                      <div className="relative group">
                        <input
                          type="text"
                          value={draftSku ? `${draftSku} - ${selectedProductPreview?.name}` : itemSearch}
                          onChange={(e) => {
                            setItemSearch(e.target.value);
                            if (draftSku) setDraftSku('');
                            setIsSearchDropdownOpen(true);
                          }}
                          onFocus={() => setIsSearchDropdownOpen(true)}
                          placeholder="Buscar Produto no Catálogo Master..."
                          className="w-full px-4 py-4 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-black focus:border-primary transition-all pr-12"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                          <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                          </svg>
                        </div>

                        {/* Dropdown de Autocomplete */}
                        {isSearchDropdownOpen && itemSearch && !draftSku && (
                          <div className="absolute z-[110] left-0 right-0 top-full mt-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                            {filteredSearchItems.length > 0 ? (
                              <div className="p-2">
                                {filteredSearchItems.map(item => (
                                  <button
                                    key={item.sku}
                                    onClick={() => {
                                      setDraftSku(item.sku);
                                      setItemSearch(item.name);
                                      setIsSearchDropdownOpen(false);
                                    }}
                                    className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all text-left group"
                                  >
                                    <div className="size-10 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0 border border-slate-50 dark:border-slate-700">
                                      <img src={item.imageUrl} className="w-full h-full object-cover" alt="" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-black text-slate-800 dark:text-white truncate">{item.name}</p>
                                      <p className="text-[10px] font-black text-primary uppercase tracking-widest mt-0.5">Cód. {item.sku}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-[10px] font-black text-slate-400 uppercase">Saldo</p>
                                      <p className="text-xs font-black text-slate-800 dark:text-white">{item.quantity} un.</p>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="p-8 text-center text-slate-400">
                                <p className="text-[10px] font-black uppercase tracking-widest">Nenhum produto encontrado</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Qtd</label>
                      <input type="number" placeholder="Qtd" value={draftQty || ''} onChange={e => setDraftQty(Number(e.target.value))} className="w-full px-4 py-4 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-black focus:border-primary transition-all" />
                    </div>
                    <div className="md:col-span-2 flex items-end">
                      <button onClick={handleAddItem} disabled={!draftSku || draftQty <= 0} className="w-full h-full bg-slate-900 dark:bg-primary text-white rounded-2xl flex items-center justify-center hover:opacity-90 active:scale-95 transition-all disabled:opacity-30">
                        <svg xmlns="http://www.w3.org/2000/svg" className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="8" cy="21" r="1" />
                          <circle cx="19" cy="21" r="1" />
                          <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
                          <line x1="12" y1="5" x2="12" y2="11" />
                          <line x1="9" y1="8" x2="15" y2="8" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Listagem de Itens Adicionados */}
                <div className="space-y-4">
                  <div className="px-8 py-3 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span className="flex-1">Produto / Cód. Produto Identificado</span>
                    <span className="w-32 text-center">Preço Un.</span>
                    <span className="w-32 text-right">Subtotal Bruto</span>
                  </div>

                  <div className="space-y-3">
                    {itemsList.map((item, idx) => {
                      const itemImg = inventory.find(inv => inv.sku === item.sku)?.imageUrl;
                      return (
                        <div key={idx} className="flex items-center justify-between p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm group hover:border-primary transition-all">
                          <div className="flex-1 flex items-center gap-5">
                            <div className="size-14 bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden flex-shrink-0 border border-slate-50 dark:border-slate-700">
                              <img src={itemImg} className="w-full h-full object-cover" alt="" />
                            </div>
                            <div>
                              <p className="text-base font-black text-slate-800 dark:text-white leading-tight">{item.name}</p>
                              <p className="text-[10px] font-black text-primary uppercase mt-1">Cód. Produto: {item.sku}</p>
                            </div>
                          </div>
                          <div className="w-32 text-center">
                            <p className="text-xs font-black text-slate-800 dark:text-white">{item.qty} un.</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">R$ {item.price.toFixed(2)}</p>
                          </div>
                          <div className="w-32 text-right">
                            <p className="text-sm font-black text-primary">R$ {(item.qty * item.price).toFixed(2)}</p>
                            <button onClick={() => setItemsList(prev => prev.filter((_, i) => i !== idx))} className="text-[9px] font-black text-red-500 uppercase mt-1 opacity-0 group-hover:opacity-100 transition-all hover:underline">Remover</button>
                          </div>
                        </div>
                      );
                    })}
                    {itemsList.length === 0 && (
                      <div className="py-20 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[3rem]">
                        <svg xmlns="http://www.w3.org/2000/svg" className="size-12 mx-auto text-slate-100 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                          <path d="M3 6h18" />
                          <path d="M16 10a4 4 0 0 1-8 0" />
                        </svg>
                        <p className="text-[11px] font-black text-slate-300 uppercase tracking-[0.3em]">Nenhum item adicionado à requisição</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-10 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex gap-6">
              <button onClick={() => setIsCreateModalOpen(false)} className="flex-1 py-5 bg-white dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 rounded-3xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all">Cancelar Solicitação</button>
              <button onClick={handleFinalize} disabled={itemsList.length === 0} className="flex-[2] py-5 bg-primary text-white rounded-3xl text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl shadow-primary/30 hover:opacity-90 transition-all active:scale-95 disabled:opacity-50">Criar Requisição (Próximo: Cotações)</button>
            </div>
          </div>
        </div>
      )}

      {viewingOrder && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewingOrder(null);
          }}
        >
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-[3.5rem] shadow-2xl flex flex-col animate-in zoom-in-95 border border-slate-100 dark:border-slate-800 relative overflow-hidden">
            <div className="p-10 pb-6 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Detalhamento {viewingOrder.id}</h3>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">Gestão Completa do Fluxo de Suprimentos</p>
              </div>
              <button
                onClick={() => setViewingOrder(null)}
                className="size-14 flex items-center justify-center bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-400 hover:text-red-500 transition-all border border-slate-100 dark:border-slate-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-10 pt-0 pb-10 space-y-8 scrollbar-hide">
              <StatusProgressBar order={viewingOrder} />

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Itens do Pedido</h4>
                {viewingOrder.items.map((item, i) => {
                  const originalImg = inventory.find(inv => inv.sku === item.sku)?.imageUrl;
                  return (
                    <div key={i} className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-700 flex justify-between items-center group">
                      <div className="flex items-center gap-5">
                        <div className="size-16 bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-700 flex-shrink-0 shadow-sm">
                          <img src={originalImg} className="w-full h-full object-cover" alt="" />
                        </div>
                        <div>
                          <p className="font-black text-slate-800 dark:text-white leading-tight">{item.name}</p>
                          <p className="text-[10px] text-primary font-black uppercase tracking-tighter mt-1">Cód. Produto: {item.sku}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">REQUISITADO</p>
                        <p className="text-xl font-black text-slate-800 dark:text-white">{item.qty} un.</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-8 bg-blue-50 dark:bg-blue-900/20 rounded-[2.5rem] border border-blue-100 dark:border-blue-800 flex items-center gap-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="size-10 text-blue-500 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 leading-relaxed">
                  {viewingOrder.requester && viewingOrder.requester.includes('AI')
                    ? 'Esta requisição foi gerada algoritmicamente pela LogiAI para evitar ruptura de estoque detectada.'
                    : `Esta requisição foi gerada manualmente por Ricardo Souza via painel de suprimentos.`}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cotações */}
      {isQuotationModalOpen && quotingPO && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-6xl rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="p-10 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div className="flex-1">
                <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                  {quotationMode === 'analyze' ? 'Análise de Cotações p/ Aprovação' : 'Adicionar Cotações'}
                </h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                  {quotationMode === 'analyze' ? `Revisão do Pedido ${quotingPO.id}` : `Pedido ${quotingPO.id} - 3 Fornecedores Obrigatórios`}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => { setIsQuotationModalOpen(false); resetQuotationForm(); }}
                  className="px-6 py-3 bg-white dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
                >
                  Cancelar
                </button>

                {quotationMode === 'edit' ? (
                  <button
                    onClick={handleSubmitQuotations}
                    className="px-8 py-3 bg-amber-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-amber-500/20 hover:bg-amber-600 transition-all active:scale-95"
                  >
                    Salvar Cotações
                  </button>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setRejectionOrderId(quotingPO.id); setIsQuotationModalOpen(false); resetQuotationForm(); }}
                      className="px-6 py-3 bg-red-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-red-500/20 hover:bg-red-600 transition-all active:scale-95"
                    >
                      Rejeitar
                    </button>
                    <button
                      onClick={() => { onApprove(quotingPO.id); setIsQuotationModalOpen(false); resetQuotationForm(); }}
                      className="px-8 py-3 bg-green-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-green-500/20 hover:bg-green-600 transition-all active:scale-95"
                    >
                      Aprovar Agora
                    </button>
                  </div>
                )}

                <div className="w-px h-8 bg-slate-100 dark:bg-slate-800 mx-2" />

                <button onClick={() => { setIsQuotationModalOpen(false); resetQuotationForm(); }} className="size-12 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-400 hover:text-red-500 transition-all">
                  <svg xmlns="http://www.w3.org/2000/svg" className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="px-10 mb-2">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-800">
                <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" />
                    <line x1="3" y1="12" x2="3.01" y2="12" />
                    <line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                  Itens a Cotar
                </h4>
                <div className="space-y-3">
                  {quotingPO.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm border-b border-dashed border-slate-200 dark:border-slate-700 pb-2 last:border-0 last:pb-0">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700 dark:text-slate-200">{item.name}</span>
                        <span className="text-[10px] font-bold text-primary uppercase tracking-tighter">Cód. Produto: {item.sku}</span>
                      </div>
                      <span className="font-black text-slate-800 dark:text-white bg-white dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm">{item.qty} un.</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Últimas 3 Compras Sugestivas */}
              <div className="mt-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-6 border-2 border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="size-5 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                  <h4 className="text-[11px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest">Últimas 3 Compras Sugestivas</h4>
                </div>
                <div className="space-y-3">
                  {quotingPO.items.map((item, itemIdx) => {
                    // Buscar últimas 3 compras deste SKU em pedidos recebidos
                    const previousPurchases = orders
                      .filter(po => po.status === 'recebido' && po.items.some(i => i.sku === item.sku))
                      .slice(0, 3)
                      .map(po => {
                        const purchasedItem = po.items.find(i => i.sku === item.sku);
                        return {
                          date: po.requestDate,
                          vendor: po.vendor,
                          price: purchasedItem?.price || 0
                        };
                      });

                    if (previousPurchases.length === 0) {
                      return (
                        <div key={itemIdx} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-blue-100 dark:border-blue-800">
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">{item.name}</p>
                          <div className="flex items-center gap-2 text-slate-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" />
                              <path d="M12 16v-4" />
                              <path d="M12 8h.01" />
                            </svg>
                            <span className="text-[10px] font-bold uppercase">Nenhuma compra anterior registrada</span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={itemIdx} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-blue-100 dark:border-blue-800">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3">{item.name}</p>
                        <div className="grid grid-cols-3 gap-2">
                          {previousPurchases.map((purchase, purchaseIdx) => (
                            <div key={purchaseIdx} className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 border border-blue-100 dark:border-blue-800">
                              <div className="flex items-center gap-1 mb-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="size-3 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                                  <line x1="16" x2="16" y1="2" y2="6" />
                                  <line x1="8" x2="8" y1="2" y2="6" />
                                  <line x1="3" x2="21" y1="10" y2="10" />
                                </svg>
                                <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase">{purchase.date}</span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 truncate" title={purchase.vendor}>{purchase.vendor}</p>
                              <p className="text-sm font-black text-green-600 dark:text-green-400">R$ {purchase.price.toFixed(2)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-10 grid grid-cols-1 lg:grid-cols-3 gap-8 pt-2">
              {/* Cotação 1 */}
              <div className="space-y-4 p-6 bg-amber-50 dark:bg-amber-900/10 rounded-3xl border-2 border-amber-200 dark:border-amber-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="size-8 bg-amber-500 text-white rounded-full flex items-center justify-center text-sm font-black">1</span>
                    <h4 className="text-sm font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">Primeira Cotação</h4>
                  </div>
                  {quotationMode === 'analyze' && quotingPO?.selectedQuoteId === quotingPO?.quotes?.[0]?.id && (
                    <span className="px-3 py-1 bg-amber-500 text-white text-[9px] font-black rounded-lg uppercase tracking-widest animate-pulse">Sugerido/Selecionado</span>
                  )}
                </div>

                <div className="space-y-2 relative" ref={quote1SearchRef}>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fornecedor (CNPJ ou Nome) *</label>
                  <input
                    type="text"
                    value={quote1Search}
                    onChange={(e) => {
                      setQuote1Search(e.target.value);
                      if (quote1Vendor) setQuote1Vendor('');
                      setIsQuote1SearchOpen(true);
                    }}
                    onFocus={() => setIsQuote1SearchOpen(true)}
                    placeholder="Digite CNPJ ou Nome..."
                    disabled={quotationMode === 'analyze'}
                    className={`w-full px-4 py-3 bg-white dark:bg-slate-800 border-2 rounded-xl font-bold text-sm transition-all ${quotationMode === 'analyze' ? 'border-slate-100 dark:border-slate-700 opacity-70' : 'border-amber-200 dark:border-amber-700 focus:border-amber-500'}`}
                  />
                  {isQuote1SearchOpen && quote1Search && !quote1Vendor && (
                    <div className="absolute z-[110] left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                      {vendors.filter(v => {
                        if ((v.status || '').toLowerCase() !== 'ativo') return false;
                        const s = quote1Search.toLowerCase().trim();
                        const sNorm = normalize(s);
                        const vName = String(v.name || '').toLowerCase();
                        const vCnpj = String(v.cnpj || '');
                        const vCnpjNorm = normalize(vCnpj);

                        return vName.includes(s) ||
                          vCnpj.includes(s) ||
                          (sNorm.length > 0 && vCnpjNorm.includes(sNorm));
                      }).map(v => (
                        <button
                          key={v.id}
                          onClick={() => {
                            setQuote1Vendor(v.id);
                            setQuote1Search(v.name);
                            setIsQuote1SearchOpen(false);
                          }}
                          className="w-full p-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-left border-b border-slate-50 dark:border-slate-800 last:border-0"
                        >
                          <p className="text-sm font-black text-slate-800 dark:text-white">{v.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{v.cnpj}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor Total *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={quote1Price}
                    onChange={e => setQuote1Price(e.target.value)}
                    placeholder="R$ 0,00"
                    disabled={quotationMode === 'analyze'}
                    className={`w-full px-4 py-3 bg-white dark:bg-slate-800 border-2 rounded-xl font-bold text-sm transition-all ${quotationMode === 'analyze' ? 'border-slate-100 dark:border-slate-700 opacity-70 cursor-not-allowed' : 'border-amber-200 dark:border-amber-700 focus:border-amber-500'}`}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prazo de Entrega</label>
                  <input
                    type="date"
                    value={quote1Valid}
                    onChange={e => setQuote1Valid(e.target.value)}
                    disabled={quotationMode === 'analyze'}
                    className={`w-full px-4 py-3 bg-white dark:bg-slate-800 border-2 rounded-xl font-bold text-sm transition-all ${quotationMode === 'analyze' ? 'border-slate-100 dark:border-slate-700 opacity-70 cursor-not-allowed' : 'border-amber-200 dark:border-amber-700 focus:border-amber-500'}`}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Observações</label>
                  <textarea
                    value={quote1Notes}
                    onChange={e => setQuote1Notes(e.target.value)}
                    rows={3}
                    placeholder="Condições, prazos..."
                    disabled={quotationMode === 'analyze'}
                    className={`w-full px-4 py-3 bg-white dark:bg-slate-800 border-2 rounded-xl font-bold text-sm transition-all resize-none ${quotationMode === 'analyze' ? 'border-slate-100 dark:border-slate-700 opacity-70 cursor-not-allowed' : 'border-amber-200 dark:border-amber-700 focus:border-amber-500'}`}
                  />
                </div>
              </div>

              {/* Cotação 2 */}
              <div className="space-y-4 p-6 bg-orange-50 dark:bg-orange-900/10 rounded-3xl border-2 border-orange-200 dark:border-orange-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="size-8 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-black">2</span>
                    <h4 className="text-sm font-black text-orange-700 dark:text-orange-400 uppercase tracking-widest">Segunda Cotação</h4>
                  </div>
                  {quotationMode === 'analyze' && quotingPO?.selectedQuoteId === quotingPO?.quotes?.[1]?.id && (
                    <span className="px-3 py-1 bg-orange-500 text-white text-[9px] font-black rounded-lg uppercase tracking-widest animate-pulse">Sugerido/Selecionado</span>
                  )}
                </div>

                <div className="space-y-2 relative" ref={quote2SearchRef}>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fornecedor (CNPJ ou Nome) *</label>
                  <input
                    type="text"
                    value={quote2Search}
                    onChange={(e) => {
                      setQuote2Search(e.target.value);
                      if (quote2Vendor) setQuote2Vendor('');
                      setIsQuote2SearchOpen(true);
                    }}
                    onFocus={() => setIsQuote2SearchOpen(true)}
                    placeholder="Digite CNPJ ou Nome..."
                    disabled={quotationMode === 'analyze'}
                    className={`w-full px-4 py-3 bg-white dark:bg-slate-800 border-2 rounded-xl font-bold text-sm transition-all ${quotationMode === 'analyze' ? 'border-slate-100 dark:border-slate-700 opacity-70' : 'border-orange-200 dark:border-orange-700 focus:border-orange-500'}`}
                  />
                  {isQuote2SearchOpen && quote2Search && !quote2Vendor && (
                    <div className="absolute z-[110] left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                      {vendors.filter(v => {
                        if ((v.status || '').toLowerCase() !== 'ativo') return false;
                        const s = quote2Search.toLowerCase().trim();
                        const sNorm = normalize(s);
                        const vName = String(v.name || '').toLowerCase();
                        const vCnpj = String(v.cnpj || '');
                        const vCnpjNorm = normalize(vCnpj);

                        return vName.includes(s) ||
                          vCnpj.includes(s) ||
                          (sNorm.length > 0 && vCnpjNorm.includes(sNorm));
                      }).map(v => (
                        <button
                          key={v.id}
                          onClick={() => {
                            setQuote2Vendor(v.id);
                            setQuote2Search(v.name);
                            setIsQuote2SearchOpen(false);
                          }}
                          className="w-full p-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-left border-b border-slate-50 dark:border-slate-800 last:border-0"
                        >
                          <p className="text-sm font-black text-slate-800 dark:text-white">{v.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{v.cnpj}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor Total *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={quote2Price}
                    onChange={e => setQuote2Price(e.target.value)}
                    placeholder="R$ 0,00"
                    disabled={quotationMode === 'analyze'}
                    className={`w-full px-4 py-3 bg-white dark:bg-slate-800 border-2 rounded-xl font-bold text-sm transition-all ${quotationMode === 'analyze' ? 'border-slate-100 dark:border-slate-700 opacity-70' : 'border-orange-200 dark:border-orange-700 focus:border-orange-500'}`}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prazo de Entrega</label>
                  <input
                    type="date"
                    value={quote2Valid}
                    onChange={e => setQuote2Valid(e.target.value)}
                    disabled={quotationMode === 'analyze'}
                    className={`w-full px-4 py-3 bg-white dark:bg-slate-800 border-2 rounded-xl font-bold text-sm transition-all ${quotationMode === 'analyze' ? 'border-slate-100 dark:border-slate-700 opacity-70 cursor-not-allowed' : 'border-orange-200 dark:border-orange-700 focus:border-orange-500'}`}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Observações</label>
                  <textarea
                    value={quote2Notes}
                    onChange={e => setQuote2Notes(e.target.value)}
                    rows={3}
                    placeholder="Condições, prazos..."
                    disabled={quotationMode === 'analyze'}
                    className={`w-full px-4 py-3 bg-white dark:bg-slate-800 border-2 rounded-xl font-bold text-sm transition-all resize-none ${quotationMode === 'analyze' ? 'border-slate-100 dark:border-slate-700 opacity-70' : 'border-orange-200 dark:border-orange-700 focus:border-orange-500'}`}
                  />
                </div>
              </div>

              {/* Cotação 3 */}
              <div className="space-y-4 p-6 bg-red-50 dark:bg-red-900/10 rounded-3xl border-2 border-red-200 dark:border-red-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="size-8 bg-red-500 text-white rounded-full flex items-center justify-center text-sm font-black">3</span>
                    <h4 className="text-sm font-black text-red-700 dark:text-red-400 uppercase tracking-widest">Terceira Cotação</h4>
                  </div>
                  {quotationMode === 'analyze' && quotingPO?.selectedQuoteId === quotingPO?.quotes?.[2]?.id && (
                    <span className="px-3 py-1 bg-red-500 text-white text-[9px] font-black rounded-lg uppercase tracking-widest animate-pulse">Sugerido/Selecionado</span>
                  )}
                </div>

                <div className="space-y-2 relative" ref={quote3SearchRef}>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fornecedor (CNPJ ou Nome) *</label>
                  <input
                    type="text"
                    value={quote3Search}
                    onChange={(e) => {
                      setQuote3Search(e.target.value);
                      if (quote3Vendor) setQuote3Vendor('');
                      setIsQuote3SearchOpen(true);
                    }}
                    onFocus={() => setIsQuote3SearchOpen(true)}
                    placeholder="Digite CNPJ ou Nome..."
                    disabled={quotationMode === 'analyze'}
                    className={`w-full px-4 py-3 bg-white dark:bg-slate-800 border-2 rounded-xl font-bold text-sm transition-all ${quotationMode === 'analyze' ? 'border-slate-100 dark:border-slate-700 opacity-70' : 'border-red-200 dark:border-red-700 focus:border-red-500'}`}
                  />
                  {isQuote3SearchOpen && quote3Search && !quote3Vendor && (
                    <div className="absolute z-[110] left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                      {vendors.filter(v => {
                        if ((v.status || '').toLowerCase() !== 'ativo') return false;
                        const s = quote3Search.toLowerCase().trim();
                        const sNorm = normalize(s);
                        const vName = String(v.name || '').toLowerCase();
                        const vCnpj = String(v.cnpj || '');
                        const vCnpjNorm = normalize(vCnpj);

                        return vName.includes(s) ||
                          vCnpj.includes(s) ||
                          (sNorm.length > 0 && vCnpjNorm.includes(sNorm));
                      }).map(v => (
                        <button
                          key={v.id}
                          onClick={() => {
                            setQuote3Vendor(v.id);
                            setQuote3Search(v.name);
                            setIsQuote3SearchOpen(false);
                          }}
                          className="w-full p-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-left border-b border-slate-50 dark:border-slate-800 last:border-0"
                        >
                          <p className="text-sm font-black text-slate-800 dark:text-white">{v.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{v.cnpj}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor Total *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={quote3Price}
                    onChange={e => setQuote3Price(e.target.value)}
                    placeholder="R$ 0,00"
                    disabled={quotationMode === 'analyze'}
                    className={`w-full px-4 py-3 bg-white dark:bg-slate-800 border-2 rounded-xl font-bold text-sm transition-all ${quotationMode === 'analyze' ? 'border-slate-100 dark:border-slate-700 opacity-70' : 'border-red-200 dark:border-red-700 focus:border-red-500'}`}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TEMPO DE ENTREGA</label>
                  <input
                    type="date"
                    value={quote3Valid}
                    onChange={e => setQuote3Valid(e.target.value)}
                    disabled={quotationMode === 'analyze'}
                    className={`w-full px-4 py-3 bg-white dark:bg-slate-800 border-2 rounded-xl font-bold text-sm transition-all ${quotationMode === 'analyze' ? 'border-slate-100 dark:border-slate-700 opacity-70' : 'border-red-200 dark:border-red-700 focus:border-red-500'}`}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Observações</label>
                  <textarea
                    value={quote3Notes}
                    onChange={e => setQuote3Notes(e.target.value)}
                    rows={3}
                    placeholder="Condições, prazos..."
                    disabled={quotationMode === 'analyze'}
                    className={`w-full px-4 py-3 bg-white dark:bg-slate-800 border-2 rounded-xl font-bold text-sm transition-all resize-none ${quotationMode === 'analyze' ? 'border-slate-100 dark:border-slate-700 opacity-70' : 'border-red-200 dark:border-red-700 focus:border-red-500'}`}
                  />
                </div>
              </div>
            </div>

            {/* Footer removed to move buttons to header */}
          </div>
        </div>
      )}

      {/* Modal de Envio ao Fornecedor */}
      {isSendModalOpen && sendingPO && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[3.5rem] shadow-2xl p-10 animate-in zoom-in-95 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Marcar como Enviado</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Pedido {sendingPO.id}</p>
              </div>
              <button onClick={() => { setIsSendModalOpen(false); setVendorOrderNum(''); }} className="size-12 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-400 hover:text-red-500 transition-all">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-6">
              <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
                <p className="text-xs font-bold text-blue-600 dark:text-blue-400">
                  Fornecedor: <span className="text-blue-700 dark:text-blue-300">{sendingPO.vendor}</span>
                </p>
                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-2">
                  Total: <span className="text-blue-700 dark:text-blue-300">R$ {sendingPO.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Número do Pedido do Fornecedor *</label>
                <input
                  type="text"
                  value={vendorOrderNum}
                  onChange={e => setVendorOrderNum(e.target.value)}
                  placeholder="Ex: PED-2024-001"
                  className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-bold text-sm focus:border-primary transition-all"
                />
                <p className="text-[10px] text-slate-400 font-medium">Informe o número de confirmação recebido do fornecedor</p>
              </div>
            </div>

            <div className="mt-8 flex gap-4">
              <button onClick={() => { setIsSendModalOpen(false); setVendorOrderNum(''); }} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
              <button onClick={handleConfirmSend} disabled={!vendorOrderNum.trim()} className="flex-1 py-4 bg-green-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-green-600 transition-all active:scale-95 disabled:opacity-50">Confirmar Envio</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Motivo da Rejeição */}
      {rejectionOrderId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-300">
            <div className="p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-2xl">
                  <svg xmlns="http://www.w3.org/2000/svg" className="size-6 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Motivo da Rejeição</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Pedido: {rejectionOrderId}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Descreva o motivo detalhado</label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Ex: Cotações acima do orçamento previsto, fornecedor sem estoque, etc..."
                    className="w-full h-32 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all resize-none outline-none dark:text-white"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => {
                    setRejectionOrderId(null);
                    setRejectionReason('');
                  }}
                  className="flex-1 px-6 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    onReject(rejectionOrderId, rejectionReason);
                    setRejectionOrderId(null);
                    setRejectionReason('');
                  }}
                  disabled={!rejectionReason.trim()}
                  className="flex-1 px-6 py-4 bg-red-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirmar Rejeição
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
