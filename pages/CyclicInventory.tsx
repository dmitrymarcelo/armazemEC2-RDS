import React, { useEffect, useMemo, useState } from 'react';
import { InventoryItem, CyclicBatch, CyclicCount } from '../types';
import { api } from '../api-client';
import { formatDateTimePtBR, splitDateTimePtBR, parseDateLike } from '../utils/dateTime';

interface CyclicInventoryProps {
  activeWarehouse: string;
  inventory: InventoryItem[];
  batches: CyclicBatch[];
  onCreateBatch: (items: { sku: string; expected: number }[]) => Promise<string | null>;
  onFinalizeBatch: (batchId: string, counts: any[]) => Promise<void>;
  onClassifyABC: () => Promise<void>;
}

interface CountRow extends CyclicCount {
  inputKey: string;
  sourceId?: string;
}

interface DivergenceRow {
  id: string;
  batchId: string;
  sku: string;
  expectedQty: number;
  countedQty: number;
  diff: number;
  severity: 'baixa' | 'media' | 'alta';
  countedAt?: string;
}

const formatDate = (value?: string) => splitDateTimePtBR(value, '--/--/----', '--:--').date;
const formatDateTime = (value?: string) => formatDateTimePtBR(value, '--/--/---- --:--');

const clamp = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

const accuracyClass = (value: number) => {
  if (value >= 99) return 'text-emerald-500';
  if (value >= 95) return 'text-amber-500';
  return 'text-red-500';
};

const SEVERITY_CLASS: Record<DivergenceRow['severity'], string> = {
  alta: 'bg-red-100 text-red-600',
  media: 'bg-amber-100 text-amber-600',
  baixa: 'bg-slate-100 text-slate-600',
};

