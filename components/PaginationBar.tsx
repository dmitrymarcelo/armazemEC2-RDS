import React from 'react';

interface PaginationBarProps {
  currentPage: number;
  currentCount: number;
  pageSize: number;
  hasNextPage: boolean;
  isLoading: boolean;
  itemLabel: string;
  onPageChange: (page: number) => void;
}

export const PaginationBar: React.FC<PaginationBarProps> = ({
  currentPage,
  currentCount,
  pageSize,
  hasNextPage,
  isLoading,
  itemLabel,
  onPageChange,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
        Pagina {currentPage} - {currentCount}/{pageSize} {itemLabel} desta pagina
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1 || isLoading}
          className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Anterior
        </button>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasNextPage || isLoading}
          className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider bg-primary text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Proxima
        </button>
      </div>
    </div>
  );
};
