import React from 'react';
import { Module, User } from '../types';

interface SidebarProps {
  activeModule: Module;
  onModuleChange: (module: Module) => void;
  user: User;
  isCollapsed: boolean;
  onToggle: () => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

const SidebarIcon: React.FC<{ icon: string; isActive: boolean; isCollapsed: boolean }> = ({ icon, isActive }) => {
  const color = isActive ? 'currentColor' : '#94a3b8';

  const icons: Record<string, React.ReactNode> = {
    grid_view: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 5h4v4H5V5zm10 0h4v4h-4V5zM5 15h4v4H5v-4zm10 0h4v4h-4v-4z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    move_to_inbox: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22 13h-4l-2 2h-8l-2-2H2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    swap_horiz: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 14l3-3m0 0l-3-3m3 3H3M6 20L3 17m0 0l3-3m-3 3h18" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    fact_check: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 11l2 2 4-4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 5a2 2 0 012-2h10l4 4v12a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    inventory_2: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M21 10V4H3v6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 10a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V10z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 14h4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    local_shipping: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 18a2 2 0 100-4 2 2 0 000 4zm12 0a2 2 0 100-4 2 2 0 000 4z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 5h13v9H2V5zm13 4h5l4 4v2h-9V9z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    published_with_changes: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 3l3 3-3 3M22 21l-3-3 3-3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 6h12a3 3 0 013 3v2M19 18H7a3 3 0 01-3-3v-2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    shopping_cart: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="9" cy="21" r="1" stroke={color} strokeWidth="2" />
        <circle cx="20" cy="21" r="1" stroke={color} strokeWidth="2" />
        <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    app_registration: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    bar_chart: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 20V10M12 20V4M6 20v-6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    settings: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    menu: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 12h16M4 6h16M4 18h16" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    menu_open: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M13 17l5-5-5-5M6 17l5-5-5-5M2 12h11" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  };

  return (
    <div className={`transition-all duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
      {icons[icon] || icons.dashboard}
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ activeModule, onModuleChange, user, isCollapsed, onToggle, isMobileOpen, onMobileClose }) => {
  const navItems = [
    { id: 'dashboard', label: 'Painel', icon: 'grid_view' },
    { id: 'recebimento', label: 'Recebimento', icon: 'move_to_inbox' },
    { id: 'movimentacoes', label: 'Movimentações', icon: 'swap_horiz' },
    { id: 'auditoria_geral', label: 'Auditoria Geral', icon: 'fact_check' },
    { id: 'estoque', label: 'Estoque', icon: 'inventory_2' },
    { id: 'expedicao', label: 'Solicitações SA', icon: 'local_shipping' },
    { id: 'inventario_ciclico', label: 'Inventário Cíclico', icon: 'published_with_changes' },
    { id: 'compras', label: 'Pedido de Compras', icon: 'shopping_cart' },
    { id: 'cadastro', label: 'Cadastro Geral', icon: 'app_registration' },
    { id: 'relatorios', label: 'Relatórios', icon: 'bar_chart' },
  ] as const;

  const filteredNavItems = navItems.filter(
    (item) => user.role === 'admin' || user.modules?.includes(item.id as Module)
  );

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm lg:hidden animate-in fade-in duration-300"
          onClick={onMobileClose}
        ></div>
      )}

      <aside
        className={`
        fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0 transition-transform duration-500 ease-in-out
        ${isMobileOpen ? 'translate-x-0 flex' : '-translate-x-full lg:translate-x-0 hidden lg:flex'}
        ${isCollapsed ? 'lg:w-24' : 'lg:w-64'} w-72
        border-r border-[#dbe0e6] dark:border-[#2d3748] bg-white dark:bg-[#1a222c] flex flex-col flex-shrink-0 h-full relative overflow-hidden
      `}
      >
        <button
          onClick={onToggle}
          className="hidden lg:flex absolute -right-0 top-6 z-50 bg-white dark:bg-[#1a222c] border border-[#dbe0e6] dark:border-[#2d3748] p-2 rounded-l-xl shadow-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 group"
          title={isCollapsed ? 'Expandir Menu' : 'Recolher Menu'}
        >
          <SidebarIcon icon={isCollapsed ? 'menu' : 'menu_open'} isActive={false} isCollapsed={isCollapsed} />
        </button>

        <button
          onClick={onMobileClose}
          className="lg:hidden absolute right-4 top-4 z-50 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className={`flex flex-col items-center justify-center transition-all duration-500 ${isCollapsed ? 'lg:p-4 p-6 gap-2' : 'p-6 gap-4'}`}>
          <img
            src={`${import.meta.env.BASE_URL}norte_tech_logo.png`}
            alt="Norte Tech Logo"
            className={`w-auto drop-shadow-2xl transition-all duration-500 hover:scale-105 ${isCollapsed ? 'lg:h-10 h-16' : 'h-24'}`}
          />
          <div className={`text-center transition-all duration-500 ${isCollapsed ? 'lg:opacity-0 lg:h-0 lg:scale-90 lg:translate-y-[-10px] lg:pointer-events-none' : 'opacity-100 h-auto scale-100 translate-y-0'}`}>
            <p className="text-[#617589] text-[11px] font-black uppercase tracking-[0.3em]">Armazém 028</p>
            <div className="h-[3px] w-12 bg-primary/40 rounded-full mt-2 mx-auto"></div>
          </div>
        </div>

        <nav className={`flex-1 space-y-2 overflow-y-auto no-scrollbar scroll-smooth ${isCollapsed ? 'lg:px-4 lg:py-2 px-6 py-4' : 'px-6 py-4'}`}>
          {filteredNavItems.map((item) => {
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onModuleChange(item.id)}
                className={`w-full group flex items-center rounded-2xl transition-all duration-300 active:scale-[0.98] ${isCollapsed ? 'lg:p-4 lg:justify-center p-4' : 'px-5 py-3.5'} ${
                  isActive
                    ? 'bg-primary text-white shadow-xl shadow-primary/25'
                    : 'text-[#617589] hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-primary'
                }`}
                title={isCollapsed ? item.label : ''}
              >
                <div className={`flex items-center transition-all duration-300 ${isCollapsed ? 'lg:justify-center lg:w-fit w-full gap-4' : 'w-full gap-4'}`}>
                  <SidebarIcon icon={item.icon} isActive={isActive} isCollapsed={isCollapsed} />
                  <span
                    className={`text-[11px] font-black uppercase tracking-[0.1em] flex-1 text-left whitespace-nowrap transition-all duration-300 ${
                      isActive ? 'text-white' : 'text-inherit'
                    } ${isCollapsed ? 'lg:hidden' : ''}`}
                  >
                    {item.label}
                  </span>
                </div>
              </button>
            );
          })}
        </nav>

        {(user.role === 'admin' || user.modules?.includes('configuracoes')) && (
          <div className="mt-auto bg-slate-50/50 dark:bg-slate-800/10 p-6 rounded-[2rem] border border-slate-200/50 dark:border-slate-800 transition-all duration-500">
            <button
              onClick={() => onModuleChange('configuracoes')}
              className={`w-full flex items-center rounded-2xl transition-all duration-300 active:scale-[0.98] ${isCollapsed ? 'lg:p-4 lg:justify-center p-4' : 'px-5 py-4'} ${
                activeModule === 'configuracoes'
                  ? 'bg-slate-900 text-white shadow-xl'
                  : 'text-[#617589] hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={isCollapsed ? 'Configurações' : ''}
            >
              <div className={`flex items-center transition-all duration-300 ${isCollapsed ? 'lg:justify-center lg:w-fit w-full gap-4' : 'w-full gap-4'}`}>
                <SidebarIcon icon="settings" isActive={activeModule === 'configuracoes'} isCollapsed={isCollapsed} />
                <span className={`text-[11px] font-black uppercase tracking-[0.1em] flex-1 text-left whitespace-nowrap ${isCollapsed ? 'lg:hidden' : ''}`}>
                  Configurações
                </span>
              </div>
            </button>
          </div>
        )}
      </aside>
    </>
  );
};
