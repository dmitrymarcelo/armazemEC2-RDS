
import React, { useState, useMemo } from 'react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PurchaseOrder } from '../types';
import { parseDateLike } from '../utils/dateTime';

const ProcurementDashboard: React.FC<{ orders: PurchaseOrder[] }> = ({ orders }) => {
  const [periodDays, setPeriodDays] = useState(30);
  const [selectedMetric, setSelectedMetric] = useState<{ label: string; orders: PurchaseOrder[] } | null>(null);

  const stats = useMemo(() => {
    const now = new Date();
    const periodStart = new Date();
    periodStart.setDate(now.getDate() - periodDays);

    const activePOs = orders.filter(o => !['recebido', 'cancelado'].includes(o.status));
    const completedPOs = orders.filter(o => o.status === 'recebido');
    const canceledPOs = orders.filter(o => o.status === 'cancelado');
    const pausedPOs = orders.filter(o => o.status === 'pendente');

    const inFlux = activePOs.length;
    const finalizedTotal = completedPOs.length + canceledPOs.length;

    const parseDate = (d: string) => parseDateLike(d) || new Date(0);

    const ordersInPeriod = orders.filter(o => parseDate(o.requestDate) >= periodStart);

    const entered = ordersInPeriod.length;
    const finalizedInPeriod = ordersInPeriod.filter(o => o.status === 'recebido').length;
    const canceledInPeriod = ordersInPeriod.filter(o => o.status === 'cancelado').length;

    const completedInPeriod = ordersInPeriod.filter(o => o.status === 'recebido' && o.receivedAt);
    const leadTimes = completedInPeriod.map(o => {
      const start = parseDate(o.requestDate);
      const end = parseDate(o.receivedAt!);
      return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    });
    const avgLeadTime = leadTimes.length > 0 ? (leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length).toFixed(1) : '---';

    const itemsRequested = ordersInPeriod.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.qty, 0), 0);
    const avgOrderValue = ordersInPeriod.length > 0 ? (ordersInPeriod.reduce((sum, o) => sum + o.total, 0) / ordersInPeriod.length).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';
    const uniqueVendors = new Set(ordersInPeriod.map(o => o.vendor)).size;
    const urgentPOs = ordersInPeriod.filter(o => o.priority === 'urgente');

    const getRanking = (key: 'requester' | 'category' | 'vendor') => {
      const counts: Record<string, number> = {};
      orders.forEach(o => {
        const val = key === 'requester' ? o.requester : key === 'category' ? o.items[0]?.category : o.vendor;
        if (val) counts[val] = (counts[val] || 0) + 1;
      });
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    };

    return {
      active: activePOs.length,
      activeList: activePOs,
      completed: completedPOs.length,
      completedList: completedPOs,
      canceled: canceledPOs.length,
      canceledList: canceledPOs,
      paused: pausedPOs.length,
      pausedList: pausedPOs,
      inFlux,
      finalizedTotal,
      entered,
      enteredList: ordersInPeriod,
      finalizedInPeriod,
      canceledInPeriod,
      avgLeadTime,
      itemsRequested,
      avgOrderValue,
      uniqueVendors,
      urgentCount: urgentPOs.length,
      urgentList: urgentPOs,
      leaderRank: getRanking('requester'),
      categoryRank: getRanking('category'),
      vendorRank: getRanking('vendor')
    };
  }, [orders, periodDays]);

  return (
    <div className="space-y-8 mt-12 pt-12 border-t border-slate-200 dark:border-slate-800 animate-in fade-in duration-700">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1.5 h-6 bg-primary rounded-full" />
        <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-wider">Analytics de Suprimentos</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Ativos', value: stats.active, items: stats.activeList, color: 'text-blue-500', bg: 'bg-blue-500/10', ring: 'ring-blue-500/20' },
          { label: 'Pausados', value: stats.paused, items: stats.pausedList, color: 'text-amber-500', bg: 'bg-amber-500/10', ring: 'ring-amber-500/20' },
          { label: 'Cancelados', value: stats.canceled, items: stats.canceledList, color: 'text-red-500', bg: 'bg-red-500/10', ring: 'ring-red-500/20' },
          { label: 'Concluídos', value: stats.completed, items: stats.completedList, color: 'text-emerald-500', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20' },
        ].map((item, i) => (
          <button
            key={i}
            onClick={() => setSelectedMetric({ label: item.label, orders: item.items })}
            className="group bg-white dark:bg-[#1a222c] p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center text-center relative overflow-hidden transition-all hover:shadow-xl hover:shadow-primary/5 hover:scale-[1.02] active:scale-95"
          >
            <div className={`absolute -top-4 -right-4 size-20 ${item.bg} rounded-full transition-all group-hover:scale-110`} />
            <div className={`size-12 rounded-2xl ${item.bg} ring-4 ${item.ring} flex items-center justify-center mb-4 z-10`}>
              <span className={`text-[10px] font-black ${item.color} uppercase tracking-tighter`}>{item.label.substring(0, 3)}</span>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 z-10">Total {item.label}</p>
            <h4 className="text-4xl font-black text-slate-800 dark:text-white z-10">{item.value}</h4>
            <div className="mt-4 px-4 py-1.5 bg-slate-50 dark:bg-slate-800/50 rounded-full opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 z-10">
              <span className="text-[8px] font-black text-primary uppercase tracking-widest">Explorar Dados</span>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <button
            onClick={() => setSelectedMetric({ label: 'Cards no Fluxo', orders: stats.activeList })}
            className="w-full group bg-white dark:bg-[#1a222c] p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm text-center transition-all hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
          >
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cards no Fluxo</p>
            <h4 className="text-5xl font-black text-slate-800 dark:text-white">{stats.inFlux}</h4>
            <span className="text-[8px] font-black text-primary uppercase mt-2 tracking-widest opacity-50 group-hover:opacity-100">Click p/ Detalhes</span>
          </button>
          <button
            onClick={() => setSelectedMetric({ label: 'Cards Finalizados', orders: [...stats.completedList, ...stats.canceledList] })}
            className="w-full group bg-white dark:bg-[#1a222c] p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm text-center transition-all hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
          >
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cards Finalizados</p>
            <h4 className="text-5xl font-black text-slate-800 dark:text-white">{stats.finalizedTotal}</h4>
            <span className="text-[8px] font-black text-primary uppercase mt-2 tracking-widest opacity-50 group-hover:opacity-100">Click p/ Detalhes</span>
          </button>
        </div>

        <div className="lg:col-span-9 bg-white dark:bg-[#1a222c] p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center justify-between mb-6">
                <h5 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest">Líderes</h5>
              </div>
              <div className="space-y-4">
                {stats.leaderRank.map(([name, count], i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between text-[9px] font-black uppercase tracking-tight">
                      <span className="text-slate-600 dark:text-slate-400 truncate max-w-[120px]">{name}</span>
                      <span className="text-slate-800 dark:text-white">{count} CARDS</span>
                    </div>
                    <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(count / (stats.leaderRank[0]?.[1] || 1)) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-6">
                <h5 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest">Equipes (Deptos)</h5>
              </div>
              <div className="space-y-4">
                {stats.categoryRank.map(([category, count], i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between text-[9px] font-black uppercase tracking-tight">
                      <span className="text-slate-600 dark:text-slate-400 truncate max-w-[120px]">{category || 'Geral'}</span>
                      <span className="text-slate-800 dark:text-white">{count} CARDS</span>
                    </div>
                    <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${(count / (stats.categoryRank[0]?.[1] || 1)) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-6">
                <h5 className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest">Fornecedores Top</h5>
              </div>
              <div className="space-y-4">
                {stats.vendorRank.map(([vendor, count], i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between text-[9px] font-black uppercase tracking-tight">
                      <span className="text-slate-600 dark:text-slate-400 truncate max-w-[120px]">{vendor}</span>
                      <span className="text-slate-800 dark:text-white">{count} CARDS</span>
                    </div>
                    <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(count / (stats.vendorRank[0]?.[1] || 1)) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-50/50 dark:bg-slate-800/10 p-6 rounded-[2rem] border border-slate-200/50 dark:border-slate-800">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-1 h-4 bg-primary rounded-full" />
            <h5 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-[0.2em]">Indicadores do fluxo no período</h5>
          </div>
          <select
            value={periodDays}
            onChange={(e) => setPeriodDays(Number(e.target.value))}
            className="bg-white dark:bg-[#1a222c] border-2 border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:border-primary transition-all cursor-pointer"
          >
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Cards Inseridos', value: stats.entered, items: stats.enteredList, color: 'bg-blue-500', help: 'Novos pedidos criados' },
            { label: 'Cards Finalizados', value: stats.finalizedInPeriod, items: stats.completedList.filter(o => stats.enteredList.includes(o)), color: 'bg-emerald-500', help: 'Pedidos recebidos' },
            { label: 'Cards Cancelados', value: stats.canceledInPeriod, items: stats.canceledList.filter(o => stats.enteredList.includes(o)), color: 'bg-red-500', help: 'Pedidos cancelados' },
            { label: 'Lead Time Médio', value: `${stats.avgLeadTime} d`, color: 'bg-amber-500', help: 'Média de ciclo' },
            { label: 'Itens Solicitados', value: stats.itemsRequested, color: 'bg-indigo-500', help: 'Soma de quantidades' },
            { label: 'Ticket Médio (PO)', value: stats.avgOrderValue, color: 'bg-violet-500', help: 'Valor médio p/ pedido' },
            { label: 'Mix Fornecedores', value: stats.uniqueVendors, color: 'bg-slate-500', help: 'Fornecedores distintos' },
            { label: 'Pedidos Urgentes', value: stats.urgentCount, items: stats.urgentList, color: 'bg-rose-500', help: 'Prioridade Urgente' },
          ].map((item, i) => (
            <button
              key={i}
              onClick={() => item.items && setSelectedMetric({ label: item.label, orders: item.items })}
              className="group bg-white dark:bg-[#1a222c] p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all text-left relative overflow-hidden active:scale-95"
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.label}</p>
                <div className={`size-1.5 rounded-full ${item.color} animate-pulse`} />
              </div>
              <h4 className="text-2xl font-black text-slate-800 dark:text-white mb-2">{item.value}</h4>
              <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-2">
                <div className={`h-full ${item.color} opacity-30 transition-all group-hover:opacity-100`} style={{ width: '65%' }} />
              </div>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight opacity-100 group-hover:opacity-0 transition-opacity">{item.help}</p>
              <div className="absolute inset-x-0 bottom-0 py-2 bg-primary/10 flex items-center justify-center translate-y-full group-hover:translate-y-0 transition-transform">
                <span className="text-[7px] font-black text-primary uppercase tracking-tighter">Explorar Registros</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Drill-down Modal */}
      {selectedMetric && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#101922] w-full max-w-5xl max-h-[85vh] rounded-[3rem] shadow-2xl overflow-hidden border border-white/20 flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-4">
                <div className="size-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3v18h18" />
                    <path d="M8 14v4" />
                    <path d="M12 10v8" />
                    <path d="M16 6v12" />
                    <path d="M20 12v6" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Detalhes: {selectedMetric.label}</h3>
                  <p className="text-xs font-bold text-slate-400">{selectedMetric.orders.length} registros encontrados</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedMetric(null)}
                className="size-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-all active:scale-90"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="size-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              <div className="grid grid-cols-1 gap-4">
                {selectedMetric.orders.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                          <th className="px-4 py-3">ID / Data</th>
                          <th className="px-4 py-3">Fornecedor</th>
                          <th className="px-4 py-3">Produtos</th>
                          <th className="px-4 py-3">Valor Total</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                        {selectedMetric.orders.map((o, idx) => (
                          <tr key={idx} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="px-4 py-4">
                              <div className="text-xs font-black text-slate-800 dark:text-white">#{o.id}</div>
                              <div className="text-[10px] text-slate-500 font-medium">{o.requestDate}</div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">{o.vendor}</div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-wrap gap-1">
                                {o.items.slice(0, 2).map((item, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[9px] font-bold text-slate-500">
                                    {item.productName} ({item.qty})
                                  </span>
                                ))}
                                {o.items.length > 2 && (
                                  <span className="px-2 py-0.5 bg-primary/10 rounded text-[9px] font-bold text-primary">+{o.items.length - 2}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                                {o.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter`}>
                                {o.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 opacity-30 text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="size-14 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    </svg>
                    <p className="font-black uppercase tracking-widest">Nenhum pedido encontrado</p>
                  </div>
                )}
              </div>
            </div>
            <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/10 flex justify-end">
              <button
                onClick={() => setSelectedMetric(null)}
                className="px-8 py-3 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/25 active:scale-95 transition-all"
              >
                Fechar Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const productivityData = [
  { name: 'Seg', rec: 400, exp: 240 },
  { name: 'Ter', rec: 300, exp: 139 },
  { name: 'Qua', rec: 200, exp: 980 },
  { name: 'Qui', rec: 278, exp: 390 },
  { name: 'Sex', rec: 189, exp: 480 },
  { name: 'Sab', rec: 239, exp: 380 },
  { name: 'Dom', rec: 349, exp: 430 },
];

interface ReportsProps {
  orders?: PurchaseOrder[];
}

export const Reports: React.FC<ReportsProps> = ({ orders = [] }) => {
  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight">Relatórios e BI</h2>
          <p className="text-[#617589] font-medium">Análise de performance, acuracidade e throughput do armazém.</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white dark:bg-[#1a222c] border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-bold flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Ultimos 30 dias
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-[#1a222c] p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold">Produtividade de Operações</h3>
              <p className="text-xs text-gray-500 font-medium">Recebimento vs Expedição por dia</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary"></span><span className="text-[10px] font-black text-gray-500 uppercase">Recebimento</span></div>
              <div className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-purple-500"></span><span className="text-[10px] font-black text-gray-500 uppercase">Expedição</span></div>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={productivityData}>
                <defs>
                  <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#137fec" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#137fec" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#617589" fontSize={11} fontWeight="bold" axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Area type="monotone" dataKey="rec" stroke="#137fec" strokeWidth={3} fillOpacity={1} fill="url(#colorRec)" />
                <Area type="monotone" dataKey="exp" stroke="#a855f7" strokeWidth={3} fillOpacity={1} fill="url(#colorExp)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1a222c] p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <h3 className="text-lg font-bold mb-6">Acuracidade de Inventário</h3>
          <div className="space-y-6">
            {[
              { label: 'Acuracidade Geral', value: '99.85%', color: 'bg-green-500', width: '99.85%' },
              { label: 'Setor A - Eletrônicos', value: '98.20%', color: 'bg-primary', width: '98.20%' },
              { label: 'Setor B - Alimentos', value: '99.95%', color: 'bg-green-500', width: '99.95%' },
              { label: 'Setor C - Ferramentas', value: '97.50%', color: 'bg-orange-500', width: '97.50%' },
            ].map((row, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold">{row.label}</span>
                  <span className="text-sm font-black text-gray-700 dark:text-gray-300">{row.value}</span>
                </div>
                <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full ${row.color}`} style={{ width: row.width }}></div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
            <p className="text-xs font-medium text-gray-500 leading-relaxed italic">
              "A acuracidade geral está acima da meta (99.50%). O Setor C requer auditoria preventiva devido a divergências recorrentes no último trimestre."
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            label: 'Cycle Time Médio',
            value: '42 min',
            change: '-5min',
            color: 'text-blue-500',
            icon: (
              <svg xmlns="http://www.w3.org/2000/svg" className="size-10 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            )
          },
          {
            label: 'Lead Time Médio',
            value: '2.4 dias',
            change: '+0.2d',
            color: 'text-purple-500',
            icon: (
              <svg xmlns="http://www.w3.org/2000/svg" className="size-10 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13" />
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
            )
          },
          {
            label: 'Custo de Operação',
            value: 'R$ 1.42/un',
            change: '-R$ 0.12',
            color: 'text-green-500',
            icon: (
              <svg xmlns="http://www.w3.org/2000/svg" className="size-10 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            )
          },
        ].map((kpi, i) => (
          <div key={i} className="bg-white dark:bg-[#1a222c] p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex justify-between items-center">
            <div>
              <p className="text-gray-500 text-[10px] font-black uppercase mb-1 tracking-widest">{kpi.label}</p>
              <p className="text-2xl font-black">{kpi.value}</p>
              <span className="text-xs font-black text-green-600">{kpi.change}</span>
            </div>
            <div className={kpi.color}>
              {kpi.icon}
            </div>
          </div>
        ))}
      </div>
      <ProcurementDashboard orders={orders} />
    </div>
  );
};
