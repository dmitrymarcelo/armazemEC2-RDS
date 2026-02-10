import React from 'react';
import { SystemModule, User } from '../types';

interface ModuleSelectorProps {
  user: User;
  onSelectModule: (module: SystemModule) => void;
  onLogout: () => void;
}

export const ModuleSelector: React.FC<ModuleSelectorProps> = ({ user, onSelectModule, onLogout }) => {
  const canAccessWorkshop = user.role === 'admin' || Boolean(user.hasWorkshopAccess);

  const modules: {
    id: SystemModule;
    name: string;
    description: string;
    icon: string;
    color: string;
    image: string;
    disabled?: boolean;
  }[] = [
    {
      id: 'warehouse',
      name: 'Armazem',
      description: 'Gestao de estoque, recebimento, expedicao e inventario',
      icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
      color: 'from-blue-500 to-blue-600',
      image: '/warehouse-bg.jpg',
    },
    {
      id: 'workshop',
      name: 'Oficina',
      description: 'Ordens de servico, manutencao preventiva e gestao de mecanicos',
      icon: 'M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.457.4M15 14l-2-2m0 0l-2-2m2 2l2-2m-2 2l-2 2',
      color: 'from-orange-500 to-red-600',
      image: '/workshop-bg.jpg',
      disabled: !canAccessWorkshop,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex flex-col">
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/norte_tech_logo.png" alt="Norte Tech" className="w-10 h-10 object-contain" />
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">LogiWMS Pro</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Sistema Integrado de Gestao</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{user.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{user.role}</p>
            </div>
            <button
              onClick={onLogout}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="max-w-5xl w-full">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">Selecione o Modulo</h2>
            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
              Escolha qual ambiente deseja acessar para gerenciar suas operacoes
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {modules.map((module) => (
              <button
                key={module.id}
                onClick={() => !module.disabled && onSelectModule(module.id)}
                disabled={module.disabled}
                className={`group relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800 shadow-lg transition-all duration-300 border border-slate-200 dark:border-slate-700 text-left ${
                  module.disabled ? 'cursor-not-allowed opacity-60' : 'hover:shadow-2xl'
                }`}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${module.color} transition-opacity duration-300 ${
                    module.disabled ? 'opacity-0' : 'opacity-0 group-hover:opacity-5'
                  }`}
                />

                <div className="relative p-8">
                  <div
                    className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${module.color} flex items-center justify-center shadow-lg mb-6 ${
                      module.disabled ? '' : 'group-hover:scale-110'
                    } transition-transform duration-300`}
                  >
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={module.icon} />
                    </svg>
                  </div>

                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {module.name}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-6">{module.description}</p>

                  <div className="flex items-center text-sm font-semibold text-blue-600 dark:text-blue-400 transition-transform">
                    <span>{module.disabled ? 'Acesso bloqueado' : 'Acessar modulo'}</span>
                    <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>
                </div>

                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-transparent to-slate-100 dark:to-slate-700/30 rounded-bl-full opacity-50" />
              </button>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">Copyright 2024 LogiWMS Pro - Todos os direitos reservados</p>
          </div>
        </div>
      </main>
    </div>
  );
};
