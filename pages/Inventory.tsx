import React, { useState, useEffect } from 'react';
import { InventoryItem, INVENTORY_STATUS_LABELS } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { PaginationBar } from '../components/PaginationBar';

interface InventoryProps {
  items?: InventoryItem[];
  onUpdateItem?: (item: InventoryItem) => void;
  onCreateAutoPO?: (item: InventoryItem) => void;
  onRecalculateROP?: () => void;
}

export const Inventory: React.FC<InventoryProps> = ({ items = [], onUpdateItem, onCreateAutoPO, onRecalculateROP }) => {
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isOpsModalOpen, setIsOpsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  const [newLocation, setNewLocation] = useState('');
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [minQty, setMinQty] = useState<number>(0);
  const [maxQty, setMaxQty] = useState<number>(0);
  const [leadTime, setLeadTime] = useState<number>(7);
  const [safetyStock, setSafetyStock] = useState<number>(5);
  const [calculatedStatus, setCalculatedStatus] = useState<InventoryItem['status']>('disponivel');
  
  // Estados para paginacao
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50; // Limite razoavel para renderizacao
  
  // Estados para busca
  const [searchTerm, setSearchTerm] = useState('');

  const computeStatus = (qty: number, max: number, min: number, loc: string, exp: string): InventoryItem['status'] => {
    const safeLoc = (loc || '').toUpperCase();
    const safeExp = (exp || '');

    if (safeLoc.startsWith('DOCA') || safeLoc.startsWith('D')) return 'transito';
    if (qty > (max || 1000)) return 'excesso';
    if (qty < (min || 0)) return 'divergente';
    if (safeExp.includes('2024') || safeExp.includes('2023')) return 'vencimento';
    return 'disponivel';
  };

  useEffect(() => {
    if (selectedItem) {
      const status = computeStatus(adjustQty, maxQty, minQty, newLocation, selectedItem.expiry);
      setCalculatedStatus(status);
    }
  }, [adjustQty, maxQty, minQty, newLocation, selectedItem]);

  const handleOpenOps = (item: InventoryItem) => {
    setSelectedItem(item);
    setNewLocation(item.location || '');
    setAdjustQty(item.quantity || 0);
    setMinQty(item.minQty || 0);
    setMaxQty(item.maxQty || 1000);
    setLeadTime(item.leadTime || 7);
    setSafetyStock(item.safetyStock || 5);
    setIsOpsModalOpen(true);
  };

  const handleSaveOperations = () => {
    if (selectedItem && onUpdateItem) {
      onUpdateItem({
        ...selectedItem,
        location: newLocation,
        quantity: adjustQty,
        minQty: minQty,
        maxQty: maxQty,
        leadTime: leadTime,
        safetyStock: safetyStock,
        status: calculatedStatus
      });
      setIsOpsModalOpen(false);
    }
  };

  // Filtrar itens com base no termo de busca
  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.location?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calcular itens para a pagina atual
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  
  // Resetar para a primeira pagina quando os itens mudarem ou a busca mudar
  useEffect(() => {
    setCurrentPage(1);
  }, [items, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-black tracking-tight text-slate-800 dark:text-white">Estoque e Armazenamento</h2>
          <p className="text-slate-500 text-sm font-medium">Visualização unificada de saldos por Código de Produto no CD Manaus.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Campo de busca */}
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar produtos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-700 dark:text-white focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            )}
          </div>

          <button
            onClick={onRecalculateROP}
            className="px-6 py-3.5 bg-amber-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-amber-500/20 hover:bg-amber-600 transition-all active:scale-95 flex items-center gap-3"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
            Recalcular ROP Dinâmico
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-wider">Produto</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Etiqueta</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Locação Principal</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-wider">Saldo Total</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Estado do Ativo</th>
                <th className="px-6 py-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {currentItems.length > 0 ? (
                currentItems.map((item, idx) => (
                  <tr key={item.sku} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <img src={item.imageUrl} alt={item.name} className="size-14 rounded-2xl object-cover border-2 border-white dark:border-slate-800 shadow-sm" />
                        <div>
                          <p className="text-sm font-black text-slate-800 dark:text-white truncate max-w-[200px]">{item.name}</p>
                          <span className="text-[10px] font-black text-primary uppercase tracking-wider">Cód. Produto: {item.sku}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => { setSelectedItem(item); setIsQRModalOpen(true); }}
                        className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-primary/10 hover:text-primary transition-all shadow-sm active:scale-95 border border-slate-200 dark:border-slate-700"
                      >
                        <QRCodeSVG value={item.sku} size={20} />
                      </button>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-[10px] font-black px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                        {item.location}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className={`text-sm font-black ${item.quantity < item.minQty ? 'text-red-500' : 'text-slate-800 dark:text-slate-200'}`}>
                          {item.quantity} {item.unit || 'un.'}
                        </span>
                        <div className="flex flex-col gap-0.5 mt-1">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Min: {item.minQty} | Max: {item.maxQty}</span>
                          <span className="text-[9px] font-black text-primary/70 uppercase">Lead Time: {item.leadTime || 7}d | Segurança: {item.safetyStock || 5}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-tight ${item.status === 'disponivel' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                        item.status === 'vencimento' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                          item.status === 'excesso' ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                            item.status === 'divergente' ? 'bg-red-50 text-red-600 border border-red-100' :
                              'bg-blue-50 text-blue-600 border border-blue-100'
                        }`}>
                        {INVENTORY_STATUS_LABELS[item.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenOps(item)}
                        className="px-4 py-2.5 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ml-auto shadow-lg shadow-primary/20 hover:bg-blue-600 transition-all active:scale-95"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        Operar Ativo
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="size-12 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 8v4" />
                        <path d="M12 16h.01" />
                      </svg>
                      <p className="text-slate-500 font-black text-sm">Nenhum produto encontrado</p>
                      {searchTerm && (
                        <p className="text-slate-400 text-xs">Tente usar outros termos de busca</p>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {filteredItems.length > ITEMS_PER_PAGE && (
          <div className="border-t border-slate-100 dark:border-slate-800">
            <PaginationBar
              currentPage={currentPage}
              currentCount={currentItems.length}
              pageSize={ITEMS_PER_PAGE}
              hasNextPage={currentPage < totalPages}
              isLoading={false}
              itemLabel="itens"
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {isOpsModalOpen && selectedItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black tracking-tight text-slate-800 dark:text-white">Painel Operacional: {selectedItem.sku}</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Sincronização de Dados e Auditoria Automática</p>
              </div>
              <button onClick={() => setIsOpsModalOpen(false)} className="size-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-400 hover:text-red-500 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Endereçamento (Locação)</label>
                    <input
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value.toUpperCase())}
                      className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 focus:border-primary focus:ring-0 rounded-xl font-black text-sm transition-all text-slate-800 dark:text-white"
                      placeholder="Ex: A01-B02-N03"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saldo Físico Atual</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={adjustQty}
                        onChange={(e) => setAdjustQty(Number(e.target.value))}
                        className="flex-1 px-4 py-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 focus:border-primary focus:ring-0 rounded-xl font-black text-sm transition-all text-slate-800 dark:text-white"
                      />
                      <div className="px-4 py-3.5 bg-slate-100 dark:bg-slate-700 border-2 border-transparent rounded-xl font-black text-sm text-slate-500 flex items-center">
                        {selectedItem.unit || 'UN'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estoque Mínimo (Alerta)</label>
                    <input
                      type="number"
                      value={minQty}
                      onChange={(e) => setMinQty(Number(e.target.value))}
                      className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 focus:border-red-400 focus:ring-0 rounded-xl font-black text-sm transition-all text-red-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estoque Máximo (Capacidade)</label>
                    <input
                      type="number"
                      value={maxQty}
                      onChange={(e) => setMaxQty(Number(e.target.value))}
                      className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 focus:border-emerald-400 focus:ring-0 rounded-xl font-black text-sm transition-all text-emerald-500"
                    />
                  </div>
                </div>

                {/* Parâmetros de ROP */}
                <div className="space-y-4 col-span-1 md:col-span-2 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border-2 border-slate-100 dark:border-slate-800">
                  <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4">Configuração de ROP Dinâmico</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        Tempo de Reposição (Dias)
                        <span className="p-1 bg-primary/10 text-primary rounded text-[8px]">Lead Time</span>
                      </label>
                      <input
                        type="number"
                        value={leadTime}
                        onChange={(e) => setLeadTime(Number(e.target.value))}
                        className="w-full px-4 py-3.5 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-0 rounded-xl font-black text-sm transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        Estoque de Segurança
                        <span className="p-1 bg-primary/10 text-primary rounded text-[8px]">Protection Stock</span>
                      </label>
                      <input
                        type="number"
                        value={safetyStock}
                        onChange={(e) => setSafetyStock(Number(e.target.value))}
                        className="w-full px-4 py-3.5 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-0 rounded-xl font-black text-sm transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Resultante (Auto-Detecção)</p>
                  <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-primary animate-spin-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                  </svg>
                </div>

                <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-[0.1em] border-2 shadow-sm transition-all duration-500 ${calculatedStatus === 'disponivel' ? 'bg-emerald-500 border-emerald-500 text-white' :
                    calculatedStatus === 'vencimento' ? 'bg-amber-500 border-amber-500 text-white' :
                      calculatedStatus === 'excesso' ? 'bg-purple-500 border-purple-500 text-white' :
                        calculatedStatus === 'divergente' ? 'bg-red-500 border-red-500 text-white' :
                          'bg-blue-500 border-blue-500 text-white'
                    }`}>
                    {INVENTORY_STATUS_LABELS[calculatedStatus]}
                  </div>
                  <p className="text-[11px] font-bold text-slate-500 leading-tight">
                    {calculatedStatus === 'disponivel' && 'Item em conformidade total com os parâmetros de estoque.'}
                    {calculatedStatus === 'excesso' && 'Alerta: A quantidade física supera a capacidade máxima do endereço.'}
                    {calculatedStatus === 'divergente' && 'Atenção: Estoque abaixo do nível mínimo de segurança.'}
                    {calculatedStatus === 'transito' && 'Movimentação detectada em área de recebimento/doca.'}
                    {calculatedStatus === 'vencimento' && 'Atenção: Item com data de validade próxima ou expirada.'}
                  </p>
                </div>
              </div>

              <div className="pt-6 flex gap-3">
                <button
                  onClick={() => setIsOpsModalOpen(false)}
                  className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl text-[11px] font-black uppercase tracking-[0.1em] hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveOperations}
                  className="flex-[2] py-4 bg-primary text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:bg-blue-600 transition-all active:scale-95"
                >
                  Sincronizar e Gravar Ativo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isQRModalOpen && selectedItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] shadow-2xl flex flex-col items-center gap-6 max-w-xs w-full animate-in zoom-in-95">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Identificação de Cód. Produto</h3>
            <div className="p-4 bg-white rounded-2xl shadow-inner border border-slate-100">
              <QRCodeSVG value={selectedItem.sku} size={180} />
            </div>
            <div className="text-center">
              <p className="text-xl font-black text-slate-800 dark:text-white">{selectedItem.sku}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{selectedItem.name}</p>
            </div>
            <button
              onClick={() => setIsQRModalOpen(false)}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all"
            >
              Fechar Visualização
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

