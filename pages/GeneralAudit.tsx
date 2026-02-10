import React, { useEffect, useMemo, useState } from 'react';
import { PaginationBar } from '../components/PaginationBar';
import { api } from '../api-client';
import { formatDateTimePtBR, splitDateTimePtBR } from '../utils/dateTime';

interface GeneralAuditProps {
  activeWarehouse: string;
}

interface AuditLogEntry {
  id: string;
  module?: string;
  entity?: string;
  entity_id?: string;
  action?: string;
  actor?: string;
  actor_id?: string;
  warehouse_id?: string | null;
  before_data?: unknown;
  after_data?: unknown;
  meta?: unknown;
  created_at?: string;
}

interface AuditFilters {
  q: string;
  module: string;
  entity: string;
  action: string;
  actor: string;
  plate: string;
  warehouse_id: string;
  include_global: boolean;
  from: string;
  to: string;
}

const PAGE_SIZE = 40;
const FALLBACK_FETCH_LIMIT = 2000;

const MODULE_LABELS: Record<string, string> = {
  recebimento: 'Recebimento',
  movements: 'Movimentações',
  movimentacoes: 'Movimentações',
  inventory: 'Estoque',
  material_requests: 'Solicitações SA',
  purchase_orders: 'Pedidos de Compra',
  cyclic_batches: 'Inventário Cíclico',
  cyclic_counts: 'Inventário Cíclico',
  users: 'Gestão de Usuários',
  vendors: 'Cadastro Geral',
  vehicles: 'Cadastro Geral',
  cost_centers: 'Cadastro Geral',
  notifications: 'Notificações',
};

const ACTION_STYLES: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
  receipt_finalize: 'bg-amber-100 text-amber-700',
  inventory_increment: 'bg-purple-100 text-purple-700',
};

const ACTION_LABELS: Record<string, string> = {
  create: 'Criação',
  update: 'Atualização',
  delete: 'Exclusão',
  receipt_finalize: 'Finalização de Recebimento',
  inventory_increment: 'Incremento de Estoque',
};

const createInitialFilters = (warehouseId: string): AuditFilters => ({
  q: '',
  module: '',
  entity: '',
  action: '',
  actor: '',
  plate: '',
  warehouse_id: 'all',
  include_global: true,
  from: '',
  to: '',
});

const safeJsonString = (value: unknown) => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '-';
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return trimmed;
    }
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const getAuditSummary = (log: AuditLogEntry) => {
  const meta = log.meta && typeof log.meta === 'object' ? (log.meta as Record<string, unknown>) : null;

  if (meta?.po_id) {
    return `PO ${String(meta.po_id)}`;
  }

  if (log.entity_id) {
    return `ID ${log.entity_id}`;
  }

  if (meta && Object.keys(meta).length > 0) {
    const firstEntry = Object.entries(meta)[0];
    return `${firstEntry[0]}: ${String(firstEntry[1])}`;
  }

  return 'Sem resumo adicional';
};

const toInputDate = (value: string) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  const direct = new Date(trimmed);
  if (!Number.isNaN(direct.getTime())) {
    return direct.toISOString().slice(0, 10);
  }

  return '';
};