export const CyclicInventory: React.FC<CyclicInventoryProps> = ({
  activeWarehouse,
  inventory,
  batches,
  onCreateBatch,
  onFinalizeBatch,
  onClassifyABC,
}) => {
  const [activeTab, setActiveTab] = useState<'batches' | 'accuracy'>('batches');
  const [isNewBatchModalOpen, setIsNewBatchModalOpen] = useState(false);
  const [isCountModalOpen, setIsCountModalOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<CyclicBatch | null>(null);
  const [counts, setCounts] = useState<CountRow[]>([]);
  const [countInputs, setCountInputs] = useState<Record<string, string>>({});
  const [divergences, setDivergences] = useState<DivergenceRow[]>([]);
  const [isLoadingDivergences, setIsLoadingDivergences] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);

  const abc = useMemo(() => {
    const A = inventory.filter((item) => item.abcCategory === 'A').length;
    const B = inventory.filter((item) => item.abcCategory === 'B').length;
    const C = inventory.filter((item) => item.abcCategory === 'C').length;
    const total = Math.max(inventory.length, 1);
    return {
      A,
      B,
      C,
      ratioA: clamp((A / total) * 100),
      ratioB: clamp((B / total) * 100),
      ratioC: clamp((C / total) * 100),
    };
  }, [inventory]);

  const abcBars = useMemo(
    () => [
      { label: 'Classe A', count: abc.A, ratio: abc.ratioA, color: 'bg-emerald-500' },
      { label: 'Classe B', count: abc.B, ratio: abc.ratioB, color: 'bg-amber-500' },
      { label: 'Classe C', count: abc.C, ratio: abc.ratioC, color: 'bg-slate-500' },
    ],
    [abc]
  );

  const avgAccuracy = useMemo(() => {
    const done = batches.filter((batch) => batch.status === 'concluido' && Number.isFinite(batch.accuracyRate));
    if (done.length === 0) return 100;
    return done.reduce((acc, batch) => acc + Number(batch.accuracyRate || 0), 0) / done.length;
  }, [batches]);

  const suggestedItems = useMemo(() => {
    const ranked = inventory
      .map((item) => {
        const parsedLastCount = parseDateLike(item.lastCountedAt);
        const daysWithoutCount = parsedLastCount
          ? Math.floor((Date.now() - parsedLastCount.getTime()) / (24 * 60 * 60 * 1000))
          : 999;
        const abcWeight = item.abcCategory === 'A' ? 3 : item.abcCategory === 'B' ? 2 : 1;
        const lowStock = item.quantity <= item.minQty ? 1 : 0;
        return {
          sku: item.sku,
          expected: item.quantity,
          score: abcWeight * 1000 + daysWithoutCount * 10 + lowStock * 100,
        };
      })
      .sort((a, b) => b.score - a.score);

    return ranked.slice(0, Math.min(10, ranked.length)).map(({ sku, expected }) => ({ sku, expected }));
  }, [inventory]);

  useEffect(() => {
    if (activeTab !== 'accuracy') return;

    let cancelled = false;
    const run = async () => {
      setIsLoadingDivergences(true);
      try {
        const scopedBatches = batches.slice(0, 40);
        if (scopedBatches.length === 0) {
          if (!cancelled) setDivergences([]);
          return;
        }

        const responses = await Promise.all(
          scopedBatches.map((batch) =>
            api
              .from('cyclic_counts')
              .select('*')
              .eq('batch_id', batch.id)
          )
        );

        const result: DivergenceRow[] = [];
        responses.forEach((response, batchIndex) => {
          const batch = scopedBatches[batchIndex];
          const rows = Array.isArray(response?.data)
            ? response.data.filter((row: any) => {
              const rowWarehouse = String(row?.warehouse_id || '').trim();
              if (!rowWarehouse) return true;
              return rowWarehouse === (batch.warehouseId || activeWarehouse);
            })
            : [];

          rows.forEach((row: any, rowIndex: number) => {
            const expectedQty = Number(row?.expected_qty || 0);
            const countedQty = Number(row?.counted_qty);
            if (!Number.isFinite(countedQty)) return;

            const diff = countedQty - expectedQty;
            if (diff === 0) return;

            const abs = Math.abs(diff);
            const severity: DivergenceRow['severity'] =
              abs >= Math.max(5, Math.ceil(expectedQty * 0.2))
                ? 'alta'
                : abs >= Math.max(2, Math.ceil(expectedQty * 0.1))
                  ? 'media'
                  : 'baixa';

            result.push({
              id: `${batch.id}:${String(row?.sku || '')}:${String(row?.id || rowIndex)}`,
              batchId: batch.id,
              sku: String(row?.sku || ''),
              expectedQty,
              countedQty,
              diff,
              severity,
              countedAt: row?.counted_at || batch.completedAt,
            });
          });
        });

        result.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
        if (!cancelled) setDivergences(result);
      } finally {
        if (!cancelled) setIsLoadingDivergences(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [activeTab, batches, activeWarehouse]);

  const handleClassifyABC = async () => {
    setIsClassifying(true);
    try {
      await onClassifyABC();
    } finally {
      setIsClassifying(false);
    }
  };

  const handleOpenBatch = async (batch: CyclicBatch) => {
    const response = await api
      .from('cyclic_counts')
      .select('*')
      .eq('batch_id', batch.id);

    if (response?.error) {
      console.error('Falha ao carregar itens do lote:', response.error);
      return;
    }

    const rows = Array.isArray(response?.data)
      ? response.data.filter((row: any) => {
        const rowWarehouse = String(row?.warehouse_id || '').trim();
        if (!rowWarehouse) return true;
        return rowWarehouse === (batch.warehouseId || activeWarehouse);
      })
      : [];
    const usedKeys = new Set<string>();

    const mapped: CountRow[] = rows
      .map((row: any, index: number) => {
        const sourceId = row?.id ? String(row.id) : undefined;
        const baseKey = sourceId || `${batch.id}:${String(row?.sku || '')}:${index}`;
        let inputKey = baseKey;
        let duplicateCursor = 1;

        while (usedKeys.has(inputKey)) {
          inputKey = `${baseKey}:${duplicateCursor}`;
          duplicateCursor += 1;
        }
        usedKeys.add(inputKey);

        const expectedQty = Number(row?.expected_qty || 0);
        const parsedCount = Number(row?.counted_qty);
        return {
          id: inputKey,
          inputKey,
          sourceId,
          batchId: String(row?.batch_id || batch.id),
          sku: String(row?.sku || ''),
          expectedQty,
          countedQty: Number.isFinite(parsedCount) ? parsedCount : undefined,
          status: (row?.status || 'pendente') as CyclicCount['status'],
          notes: row?.notes || undefined,
          countedAt: row?.counted_at || undefined,
        };
      })
      .sort((a, b) => a.sku.localeCompare(b.sku));

    const inputs = mapped.reduce<Record<string, string>>((acc, row) => {
      acc[row.inputKey] = String(Number.isFinite(row.countedQty as number) ? row.countedQty : row.expectedQty);
      return acc;
    }, {});

    setCounts(mapped);
    setCountInputs(inputs);
    setSelectedBatch(batch);
    setIsCountModalOpen(true);
  };

  const handleFinalizeBatch = async () => {
    if (!selectedBatch) return;

    const finalCounts = counts.map((row) => {
      const parsed = Number.parseInt(String(countInputs[row.inputKey] || '').trim(), 10);
      const countedQty = Number.isFinite(parsed) && parsed >= 0 ? parsed : row.expectedQty;
      return {
        ...row,
        countedQty,
        status: countedQty === row.expectedQty ? 'contado' : 'ajustado',
      };
    });

    await onFinalizeBatch(selectedBatch.id, finalCounts);
    setIsCountModalOpen(false);
    setSelectedBatch(null);
    setCounts([]);
    setCountInputs({});
  };

  const createSmartBatch = async (category: 'A' | 'B' | 'C', limit: number) => {
    const selected = inventory
      .filter((item) => item.abcCategory === category)
      .sort((a, b) => {
        const dateA = parseDateLike(a.lastCountedAt)?.getTime() ?? Number.NaN;
        const dateB = parseDateLike(b.lastCountedAt)?.getTime() ?? Number.NaN;
        if (!Number.isFinite(dateA) && !Number.isFinite(dateB)) return 0;
        if (!Number.isFinite(dateA)) return -1;
        if (!Number.isFinite(dateB)) return 1;
        return dateA - dateB;
      })
      .slice(0, limit)
      .map((item) => ({ sku: item.sku, expected: item.quantity }));

    if (selected.length === 0) return;
    await onCreateBatch(selected);
    setIsNewBatchModalOpen(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-800 dark:text-white">Inventário Cíclico</h2>
          <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Gestão contínua de acuracidade</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => void handleClassifyABC()}
            disabled={isClassifying}
            className="px-6 py-3 rounded-2xl border border-slate-200 text-xs font-black uppercase tracking-widest hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isClassifying ? 'Reclassificando...' : 'Reclassificar ABC'}
          </button>
          <button
            onClick={() => setIsNewBatchModalOpen(true)}
            className="px-6 py-3 rounded-2xl bg-primary text-white text-xs font-black uppercase tracking-widest"
          >
            Novo Lote de Contagem
          </button>
        </div>
      </div>

      <div className="p-5 rounded-2xl border border-primary/20 bg-primary/5 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-primary">Sugestão automática</p>
          <p className="text-sm font-black text-slate-700">
            Lote sugerido com {suggestedItems.length} itens priorizados por classe ABC e tempo sem contagem.
          </p>
        </div>
        <button
          onClick={() => void onCreateBatch(suggestedItems)}
          disabled={suggestedItems.length === 0}
          className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
        >
          Criar Lote Sugerido
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 bg-white rounded-2xl border">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
            Classificação ABC por criticidade
          </p>
          <div className="grid grid-cols-3 gap-3 h-28 items-end">
            {abcBars.map((entry) => (
              <div key={entry.label} className="h-full rounded-2xl border border-slate-200/70 bg-slate-50 p-1 flex items-end">
                <div
                  className={`${entry.color} w-full rounded-xl transition-all duration-300`}
                  style={{ height: `${Math.max(12, Math.round(entry.ratio))}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            {abcBars.map((entry) => (
              <div key={`${entry.label}-info`}>
                <p className="text-[10px] font-black text-slate-700">{entry.label}</p>
                <p className="text-[10px] font-bold text-slate-400">
                  {entry.count} itens ({Math.round(entry.ratio)}%)
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 bg-white rounded-2xl border">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Acuracidade média</p>
          <h3 className={`text-5xl font-black ${accuracyClass(avgAccuracy)}`}>{avgAccuracy.toFixed(1)}%</h3>
        </div>

        <div className="p-6 bg-slate-900 text-white rounded-2xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1">Status global</p>
          <p className="text-xl font-black">Lotes abertos: {batches.filter((batch) => batch.status === 'aberto').length}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="p-4 border-b flex gap-6">
          <button
            onClick={() => setActiveTab('batches')}
            className={`text-xs font-black uppercase tracking-widest ${activeTab === 'batches' ? 'text-primary' : 'text-slate-400'}`}
          >
            Lotes Recentes
          </button>
          <button
            onClick={() => setActiveTab('accuracy')}
            className={`text-xs font-black uppercase tracking-widest ${activeTab === 'accuracy' ? 'text-primary' : 'text-slate-400'}`}
          >
            Mapa de Divergências
          </button>
        </div>

        {activeTab === 'batches' && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {batches.map((batch) => (
              <div key={batch.id} className="p-4 rounded-2xl border">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black uppercase">#{batch.id}</span>
                  <span
                    className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${batch.status === 'aberto' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}
                  >
                    {batch.status}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-500">Data: {formatDate(batch.scheduledDate)}</p>
                <p className="text-xs font-bold text-slate-500">Itens: {batch.totalItems}</p>
                {batch.status === 'aberto' ? (
                  <button
                    onClick={() => void handleOpenBatch(batch)}
                    className="mt-3 w-full py-2 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest"
                  >
                    Iniciar Contagem
                  </button>
                ) : (
                  <div className="mt-3 text-[10px] font-black text-slate-400 uppercase">Concluído</div>
                )}
              </div>
            ))}
            {batches.length === 0 && (
              <div className="col-span-full p-10 text-center text-xs font-black uppercase text-slate-400">
                Nenhum lote criado
              </div>
            )}
          </div>
        )}

        {activeTab === 'accuracy' && (
          <div className="p-4">
            {isLoadingDivergences && (
              <p className="text-xs font-black uppercase text-slate-400">Carregando divergências...</p>
            )}
            {!isLoadingDivergences && divergences.length === 0 && (
              <p className="text-xs font-black uppercase text-slate-400">Sem divergências registradas.</p>
            )}
            {!isLoadingDivergences && divergences.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b">
                      <th className="px-3 py-2">Lote</th>
                      <th className="px-3 py-2">SKU</th>
                      <th className="px-3 py-2 text-right">Esperado</th>
                      <th className="px-3 py-2 text-right">Contado</th>
                      <th className="px-3 py-2 text-right">Diverg.</th>
                      <th className="px-3 py-2">Severidade</th>
                      <th className="px-3 py-2">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {divergences.map((row) => (
                      <tr key={row.id} className="border-b">
                        <td className="px-3 py-2 text-xs font-black">#{row.batchId}</td>
                        <td className="px-3 py-2 text-xs font-black">{row.sku}</td>
                        <td className="px-3 py-2 text-right font-black">{row.expectedQty}</td>
                        <td className="px-3 py-2 text-right font-black">{row.countedQty}</td>
                        <td className={`px-3 py-2 text-right font-black ${row.diff > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {row.diff > 0 ? '+' : ''}
                          {row.diff}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${SEVERITY_CLASS[row.severity]}`}>
                            {row.severity}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs font-bold">{formatDateTime(row.countedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {isNewBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setIsNewBatchModalOpen(false)} />
          <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl p-8 space-y-4">
            <h3 className="text-2xl font-black">Novo Lote Inteligente</h3>
            {[
              { label: 'Giro Classe A (5 itens)', category: 'A' as const, limit: 5 },
              { label: 'Médio Giro Classe B (10 itens)', category: 'B' as const, limit: 10 },
              { label: 'Giro Lento Classe C (15 itens)', category: 'C' as const, limit: 15 },
            ].map((entry) => (
              <button
                key={entry.label}
                onClick={() => void createSmartBatch(entry.category, entry.limit)}
                className="w-full p-4 border rounded-2xl text-left font-black flex items-center justify-between hover:bg-slate-50"
              >
                <span>{entry.label}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="size-5 text-slate-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </button>
            ))}
            <button onClick={() => setIsNewBatchModalOpen(false)} className="w-full py-3 text-[10px] font-black uppercase text-slate-400">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {isCountModalOpen && selectedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setIsCountModalOpen(false)} />
          <div className="relative bg-white w-full max-w-4xl h-[80vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-6 border-b">
              <h3 className="text-2xl font-black">Executando Lote #{selectedBatch.id}</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {counts.map((row) => {
                const parsed = Number.parseInt(String(countInputs[row.inputKey] || '').trim(), 10);
                const counted = Number.isFinite(parsed) ? parsed : row.expectedQty;
                const diff = counted - row.expectedQty;
                const item = inventory.find((entry) => entry.sku === row.sku);
                return (
                  <div key={row.inputKey} className="p-4 rounded-2xl border bg-slate-50 flex items-center gap-4">
                    <div className="flex-1">
                      <p className="text-xs font-black text-primary">
                        {row.sku} | {item?.location || 'S/ LOC'}
                      </p>
                      <p className="text-sm font-black">{item?.name || 'Produto não encontrado'}</p>
                    </div>
                    <div className="text-center min-w-20">
                      <p className="text-[10px] font-black uppercase text-slate-400">Esperado</p>
                      <p className="font-black">{row.expectedQty}</p>
                    </div>
                    <div className="min-w-24">
                      <p className="text-[10px] font-black uppercase text-slate-400 text-center">Contagem</p>
                      <input
                        type="number"
                        min={0}
                        value={countInputs[row.inputKey] ?? ''}
                        onChange={(event) =>
                          setCountInputs((prev) => ({
                            ...prev,
                            [row.inputKey]: event.target.value,
                          }))
                        }
                        className="w-full border-2 rounded-xl px-3 py-2 text-center font-black"
                      />
                    </div>
                    <div className="text-center min-w-16">
                      <p className="text-[10px] font-black uppercase text-slate-400">Diverg.</p>
                      <p className={`font-black ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                        {diff > 0 ? '+' : ''}
                        {diff}
                      </p>
                    </div>
                  </div>
                );
              })}
              {counts.length === 0 && (
                <div className="p-8 rounded-2xl border border-dashed text-center text-xs font-black uppercase text-slate-400">
                  Sem itens para contagem neste lote.
                </div>
              )}
            </div>
            <div className="p-6 border-t flex gap-4">
              <button onClick={() => setIsCountModalOpen(false)} className="flex-1 py-3 rounded-2xl bg-slate-100 text-[10px] font-black uppercase">
                Salvar Rascunho
              </button>
              <button onClick={() => void handleFinalizeBatch()} className="flex-[2] py-3 rounded-2xl bg-primary text-white text-[10px] font-black uppercase">
                Finalizar e Ajustar Estoque
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
