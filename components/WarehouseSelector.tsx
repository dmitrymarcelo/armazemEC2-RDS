import React from 'react';
import { Warehouse } from '../types';

interface WarehouseSelectorProps {
    warehouses: Warehouse[];
    activeWarehouse: string;
    userWarehouses: string[];
    onWarehouseChange: (warehouseId: string) => void;
}

export const WarehouseSelector: React.FC<WarehouseSelectorProps> = ({
    warehouses,
    activeWarehouse,
    userWarehouses,
    onWarehouseChange
}) => {
    // Filtrar apenas os armazéns que o usuário tem permissão
    const accessibleWarehouses = warehouses.filter(w =>
        userWarehouses.includes(w.id) && w.isActive
    );

    // Se o usuário só tem acesso a um armazém, não mostrar o seletor
    if (accessibleWarehouses.length <= 1) {
        return null;
    }

    return (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 shadow-sm backdrop-blur-md">
            <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="size-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Armazém Ativo:</span>
            </div>

            <div className="flex gap-2 flex-1">
                {accessibleWarehouses.map(warehouse => {
                    const isActive = activeWarehouse === warehouse.id;
                    return (
                        <button
                            key={warehouse.id}
                            onClick={() => onWarehouseChange(warehouse.id)}
                            className={`group relative px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${isActive
                                ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-105'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <span className={`size-2 rounded-full ${isActive ? 'bg-white animate-pulse' : 'bg-slate-400'}`} />
                                <span>{warehouse.id}</span>
                            </div>

                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 dark:bg-slate-700 text-white text-[10px] font-bold rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                <div className="text-center">
                                    <p className="font-black">{warehouse.name}</p>
                                    {warehouse.description && (
                                        <p className="text-slate-300 dark:text-slate-400 mt-0.5">{warehouse.description}</p>
                                    )}
                                </div>
                                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                                    <div className="border-4 border-transparent border-t-slate-900 dark:border-t-slate-700" />
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Indicador de total de itens no armazém ativo */}
            <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                </svg>
                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {accessibleWarehouses.find(w => w.id === activeWarehouse)?.name || activeWarehouse}
                </span>
            </div>
        </div>
    );
};