const normalizeText = (value: unknown) => String(value || '').trim().toLowerCase();
const normalizePlateToken = (value: unknown) => String(value || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

const parseDateMs = (value: unknown) => {
  const parsed = new Date(String(value || '')).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const mapMovementRowsToAuditEntries = (rows: any[]): AuditLogEntry[] =>
  rows.map((row, index) => ({
    id: `mov-${String(row?.id || index)}`,
    module: 'movements',
    entity: 'movements',
    entity_id: String(row?.id || ''),
    action: 'create',
    actor: String(row?.user || 'Sistema'),
    actor_id: null,
    warehouse_id: row?.warehouse_id || null,
    before_data: null,
    after_data: row,
    meta: {
      source: 'movements-fallback',
      reason: row?.reason || null,
      order_id: row?.order_id || null,
      sku: row?.sku || null,
    },
    created_at: row?.timestamp || row?.created_at || null,
  }));

const applyAuditFiltersLocally = (rows: AuditLogEntry[], filters: AuditFilters): AuditLogEntry[] => {
  const queryTerm = normalizeText(filters.q);
  const moduleTerm = normalizeText(filters.module);
  const entityTerm = normalizeText(filters.entity);
  const actionTerm = normalizeText(filters.action);
  const actorTerm = normalizeText(filters.actor);
  const plateTerm = normalizePlateToken(filters.plate);
  const warehouseTerm = normalizeText(filters.warehouse_id);
  const fromInput = filters.from && !filters.from.includes('T') ? `${filters.from}T00:00:00.000` : filters.from;
  const toInput = filters.to && !filters.to.includes('T') ? `${filters.to}T23:59:59.999` : filters.to;
  const fromMs = fromInput ? parseDateMs(fromInput) : Number.NaN;
  const toMs = toInput ? parseDateMs(toInput) : Number.NaN;

  return rows.filter((row) => {
    const rowModule = normalizeText(row.module);
    const rowEntity = normalizeText(row.entity);
    const rowAction = normalizeText(row.action);
    const rowActor = normalizeText(row.actor);
    const rowWarehouse = String(row.warehouse_id || '').trim();

    if (moduleTerm && !rowModule.includes(moduleTerm)) return false;
    if (entityTerm && !rowEntity.includes(entityTerm)) return false;
    if (actionTerm && !rowAction.includes(actionTerm)) return false;
    if (actorTerm && !rowActor.includes(actorTerm)) return false;

    if (plateTerm) {
      const plateHaystack = normalizePlateToken([
        (row?.meta as any)?.plate,
        (row?.before_data as any)?.plate,
        (row?.after_data as any)?.plate,
        JSON.stringify(row?.meta || {}),
        JSON.stringify(row?.before_data || {}),
        JSON.stringify(row?.after_data || {}),
      ].join(' '));
      if (!plateHaystack.includes(plateTerm)) return false;
    }

    if (warehouseTerm && warehouseTerm !== 'all') {
      const warehouseMatches = rowWarehouse === filters.warehouse_id;
      const isGlobal = rowWarehouse.length === 0;
      if (!(warehouseMatches || (filters.include_global && isGlobal))) return false;
    }

    const rowDateMs = parseDateMs(row.created_at);
    if (filters.from && Number.isNaN(rowDateMs)) return false;
    if (filters.to && Number.isNaN(rowDateMs)) return false;
    if (!Number.isNaN(fromMs) && rowDateMs < fromMs) return false;
    if (!Number.isNaN(toMs) && rowDateMs > toMs) return false;

    if (queryTerm) {
      const haystack = [
        row.id,
        row.module,
        row.entity,
        row.entity_id,
        row.action,
        row.actor,
        row.actor_id,
        row.warehouse_id,
        JSON.stringify(row.meta || {}),
        JSON.stringify(row.before_data || {}),
        JSON.stringify(row.after_data || {}),
      ]
        .join(' ')
        .toLowerCase();

      if (!haystack.includes(queryTerm)) return false;
    }

    return true;
  });
};

const paginateRows = (rows: AuditLogEntry[], page: number, pageSize: number) => {
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);
  return {
    data: pageRows,
    total: rows.length,
    has_more: start + pageRows.length < rows.length,
    next_offset: start + pageRows.length < rows.length ? start + pageRows.length : null,
  };
};

const isSearchEndpointMissing = (response: any) => {
  const status = Number(response?.httpStatus || 0);
  const message = normalizeText(response?.error);
  return status === 404 || message.includes('not found') || message.includes('cannot get /audit_logs/search');
};

export const GeneralAudit: React.FC<GeneralAuditProps> = ({ activeWarehouse }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [rows, setRows] = useState<AuditLogEntry[]>([]);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [totalRows, setTotalRows] = useState(0);
  const [selectedRow, setSelectedRow] = useState<AuditLogEntry | null>(null);

  const [draftFilters, setDraftFilters] = useState<AuditFilters>(() => createInitialFilters(activeWarehouse));
  const [filters, setFilters] = useState<AuditFilters>(() => createInitialFilters(activeWarehouse));

  useEffect(() => {
    setDraftFilters((prev) => (prev.warehouse_id === 'all' ? prev : { ...prev, warehouse_id: activeWarehouse }));
    setFilters((prev) => (prev.warehouse_id === 'all' ? prev : { ...prev, warehouse_id: activeWarehouse }));
    setCurrentPage(1);
  }, [activeWarehouse]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError('');
      setNotice('');

      try {
        let query = api.from('audit_logs/search').limit(PAGE_SIZE).offset((currentPage - 1) * PAGE_SIZE);

        if (filters.q.trim()) query = query.eq('q', filters.q.trim());
        if (filters.module) query = query.eq('module', filters.module);
        if (filters.entity.trim()) query = query.eq('entity', filters.entity.trim());
        if (filters.action) query = query.eq('action', filters.action);
        if (filters.actor.trim()) query = query.eq('actor', filters.actor.trim());
        if (filters.plate.trim()) query = query.eq('plate', filters.plate.trim());
        if (filters.warehouse_id) query = query.eq('warehouse_id', filters.warehouse_id);
        query = query.eq('include_global', filters.include_global ? 'true' : 'false');

        if (filters.from) query = query.eq('from', filters.from);
        if (filters.to) {
          const endDate = new Date(`${filters.to}T23:59:59.999`);
          query = query.eq('to', Number.isNaN(endDate.getTime()) ? filters.to : endDate.toISOString());
        }

        let response = await query;
        if (cancelled) return;

        if (isSearchEndpointMissing(response)) {
          const fallbackAuditResponse = await api
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(FALLBACK_FETCH_LIMIT);

          let compatibilityRows: AuditLogEntry[] = [];

          if (!fallbackAuditResponse?.error && Array.isArray(fallbackAuditResponse?.data)) {
            compatibilityRows = fallbackAuditResponse.data as AuditLogEntry[];
          }

          if (compatibilityRows.length === 0) {
            const fallbackMovementResponse = await api
              .from('movements')
              .select('*')
              .order('timestamp', { ascending: false })
              .limit(FALLBACK_FETCH_LIMIT);

            if (!fallbackMovementResponse?.error && Array.isArray(fallbackMovementResponse?.data)) {
              compatibilityRows = mapMovementRowsToAuditEntries(fallbackMovementResponse.data as any[]);
              setNotice('Modo compatível ativo: exibindo eventos a partir de Movimentações.');
            }
          } else {
            setNotice('Modo compatível ativo: endpoint de busca avançada indisponível, usando consulta local.');
          }

          const filteredRows = applyAuditFiltersLocally(compatibilityRows, filters).sort((a, b) => {
            const aMs = parseDateMs(a.created_at);
            const bMs = parseDateMs(b.created_at);
            if (Number.isNaN(aMs) && Number.isNaN(bMs)) return 0;
            if (Number.isNaN(aMs)) return 1;
            if (Number.isNaN(bMs)) return -1;
            return bMs - aMs;
          });
          const paged = paginateRows(filteredRows, currentPage, PAGE_SIZE);

          setRows(paged.data);
          setHasNextPage(Boolean(paged.has_more));
          setTotalRows(Number(paged.total || 0));
          return;
        }

        if (response?.error) {
          setRows([]);
          setHasNextPage(false);
          setTotalRows(0);
          setError(`Falha ao consultar auditoria: ${String(response.error)}`);
          return;
        }

        const payloadRows = Array.isArray(response?.data) ? (response.data as AuditLogEntry[]) : [];
        setRows(payloadRows);
        setHasNextPage(Boolean(response?.has_more));
        setTotalRows(Number(response?.total || 0));
      } catch (requestError: any) {
        if (cancelled) return;
        setRows([]);
        setHasNextPage(false);
        setTotalRows(0);
        setError(String(requestError?.message || 'Falha ao consultar auditoria.'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [currentPage, filters]);

  const handleApplyFilters = () => {
    setCurrentPage(1);
    setFilters({
      ...draftFilters,
      q: draftFilters.q.trim(),
      entity: draftFilters.entity.trim(),
      actor: draftFilters.actor.trim(),
      plate: draftFilters.plate.trim(),
    });
  };

  const handleResetFilters = () => {
    const next = createInitialFilters(activeWarehouse);
    setDraftFilters(next);
    setFilters(next);
    setCurrentPage(1);
  };

  const actionStats = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const action = String(row.action || '').toLowerCase();
        if (action === 'create') acc.create += 1;
        else if (action === 'update') acc.update += 1;
        else if (action === 'delete') acc.delete += 1;
        else acc.other += 1;
        return acc;
      },
      { create: 0, update: 0, delete: 0, other: 0 }
    );
  }, [rows]);

  const handleExportCsv = () => {
    if (rows.length === 0) return;

    const header = [
      'id',
      'data_hora',
      'modulo',
      'entidade',
      'entidade_id',
      'acao',
      'usuario',
      'usuario_id',
      'armazem',
      'resumo',
    ];

    const escapeCsv = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;

    const lines = rows.map((row) => {
      const dataHora = formatDateTimePtBR(row.created_at, '--/--/---- --:--:--');
      return [
        escapeCsv(row.id),
        escapeCsv(dataHora),
        escapeCsv(row.module),
        escapeCsv(row.entity),
        escapeCsv(row.entity_id),
        escapeCsv(row.action),
        escapeCsv(row.actor),
        escapeCsv(row.actor_id),
        escapeCsv(row.warehouse_id || 'GLOBAL'),
        escapeCsv(getAuditSummary(row)),
      ].join(';');
    });

    const csv = `${header.join(';')}\n${lines.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `auditoria-geral-${new Date().toISOString().slice(0, 19).replaceAll(':', '-')}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-slate-800 dark:text-white">Auditoria Geral</h2>
          <p className="text-slate-500 text-sm font-medium mt-1">
            Trilha unificada de alterações do sistema com rastreio por usuário, data/hora e entidade.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { label: 'Criações', value: actionStats.create, style: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
            { label: 'Atualizações', value: actionStats.update, style: 'bg-blue-50 text-blue-700 border-blue-100' },
            { label: 'Exclusões', value: actionStats.delete, style: 'bg-red-50 text-red-700 border-red-100' },
            { label: 'Outros', value: actionStats.other, style: 'bg-slate-50 text-slate-700 border-slate-200' },
          ].map((card) => (
            <div key={card.label} className={`px-3 py-2 rounded-xl border ${card.style}`}>
              <p className="text-[10px] font-black uppercase tracking-widest">{card.label}</p>
              <p className="text-lg font-black">{card.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <input
            value={draftFilters.q}
            onChange={(e) => setDraftFilters((prev) => ({ ...prev, q: e.target.value }))}
            placeholder="Busca geral (ID, ação, meta...)"
            className="px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:outline-none focus:border-primary"
          />

          <select
            value={draftFilters.module}
            onChange={(e) => setDraftFilters((prev) => ({ ...prev, module: e.target.value }))}
            className="px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:outline-none focus:border-primary"
          >
            <option value="">Todos os módulos</option>
            <option value="recebimento">Recebimento</option>
            <option value="inventory">Estoque</option>
            <option value="material_requests">Solicitações SA</option>
            <option value="purchase_orders">Pedidos de Compra</option>
            <option value="movements">Movimentações</option>
            <option value="cyclic_batches">Inventário Cíclico</option>
            <option value="users">Gestão de Usuários</option>
          </select>

          <select
            value={draftFilters.action}
            onChange={(e) => setDraftFilters((prev) => ({ ...prev, action: e.target.value }))}
            className="px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:outline-none focus:border-primary"
          >
            <option value="">Todas as ações</option>
            <option value="create">Criação</option>
            <option value="update">Atualização</option>
            <option value="delete">Exclusão</option>
            <option value="receipt_finalize">Finalização de recebimento</option>
            <option value="inventory_increment">Incremento de estoque</option>
          </select>

          <input
            value={draftFilters.entity}
            onChange={(e) => setDraftFilters((prev) => ({ ...prev, entity: e.target.value }))}
            placeholder="Entidade (inventory, users...)"
            className="px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:outline-none focus:border-primary"
          />

          <input
            value={draftFilters.actor}
            onChange={(e) => setDraftFilters((prev) => ({ ...prev, actor: e.target.value }))}
            placeholder="Usuário (email ou nome)"
            className="px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:outline-none focus:border-primary"
          />

          <input
            value={draftFilters.plate}
            onChange={(e) => setDraftFilters((prev) => ({ ...prev, plate: e.target.value }))}
            placeholder="Placa (ex: ABC-1234)"
            className="px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:outline-none focus:border-primary"
          />

          <select
            value={draftFilters.warehouse_id}
            onChange={(e) => setDraftFilters((prev) => ({ ...prev, warehouse_id: e.target.value }))}
            className="px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:outline-none focus:border-primary"
          >
            <option value="all">Todos os armazéns</option>
            <option value={activeWarehouse}>Armazém ativo ({activeWarehouse})</option>
            <option value="ARMZ28">ARMZ28</option>
            <option value="ARMZ33">ARMZ33</option>
          </select>

          <input
            type="date"
            value={toInputDate(draftFilters.from)}
            onChange={(e) => setDraftFilters((prev) => ({ ...prev, from: e.target.value }))}
            className="px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:outline-none focus:border-primary"
          />

          <input
            type="date"
            value={toInputDate(draftFilters.to)}
            onChange={(e) => setDraftFilters((prev) => ({ ...prev, to: e.target.value }))}
            className="px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:outline-none focus:border-primary"
          />

          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50">
            <input
              id="include-global"
              type="checkbox"
              checked={draftFilters.include_global}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, include_global: e.target.checked }))}
              className="size-4 accent-primary"
            />
            <label htmlFor="include-global" className="text-xs font-black uppercase tracking-wider text-slate-500">
              Incluir registros globais
            </label>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleApplyFilters}
            className="px-5 py-2.5 rounded-xl bg-primary text-white text-[11px] font-black uppercase tracking-widest"
          >
            Aplicar Filtros
          </button>
          <button
            onClick={handleExportCsv}
            disabled={rows.length === 0}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white text-[11px] font-black uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Exportar CSV
          </button>
          <button
            onClick={handleResetFilters}
            className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-[11px] font-black uppercase tracking-widest"
          >
            Limpar
          </button>
          <div className="ml-auto px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500">
            Total filtrado: {totalRows}
          </div>
        </div>

        {notice && <p className="text-xs font-black text-amber-600">{notice}</p>}
        {error && <p className="text-xs font-black text-red-600">{error}</p>}
      </div>

      <PaginationBar
        currentPage={currentPage}
        currentCount={rows.length}
        pageSize={PAGE_SIZE}
        hasNextPage={hasNextPage}
        isLoading={isLoading}
        itemLabel="eventos"
        onPageChange={setCurrentPage}
      />

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1180px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                <th className="px-6 py-5">Data / Hora</th>
                <th className="px-6 py-5">Módulo</th>
                <th className="px-6 py-5">Entidade</th>
                <th className="px-6 py-5">Ação</th>
                <th className="px-6 py-5">Usuário</th>
                <th className="px-6 py-5">Armazém</th>
                <th className="px-6 py-5">Resumo</th>
                <th className="px-6 py-5 text-center">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.length > 0 ? (
                rows.map((row) => {
                  const when = splitDateTimePtBR(row.created_at, '--/--/----', '--:--:--');
                  const action = String(row.action || '').toLowerCase();
                  const actionLabel = ACTION_LABELS[action] || String(row.action || 'Ação').replaceAll('_', ' ');
                  const actionStyle = ACTION_STYLES[action] || 'bg-slate-100 text-slate-700';

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/50 transition-all">
                      <td className="px-6 py-4">
                        <p className="text-xs font-black text-slate-800 dark:text-white">{when.date}</p>
                        <p className="text-[10px] font-bold text-slate-400">{when.time}</p>
                      </td>
                      <td className="px-6 py-4 text-xs font-black text-slate-700 dark:text-slate-300">
                        {MODULE_LABELS[String(row.module || '').toLowerCase()] || row.module || '-'}
                      </td>
                      <td className="px-6 py-4 text-xs font-black text-slate-700 dark:text-slate-300">
                        {row.entity || '-'}
                        <p className="text-[10px] text-primary font-black mt-1">{row.entity_id || '-'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide ${actionStyle}`}>
                          {actionLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-black text-slate-700 dark:text-slate-300">{row.actor || '-'}</td>
                      <td className="px-6 py-4 text-xs font-black text-slate-700 dark:text-slate-300">{row.warehouse_id || 'GLOBAL'}</td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-500">{getAuditSummary(row)}</td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => setSelectedRow(row)}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider"
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center text-xs font-black uppercase tracking-widest text-slate-400">
                    {isLoading ? 'Carregando trilha de auditoria...' : 'Nenhum evento encontrado para os filtros informados.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedRow && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-5xl max-h-[88vh] rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white">Detalhe do Evento de Auditoria</h3>
                <p className="text-xs font-bold text-slate-500">
                  {formatDateTimePtBR(selectedRow.created_at, '--/--/---- --:--:--')} • {selectedRow.actor || 'Sistema'}
                </p>
              </div>
              <button
                onClick={() => setSelectedRow(null)}
                className="size-10 rounded-xl bg-slate-100 text-slate-500 hover:text-red-600 flex items-center justify-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Módulo</p>
                  <p className="text-sm font-black text-slate-700">{selectedRow.module || '-'}</p>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Entidade</p>
                  <p className="text-sm font-black text-slate-700">{selectedRow.entity || '-'}</p>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ação</p>
                  <p className="text-sm font-black text-slate-700">{selectedRow.action || '-'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500">Antes</div>
                  <pre className="p-4 text-[11px] leading-relaxed overflow-x-auto text-slate-700">{safeJsonString(selectedRow.before_data)}</pre>
                </div>

                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500">Depois</div>
                  <pre className="p-4 text-[11px] leading-relaxed overflow-x-auto text-slate-700">{safeJsonString(selectedRow.after_data)}</pre>
                </div>

                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500">Metadados</div>
                  <pre className="p-4 text-[11px] leading-relaxed overflow-x-auto text-slate-700">{safeJsonString(selectedRow.meta)}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
