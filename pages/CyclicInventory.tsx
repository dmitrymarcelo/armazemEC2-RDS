
import React, { useState, useEffect } from 'react';
import { InventoryItem, CyclicBatch, CyclicCount } from '../types';
import { api } from '../api-client';

interface CyclicInventoryProps {
    inventory: InventoryItem[];
    batches: CyclicBatch[];
    onCreateBatch: (items: { sku: string; expected: number }[]) => Promise<string | null>;
    onFinalizeBatch: (batchId: string, counts: any[]) => Promise<void>;
    onClassifyABC: () => Promise<void>;
}

export const CyclicInventory: React.FC<CyclicInventoryProps> = ({ inventory, batches, onCreateBatch, onFinalizeBatch, onClassifyABC }) => {
    const [activeTab, setActiveTab] = useState<'batches' | 'accuracy'>('batches');
    const [isNewBatchModalOpen, setIsNewBatchModalOpen] = useState(false);
    const [isCountModalOpen, setIsCountModalOpen] = useState(false);
    const [selectedBatch, setSelectedBatch] = useState<CyclicBatch | null>(null);
    const [currentCounts, setCurrentCounts] = useState<CyclicCount[]>([]);
    const [countInputs, setCountInputs] = useState<Record<string, string>>({});

    // ABC Analysis summary
    const abcStats = {
        A: inventory.filter(i => i.abcCategory === 'A').length,
        B: inventory.filter(i => i.abcCategory === 'B').length,
        C: inventory.filter(i => i.abcCategory === 'C').length,
    };

    const getAccuracyColor = (rate: number) => {
        if (rate >= 99) return 'text-emerald-500';
        if (rate >= 95) return 'text-amber-500';
        return 'text-red-500';
    };

    const handleOpenCount = async (batch: CyclicBatch) => {
        const { data: counts } = await api.from('cyclic_counts').select('*').eq('batch_id', batch.id);
        if (counts) {
            setCurrentCounts(counts.map(c => ({
                id: c.id,
                batchId: c.batch_id,
                sku: c.sku,
                expectedQty: c.expected_qty,
                countedQty: c.counted_qty,
                status: c.status,
                notes: c.notes,
                countedAt: c.counted_at
            })));

            const initialInputs: Record<string, string> = {};
            counts.forEach(c => {
                initialInputs[c.id] = c.counted_qty?.toString() || '';
            });
            setCountInputs(initialInputs);
            setSelectedBatch(batch);
            setIsCountModalOpen(true);
        }
    };

    const handleSaveBatch = async () => {
        if (!selectedBatch) return;

        const finalizedCounts = currentCounts.map(c => ({
            ...c,
            countedQty: parseInt(countInputs[c.id]) || 0,
            status: 'contado'
        }));

        await onFinalizeBatch(selectedBatch.id, finalizedCounts);
        setIsCountModalOpen(false);
        setSelectedBatch(null);
    };

    const createSmartBatch = async (category: 'A' | 'B' | 'C', limit: number) => {
        // Pegar itens da categoria que não foram contados recentemente
        const items = inventory
            .filter(i => i.abcCategory === category)
            .sort((a, b) => {
                if (!a.lastCountedAt) return -1;
                if (!b.lastCountedAt) return 1;
                return new Date(a.lastCountedAt).getTime() - new Date(b.lastCountedAt).getTime();
            })
            .slice(0, limit)
            .map(i => ({ sku: i.sku, expected: i.quantity }));

        if (items.length > 0) {
            await onCreateBatch(items);
            setIsNewBatchModalOpen(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-black tracking-tighter text-slate-800 dark:text-white flex items-center gap-3">
                        Inventário Cíclico
                        <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black rounded-lg uppercase tracking-widest">WMS Intelligence</span>
                    </h2>
                    <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">Gestão contínua de acuracidade</p>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={onClassifyABC}
                        className="bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-6 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-all flex items-center gap-3"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20" /></svg>
                        Reclassificar ABC
                    </button>

                    <button
                        onClick={() => setIsNewBatchModalOpen(true)}
                        className="bg-primary text-white px-8 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-7-7v14" /></svg>
                        Novo Lote de Contagem
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-8 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm group hover:shadow-xl transition-all">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Classificação ABC</p>
                    <div className="flex items-end gap-1 h-24 mb-4">
                        <div className="flex-1 bg-emerald-500/20 rounded-t-2xl relative group/bar" style={{ height: '100%' }}>
                            <div className="absolute inset-x-0 bottom-0 bg-emerald-500 rounded-t-2xl transition-all duration-1000" style={{ height: `${(abcStats.A / inventory.length) * 100}%` }}></div>
                            <span className="absolute -top-6 inset-x-0 text-center text-[10px] font-black text-emerald-600">A: {abcStats.A}</span>
                        </div>
                        <div className="flex-1 bg-amber-500/20 rounded-t-2xl relative group/bar" style={{ height: '100%' }}>
                            <div className="absolute inset-x-0 bottom-0 bg-amber-500 rounded-t-2xl transition-all duration-1000" style={{ height: `${(abcStats.B / inventory.length) * 100}%` }}></div>
                            <span className="absolute -top-6 inset-x-0 text-center text-[10px] font-black text-amber-600">B: {abcStats.B}</span>
                        </div>
                        <div className="flex-1 bg-slate-500/20 rounded-t-2xl relative group/bar" style={{ height: '100%' }}>
                            <div className="absolute inset-x-0 bottom-0 bg-slate-500 rounded-t-2xl transition-all duration-1000" style={{ height: `${(abcStats.C / inventory.length) * 100}%` }}></div>
                            <span className="absolute -top-6 inset-x-0 text-center text-[10px] font-black text-slate-600">C: {abcStats.C}</span>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 font-bold text-center leading-tight">Distribuição de valor e giro no CD</p>
                </div>

                <div className="p-8 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Acuracidade Média</p>
                        <h3 className={`text-5xl font-black tracking-tighter ${getAccuracyColor(batches.length ? batches.reduce((acc, b) => acc + (b.accuracyRate || 0), 0) / batches.length : 100)}`}>
                            {batches.length ? (batches.reduce((acc, b) => acc + (b.accuracyRate || 0), 0) / batches.length).toFixed(1) : '100'}%
                        </h3>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: '99.2%' }}></div>
                        </div>
                        <span className="text-[10px] font-black text-slate-400">META: 99.5%</span>
                    </div>
                </div>

                <div className="p-8 bg-slate-900 text-white rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 text-white/5 group-hover:text-white/10 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" /><path d="m9 12 2 2 4-4" /></svg>
                    </div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">Status Global</p>
                        <h3 className="text-2xl font-black tracking-tight leading-tight mb-4">Operação em Conformidade</h3>
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-[10px] font-bold">
                                <span className="size-2 rounded-full bg-emerald-500"></span>
                                Itens Críticos Contados
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-bold">
                                <span className="size-2 rounded-full bg-emerald-500"></span>
                                Giro Classe A Monitorado
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex gap-8">
                        <button
                            onClick={() => setActiveTab('batches')}
                            className={`text-[11px] font-black uppercase tracking-widest pb-2 border-b-4 transition-all ${activeTab === 'batches' ? 'border-primary text-slate-800 dark:text-white' : 'border-transparent text-slate-400'}`}
                        >
                            Lotes Recentes
                        </button>
                        <button
                            onClick={() => setActiveTab('accuracy')}
                            className={`text-[11px] font-black uppercase tracking-widest pb-2 border-b-4 transition-all ${activeTab === 'accuracy' ? 'border-primary text-slate-800 dark:text-white' : 'border-transparent text-slate-400'}`}
                        >
                            Mapa de Divergências
                        </button>
                    </div>
                </div>

                <div className="p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {batches.map(batch => (
                            <div key={batch.id} className="p-6 rounded-3xl border border-slate-100 dark:border-slate-800 hover:border-primary/30 transition-all group">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">#{batch.id}</span>
                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${batch.status === 'aberto' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'
                                        }`}>
                                        {batch.status}
                                    </span>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <p className="text-xs font-bold text-slate-500 mb-1">Data Agendada</p>
                                        <p className="text-sm font-black text-slate-800 dark:text-white">
                                            {new Date(batch.scheduledDate).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>

                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-xs font-bold text-slate-500 mb-1">Itens</p>
                                            <p className="text-lg font-black text-slate-800 dark:text-white">{batch.totalItems}</p>
                                        </div>
                                        {batch.status === 'concluido' && (
                                            <div className="text-right">
                                                <p className="text-xs font-bold text-slate-500 mb-1">Acuracidade</p>
                                                <p className={`text-lg font-black ${getAccuracyColor(batch.accuracyRate || 0)}`}>{batch.accuracyRate?.toFixed(1)}%</p>
                                            </div>
                                        )}
                                    </div>

                                    {batch.status === 'aberto' ? (
                                        <button
                                            onClick={() => handleOpenCount(batch)}
                                            className="w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary transition-all shadow-lg active:scale-95"
                                        >
                                            Iniciar Contagem
                                        </button>
                                    ) : (
                                        <button className="w-full py-3 bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                                            Concluído
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}

                        {batches.length === 0 && (
                            <div className="col-span-full py-20 text-center space-y-4">
                                <div className="size-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><path d="M12 2v10" /><path d="M18.4 4.6a10 10 0 1 1-12.8 0" /></svg>
                                </div>
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Nenhum lote de inventário criado</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal Nova Contagem */}
            {isNewBatchModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsNewBatchModalOpen(false)}></div>
                    <div className="relative bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-10 text-center">
                            <div className="size-16 bg-primary/10 text-primary rounded-3xl flex items-center justify-center mx-auto mb-6">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" /><path d="M8 12h8" /><path d="M12 8v8" /></svg>
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight mb-2">Novo Lote Inteligente</h3>
                            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-10">Escolha a estratégia de contagem</p>

                            <div className="space-y-4">
                                <button
                                    onClick={() => createSmartBatch('A', 5)}
                                    className="w-full p-6 text-left border-2 border-slate-100 dark:border-slate-800 rounded-[2rem] hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all group"
                                >
                                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Estratégia de Alto Valor</p>
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-lg font-black text-slate-800 dark:text-white group-hover:text-emerald-700 transition-colors">Giro Classe A (5 Itens)</h4>
                                        <span className="material-symbols-outlined text-emerald-500">arrow_forward</span>
                                    </div>
                                </button>

                                <button
                                    onClick={() => createSmartBatch('B', 10)}
                                    className="w-full p-6 text-left border-2 border-slate-100 dark:border-slate-800 rounded-[2rem] hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-all group"
                                >
                                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Estratégia de Volume</p>
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-lg font-black text-slate-800 dark:text-white group-hover:text-amber-700 transition-colors">Médio Giro Classe B (10 Itens)</h4>
                                        <span className="material-symbols-outlined text-amber-500">arrow_forward</span>
                                    </div>
                                </button>

                                <button
                                    onClick={() => createSmartBatch('C', 15)}
                                    className="w-full p-6 text-left border-2 border-slate-100 dark:border-slate-800 rounded-[2rem] hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900/10 transition-all group"
                                >
                                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Estratégia de Cobertura</p>
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-lg font-black text-slate-800 dark:text-white group-hover:text-slate-700 transition-colors">Giro Lento Classe C (15 Itens)</h4>
                                        <span className="material-symbols-outlined text-slate-500">arrow_forward</span>
                                    </div>
                                </button>
                            </div>
                        </div>

                        <div className="p-8 bg-slate-50 dark:bg-slate-800/30 flex gap-4">
                            <button onClick={() => setIsNewBatchModalOpen(false)} className="flex-1 py-4 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-colors">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Executar Contagem */}
            {isCountModalOpen && selectedBatch && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsCountModalOpen(false)}></div>
                    <div className="relative bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col h-[80vh]">
                        <div className="p-10 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/30">
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Executando Lote #{selectedBatch.id}</h3>
                                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Conferência física de estoque</p>
                            </div>
                            <button
                                onClick={() => setIsCountModalOpen(false)}
                                className="size-12 rounded-2xl bg-white dark:bg-slate-900 shadow-lg flex items-center justify-center hover:scale-110 active:scale-90 transition-all group"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 group-hover:text-red-500"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-10 space-y-6">
                            {currentCounts.map(count => {
                                const item = inventory.find(i => i.sku === count.sku);
                                const diff = (parseInt(countInputs[count.id]) || 0) - count.expectedQty;

                                return (
                                    <div key={count.id} className="p-6 bg-slate-50 dark:bg-slate-800/20 rounded-[2rem] border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center gap-8">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">{count.sku} • {item?.location || 'S/ LOC'}</p>
                                            <h4 className="text-lg font-black text-slate-800 dark:text-white truncate">{item?.name || 'Produto não encontrado'}</h4>
                                        </div>

                                        <div className="flex items-center gap-10">
                                            <div className="text-center">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Esperado</p>
                                                <p className="text-xl font-black text-slate-800 dark:text-white">{count.expectedQty}</p>
                                            </div>

                                            <div className="w-32">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">Contagem</p>
                                                <input
                                                    type="number"
                                                    value={countInputs[count.id]}
                                                    onChange={(e) => setCountInputs(prev => ({ ...prev, [count.id]: e.target.value }))}
                                                    className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-center font-black text-lg focus:border-primary transition-all"
                                                    placeholder="0"
                                                />
                                            </div>

                                            <div className="w-20 text-center">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Diverg.</p>
                                                <p className={`text-lg font-black ${diff === 0 ? 'text-slate-300' : diff > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                    {diff > 0 ? '+' : ''}{diff}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="p-10 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex gap-6">
                            <button
                                onClick={() => setIsCountModalOpen(false)}
                                className="flex-1 py-5 bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-[2rem] text-[11px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all font-inter"
                            >
                                Salvar Rascunho
                            </button>
                            <button
                                onClick={handleSaveBatch}
                                className="flex-[2] py-5 bg-primary text-white rounded-[2rem] text-[11px] font-black uppercase tracking-widest shadow-2xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
                            >
                                Finalizar e Ajustar Estoque
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
