import React, { useState, useMemo } from 'react';
import { WorkshopKPIs, WorkOrder, Mechanic, WORK_ORDER_STATUS_LABELS, WORK_ORDER_TYPE_LABELS } from '../../types';
import { formatCurrency } from '../../utils/format';

interface WorkshopDashboardProps {
  kpis: WorkshopKPIs;
  workOrders: WorkOrder[];
  mechanics: Mechanic[];
  onNavigateToOrders: () => void;
  onNavigateToMechanics: () => void;
  onNavigateToMaintenance: () => void;
}

export const WorkshopDashboard: React.FC<WorkshopDashboardProps> = ({
  kpis,
  workOrders,
  mechanics,
  onNavigateToOrders,
  onNavigateToMechanics,
  onNavigateToMaintenance
}) => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'year'>('30d');

  // Estatísticas calculadas
  const stats = useMemo(() => {
    const statusCounts = {
      aguardando: workOrders.filter(o => o.status === 'aguardando').length,
      em_execucao: workOrders.filter(o => o.status === 'em_execucao').length,
      aguardando_pecas: workOrders.filter(o => o.status === 'aguardando_pecas').length,
      finalizada: workOrders.filter(o => o.status === 'finalizada').length
    };

    const typeCounts = {
      preventiva: workOrders.filter(o => o.type === 'preventiva').length,
      corretiva: workOrders.filter(o => o.type === 'corretiva').length,
      urgente: workOrders.filter(o => o.type === 'urgente').length
    };

    return { statusCounts, typeCounts };
  }, [workOrders]);

  // Cores por status
  const statusColors = {
    aguardando: 'bg-slate-500',
    em_execucao: 'bg-blue-500',
    aguardando_pecas: 'bg-amber-500',
    finalizada: 'bg-emerald-500'
  };

  // Cards de KPI
  const kpiCards = [
    {
      label: 'MTTR',
      value: `${kpis.mttr.toFixed(1)}h`,
      subtext: 'Tempo Médio de Reparo',
      trend: -2.1,
      trendLabel: 'vs mês anterior',
      icon: 'clock',
      color: 'blue'
    },
    {
      label: 'Disponibilidade da Frota',
      value: `${kpis.availability.toFixed(1)}%`,
      subtext: 'Meta: 95%',
      trend: 1.2,
      trendLabel: 'alcançado',
      icon: 'chart',
      color: 'emerald'
    },
    {
      label: 'Custo de Manutenção',
      value: formatCurrency(kpis.totalCost),
      subtext: 'vs meta mensal',
      trend: 5.4,
      trendLabel: '',
      icon: 'currency',
      color: 'red'
    },
    {
      label: 'OS em Andamento',
      value: kpis.openOrders.toString(),
      subtext: `${kpis.lateOrders} atrasadas`,
      trend: null,
      trendLabel: '',
      icon: 'clipboard',
      color: 'amber'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header com filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Executivo Oficina
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Visão geral da operação de manutenção
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
          {(['7d', '30d', '90d', 'year'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-blue-500 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {range === '7d' && '7 dias'}
              {range === '30d' && '30 dias'}
              {range === '90d' && '90 dias'}
              {range === 'year' && 'Este ano'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, index) => (
          <div
            key={index}
            className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {kpi.label}
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {kpi.value}
                </p>
              </div>
              <div className={`w-10 h-10 rounded-lg bg-${kpi.color}-100 dark:bg-${kpi.color}-900/30 flex items-center justify-center`}>
                <svg className={`w-5 h-5 text-${kpi.color}-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {kpi.icon === 'clock' && (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  )}
                  {kpi.icon === 'chart' && (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
                  )}
                  {kpi.icon === 'currency' && (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  )}
                  {kpi.icon === 'clipboard' && (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  )}
                </svg>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {kpi.trend !== null && (
                <span className={`text-sm font-medium ${kpi.trend >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {kpi.trend >= 0 ? '↑' : '↓'} {Math.abs(kpi.trend)}%
                </span>
              )}
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {kpi.subtext}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Preventivas vs Corretivas */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Preventivas vs Corretivas
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-sm text-slate-600 dark:text-slate-400">Preventivas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <span className="text-sm text-slate-600 dark:text-slate-400">Corretivas</span>
            </div>
          </div>
        </div>
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-3xl font-bold text-slate-900 dark:text-white">
            {kpis.preventivePercentage.toFixed(0)}%
          </span>
          <span className="text-lg text-slate-500 dark:text-slate-400">
            / {(100 - kpis.preventivePercentage).toFixed(0)}%
          </span>
        </div>
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
            style={{ width: `${kpis.preventivePercentage}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Meta: 70% preventivas / 30% corretivas
        </p>
      </div>

      {/* Grid de análises */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Ordens por Status */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Ordens de Serviço por Status
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Total de {workOrders.length} OS no período
              </p>
            </div>
            <button 
              onClick={onNavigateToOrders}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Ver todas
            </button>
          </div>

          {/* Visualização tipo Kanban resumido */}
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(stats.statusCounts).map(([status, count]) => (
              <button
                key={status}
                onClick={onNavigateToOrders}
                className="flex flex-col items-center p-4 rounded-lg bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <div className={`w-12 h-12 ${statusColors[status as keyof typeof statusColors]} rounded-xl flex items-center justify-center mb-2 shadow-sm`}>
                  <span className="text-lg font-bold text-white">{count}</span>
                </div>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400 text-center">
                  {WORK_ORDER_STATUS_LABELS[status as keyof typeof WORK_ORDER_STATUS_LABELS]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Distribuição por Tipo */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Distribuição por Tipo
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Análise de manutenções
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {Object.entries(stats.typeCounts).map(([type, count]) => {
              const total = (Object.values(stats.typeCounts) as number[]).reduce((a, b) => a + b, 0);
              const countValue = Number(count || 0);
              const percentage = total > 0 ? (countValue / total) * 100 : 0;
              
              const colors = {
                preventiva: 'bg-blue-500',
                corretiva: 'bg-amber-500',
                urgente: 'bg-red-500'
              };
              
              return (
                <div key={type} className="flex items-center gap-4">
                  <div className="w-32">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {WORK_ORDER_TYPE_LABELS[type as keyof typeof WORK_ORDER_TYPE_LABELS]}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${colors[type as keyof typeof colors]} rounded-full transition-all duration-500`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-16 text-right">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {countValue}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">
                      ({percentage.toFixed(0)}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Equipe e Disponibilidade */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Mecânicos */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Equipe Técnica
            </h3>
            <button 
              onClick={onNavigateToMechanics}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Gerenciar
            </button>
          </div>
          <div className="flex items-center justify-center py-4">
            <div className="text-center">
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-4xl font-bold text-emerald-500">{kpis.mechanicsAvailable}</span>
                <span className="text-lg text-slate-400">/</span>
                <span className="text-2xl text-slate-600 dark:text-slate-400">{mechanics.length}</span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Mecânicos disponíveis
              </p>
            </div>
          </div>
          <div className="space-y-2 mt-4">
            {mechanics.slice(0, 3).map((mechanic) => (
              <div key={mechanic.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${mechanic.status === 'disponivel' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{mechanic.name}</span>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {mechanic.currentWorkOrders.length} OS
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Próximas Manutenções */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Próximas Manutenções
            </h3>
            <button 
              onClick={onNavigateToMaintenance}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Ver agenda
            </button>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
              <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-white">Revisão 50.000 km</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">BRA-2E19 - Volvo FH 540</p>
              </div>
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Amanhã</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
              <div className="w-10 h-10 rounded-lg bg-slate-400 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-white">Troca de Óleo</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">OPJ-9812 - Mercedes Actros</p>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">3 dias</span>
            </div>
          </div>
        </div>

        {/* Alertas */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Alertas
          </h3>
          <div className="space-y-3">
            {kpis.lateOrders > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800">
                <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {kpis.lateOrders} OS em atraso
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Requer atenção imediata
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800">
              <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  Estoque de peças crítico
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  3 itens abaixo do mínimo
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
