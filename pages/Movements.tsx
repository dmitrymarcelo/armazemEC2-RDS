import React, { useState } from 'react';
import { Movement } from '../types';
import { PaginationBar } from '../components/PaginationBar';
import { splitDateTimePtBR } from '../utils/dateTime';

interface MovementsProps {
  movements: Movement[];
  currentPage: number;
  pageSize: number;
  hasNextPage: boolean;
  isPageLoading: boolean;
  onPageChange: (page: number) => void;
}

export const Movements: React.FC<MovementsProps> = ({
  movements,
  currentPage,
  pageSize,
  hasNextPage,
  isPageLoading,
  onPageChange,
}) => {
  const [filter, setFilter] = useState<'todos' | 'entrada' | 'saida' | 'ajuste'>('todos');

  const filteredMovements = filter === 'todos' ? movements : movements.filter((m) => m.type === filter);

  const stats = {
    entradas: movements.filter((m) => m.type === 'entrada').length,
    saidas: movements.filter((m) => m.type === 'saida').length,
    ajustes: movements.filter((m) => m.type === 'ajuste').length,
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-slate-800 dark:text-white">Movimentações do Sistema</h2>
          <p className="text-slate-500 text-sm font-medium mt-1">Registro cronológico de alterações de saldo e endereçamento.</p>
        </div>

        <div className="flex gap-4">
          <div className="bg-white dark:bg-slate-900 px-6 py-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="size-10 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-xl flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 7l10 10" />
                <path d="M17 7v10H7" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Entradas</p>
              <p className="text-xl font-black text-slate-800 dark:text-white">{stats.entradas}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 px-6 py-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="size-10 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17L17 7" />
                <path d="M7 7h10v10" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Saídas</p>
              <p className="text-xl font-black text-slate-800 dark:text-white">{stats.saidas}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 p-1.5 bg-slate-200/50 dark:bg-slate-800/40 rounded-2xl w-fit">
        {(['todos', 'entrada', 'saida', 'ajuste'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === t ? 'bg-white dark:bg-slate-900 text-primary shadow-sm' : 'text-slate-500'
              }`}
          >
            {t}
          </button>
        ))}
      </div>

      <PaginationBar
        currentPage={currentPage}
        currentCount={filteredMovements.length}
        pageSize={pageSize}
        hasNextPage={hasNextPage}
        isLoading={isPageLoading}
        itemLabel="itens"
        onPageChange={onPageChange}
      />

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                <th className="px-8 py-6">Data / Hora</th>
                <th className="px-8 py-6 text-center">Tipo</th>
                <th className="px-8 py-6">Produto / Cod. Produto</th>
                <th className="px-8 py-6 text-center">Qtd.</th>
                <th className="px-8 py-6">Usuario</th>
                <th className="px-8 py-6">Origem/Destino</th>
                <th className="px-8 py-6">Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredMovements.length > 0 ? (
                filteredMovements.map((move) => {
                  const when = splitDateTimePtBR(move.timestamp);
                  return (
                  <tr key={move.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                    <td className="px-8 py-5">
                      <p className="text-xs font-black text-slate-800 dark:text-white leading-tight">{when.date}</p>
                      <p className="text-[10px] text-slate-400 font-bold">{when.time}</p>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tight ${move.type === 'entrada' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                        move.type === 'saida' ? 'bg-red-100 text-red-700 border border-red-200' :
                          'bg-blue-100 text-blue-700 border border-blue-200'
                        }`}>
                        {move.type}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-sm font-black text-slate-800 dark:text-white truncate max-w-[200px] leading-tight">{move.productName || 'N/A'}</p>
                      <p className="text-[10px] font-black text-primary uppercase">Cod. Produto: {move.sku}</p>
                    </td>
                    <td className="px-8 py-5 text-center font-black text-sm">
                      <span className={move.type === 'saida' ? 'text-red-500' : move.type === 'entrada' ? 'text-emerald-600' : 'text-primary'}>
                        {move.type === 'saida' ? '-' : '+'}{Math.abs(move.quantity || 0)}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        <div className="size-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[8px] font-black uppercase text-slate-500">
                          {(move.user || 'S').charAt(0)}
                        </div>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{move.user || 'Sistema'}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-[10px] font-black px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500">
                        {move.location}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-xs font-medium text-slate-500 italic">"{move.reason}"</p>
                    </td>
                  </tr>
                )})
              ) : (
                <tr>
                  <td colSpan={7} className="px-8 py-20 text-center text-slate-400 font-black uppercase text-xs tracking-widest">
                    {isPageLoading ? 'Carregando movimentacoes...' : 'Nenhuma movimentacao registrada no periodo.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
