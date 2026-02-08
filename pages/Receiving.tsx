
import React, { useState, useEffect } from 'react';
import { PurchaseOrder } from '../types';

interface ReceivingItem {
  id: string;
  sku: string;
  name: string;
  ean: string;
  expected: number;
  received: number;
  status: 'ok' | 'divergente' | 'pendente' | 'excesso';
  imageUrl: string;
}

interface ReceivingProps {
  onFinalize: (items: ReceivingItem[], poId?: string) => Promise<boolean>;
  availablePOs: PurchaseOrder[];
}

export const Receiving: React.FC<ReceivingProps> = ({ onFinalize, availablePOs }) => {
  const [selectedPO, setSelectedPO] = useState<string>('');
  const [items, setItems] = useState<ReceivingItem[]>([]);
  const [barcode, setBarcode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Carregar itens do PO selecionado
  useEffect(() => {
    if (selectedPO) {
      const po = availablePOs.find(p => p.id === selectedPO);
      if (po) {
        const receivingItems: ReceivingItem[] = po.items.map((item, idx) => ({
          id: `${idx + 1}`,
          sku: item.sku,
          name: item.name,
          ean: item.sku, // Usando SKU como EAN para simplificar
          expected: item.qty,
          received: 0,
          status: 'pendente' as const,
          imageUrl: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=100&h=100&fit=crop'
        }));
        setItems(receivingItems);
      }
    } else {
      setItems([]);
    }
  }, [selectedPO, availablePOs]);

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode) return;
    setIsScanning(true);

    // Simulação de leitura: Encontra o item e incrementa
    setTimeout(() => {
      setItems(prev => prev.map(item => {
        if (item.ean === barcode || item.sku === barcode) {
          const newReceived = item.received + 1;
          return {
            ...item,
            received: newReceived,
            status: newReceived === item.expected ? 'ok' : newReceived > item.expected ? 'excesso' : 'pendente'
          };
        }
        return item;
      }));
      setIsScanning(false);
      setBarcode('');
    }, 400);
  };

  const handleSimulateAutoFill = () => {
    setItems(prev => prev.map(item => ({
      ...item,
      received: item.expected,
      status: 'ok'
    })));
  };

  const finalizeReceipt = async (targetItems: ReceivingItem[], targetPoId: string) => {
    if (isFinalizing) return;

    const validItems = targetItems.filter((item) => item.received > 0);
    if (!targetPoId || validItems.length === 0) return;

    setIsFinalizing(true);
    try {
      const success = await onFinalize(validItems, targetPoId);
      if (success) {
        setSelectedPO('');
        setItems([]);
      }
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleTotalReceipt = async () => {
    if (!selectedPO) return;

    const confirmed = window.confirm(
      'Atencao: o recebimento total ignora a conferencia item a item. Confirme apenas se a carga fisica estiver correta. Confirmar entrada total?'
    );

    if (confirmed) {
      const fullItems = items.map(item => ({
        ...item,
        received: item.expected,
        status: 'ok' as const
      }));
      setItems(fullItems);
      await finalizeReceipt(fullItems, selectedPO);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ok': return 'CONCLUÍDO';
      case 'pendente': return 'PENDENTE';
      case 'excesso': return 'EXCESSO';
      case 'divergente': return 'DIVERGENTE';
      default: return status.toUpperCase();
    }
  };

  const isComplete = items.every(i => i.received > 0);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-200/60 dark:border-slate-800 shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-4 px-4 py-2">
          <div className="bg-primary/10 p-2 rounded-xl text-primary hidden sm:block">
            <svg xmlns="http://www.w3.org/2000/svg" className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black tracking-tight uppercase">
                {selectedPO ? `Entrada ${selectedPO}` : 'Aguardando Seleção de PO'}
              </h3>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Conferência de Carga em Tempo Real</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2">
          {selectedPO && (
            <button
              onClick={handleTotalReceipt}
              disabled={isFinalizing}
              className="px-6 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-black hover:bg-slate-200 transition-all h-10 border border-slate-200 dark:border-slate-700"
            >
              {isFinalizing ? 'PROCESSANDO...' : 'RECEBIMENTO TOTAL'}
            </button>
          )}

          <button
            onClick={() => void finalizeReceipt(items, selectedPO)}
            disabled={isFinalizing || !selectedPO || !items.some(i => i.received > 0)}
            className="px-6 py-2 bg-primary text-white rounded-xl text-xs font-black shadow-lg shadow-primary/20 hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed w-full h-10"
          >
            {isFinalizing ? 'FINALIZANDO...' : 'FINALIZAR E ENVIAR AO ESTOQUE'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm h-full flex flex-col">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="size-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 5v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2z" />
                <path d="M7 7v10" />
                <path d="M10 7v10" />
                <path d="M13 7v10" />
                <path d="M17 7v10" />
              </svg>
              Terminal de Leitura
            </h3>

            {/* Seletor de Pedido de Compra */}
            <div className="mb-6 pb-6 border-b border-slate-100 dark:border-slate-800">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">
                Selecionar Pedido de Compra
              </label>
              <select
                value={selectedPO}
                onChange={(e) => setSelectedPO(e.target.value)}
                disabled={isFinalizing}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 focus:border-primary focus:ring-0 rounded-xl font-black text-sm transition-all"
              >
                <option value="">Escolha um PO enviado...</option>
                {availablePOs.map(po => (
                  <option key={po.id} value={po.id}>
                    {po.id} - {po.vendor} ({po.items.length} itens)
                  </option>
                ))}
              </select>
              {availablePOs.length === 0 && (
                <p className="text-xs text-amber-500 font-bold mt-2">
                  ⚠️ Nenhum PO enviado disponivel para recebimento
                </p>
              )}
              {selectedPO && (
                <p className="text-xs text-emerald-600 font-bold mt-2">
                  ✓ PO {selectedPO} carregado com {items.length} itens
                </p>
              )}
            </div>

            <form onSubmit={handleScan} className="space-y-6 flex-1">
              <div className="relative group">
                <div className="relative">
                  <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="2" ry="2" />
                    <rect x="7" y="7" width="10" height="10" />
                  </svg>
                  <input
                    autoFocus
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    disabled={isFinalizing}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-mono text-lg focus:ring-2 focus:ring-primary transition-all"
                    placeholder="EAN ou Cód. Produto..."
                    type="text"
                  />
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
                <p className="text-[10px] font-black text-blue-600 uppercase mb-2">Instrução de Operação</p>
                <p className="text-xs text-blue-500 font-medium">
                  {selectedPO
                    ? 'Escaneie o código de barras ou digite o Cód. Produto dos produtos para conferência.'
                    : 'Selecione um Pedido de Compra acima para iniciar a conferência.'}
                </p>
              </div>

              <button
                type="submit"
                disabled={isFinalizing || isScanning || !barcode}
                className="w-full py-4 bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white font-black rounded-xl hover:bg-black transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isScanning ? 'PROCESSANDO...' : 'REGISTRAR LEITURA'}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-black text-slate-400 uppercase">Resumo da Carga</p>
                <span className="text-[10px] font-black text-primary">STATUS ATUAL</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <p className="text-[10px] font-bold text-slate-400 mb-1 uppercase">Lidos</p>
                  <p className="text-xl font-black">{items.reduce((acc, i) => acc + i.received, 0)}</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <p className="text-[10px] font-bold text-slate-400 mb-1 uppercase">Total</p>
                  <p className="text-xl font-black">{items.reduce((acc, i) => acc + i.expected, 0)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                    <th className="px-6 py-4">Produto</th>
                    <th className="px-6 py-4 text-center">Esperado</th>
                    <th className="px-6 py-4 text-center">Lido</th>
                    <th className="px-6 py-4 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <img src={item.imageUrl} alt={item.name} className="size-14 rounded-lg object-cover" />
                          <div className="flex flex-col min-w-0">
                            <span className="text-base font-black truncate mb-0.5">{item.name}</span>
                            <span className="text-[10px] font-black text-primary uppercase">Cód. Produto: {item.sku}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-sm">{item.expected}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`font-black text-sm ${item.received > 0 ? 'text-primary' : 'text-slate-300'}`}>{item.received}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase ${item.status === 'ok' ? 'bg-emerald-100 text-emerald-700' :
                            item.status === 'pendente' ? 'bg-slate-100 text-slate-500' : 'bg-red-100 text-red-700'
                            }`}>
                            {getStatusLabel(item.status)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
