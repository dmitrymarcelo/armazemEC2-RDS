import React from 'react';
import { User } from '../types';

interface TopBarProps {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  title: string;
  user: User | null;
  onLogout: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ isDarkMode, toggleDarkMode, title, user, onLogout }) => {
  const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);
  const [notifications] = React.useState([
    { id: 1, title: 'Novo Pedido #1023', time: '5 min atrás', type: 'info', read: false },
    { id: 2, title: 'Estoque Crítico: Monitor 24"', time: '1 hora atrás', type: 'warning', read: false },
    { id: 3, title: 'Entrada Confirmada: NF-e 4590', time: '2 horas atrás', type: 'success', read: true },
    { id: 4, title: 'Meta de Expedição Atingida', time: '5 horas atrás', type: 'success', read: true },
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111922] px-6 lg:px-8 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-4 flex-1">
        <h2 className="text-sm font-black text-primary uppercase tracking-widest">{title}</h2>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={toggleDarkMode}
          className="p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-colors active:scale-95"
          title={isDarkMode ? "Ativar Modo Claro" : "Ativar Modo Escuro"}
        >
          {isDarkMode ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
          )}
        </button>

        <div className="relative">
          <button
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className={`p-2 rounded-full relative transition-all active:scale-95 ${isNotificationsOpen ? 'bg-blue-50 text-primary dark:bg-blue-900/20' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-2.5 right-2.5 size-2 bg-red-500 rounded-full border border-white dark:border-[#111922]"></span>
            )}
          </button>

          {isNotificationsOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsNotificationsOpen(false)}
              ></div>
              <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Notificações</h3>
                  <button className="text-[10px] font-bold text-primary hover:underline">Marcar todas como lidas</button>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {notifications.map(notification => (
                    <div key={notification.id} className={`p-4 border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${!notification.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                      <div className="flex items-start gap-3">
                        <div className={`mt-1 size-2 rounded-full flex-shrink-0 ${notification.type === 'warning' ? 'bg-amber-500' :
                          notification.type === 'success' ? 'bg-emerald-500' : 'bg-blue-500'
                          }`}></div>
                        <div>
                          <p className={`text-xs ${!notification.read ? 'font-black text-slate-800 dark:text-white' : 'font-medium text-slate-500 dark:text-slate-400'}`}>
                            {notification.title}
                          </p>
                          <p className="text-[10px] text-slate-400 font-bold mt-1">{notification.time}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/30 text-center border-t border-slate-100 dark:border-slate-800">
                  <button className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-blue-600 transition-colors">
                    Ver Histórico Completo
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800 hidden sm:block"></div>

        <div className="relative">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-3 p-1 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 group"
          >
            <div className="text-right hidden sm:block">
              <p className="text-xs font-black text-slate-800 dark:text-white group-hover:text-primary transition-colors">{user?.name || 'Ricardo Souza'}</p>
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-tight">{user?.role === 'admin' ? 'Gestor de Operações' : 'Operador CD'}</p>
            </div>
            <div className="relative">
              <img
                src={user?.avatar || "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop"}
                alt="User"
                className="size-9 rounded-full border-2 border-slate-200 dark:border-slate-800 object-cover group-hover:border-primary transition-colors"
              />
              <div className="absolute -bottom-0.5 -right-0.5 size-3 bg-green-500 rounded-full border-2 border-white dark:border-[#111922]"></div>
            </div>
          </button>

          {isUserMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsUserMenuOpen(false)}
              ></div>
              <div className="absolute top-full right-0 mt-3 w-56 bg-white dark:bg-slate-900 rounded-[1.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Logado como</p>
                  <p className="text-sm font-black text-slate-800 dark:text-white truncate">{user?.email || 'ricardo.souza@nortetech.com'}</p>
                </div>
                <div className="p-2">
                  <button className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all group">
                    <span className="material-symbols-outlined text-lg group-hover:text-primary transition-colors">person</span>
                    Meu Perfil
                  </button>
                  <button className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all group">
                    <span className="material-symbols-outlined text-lg group-hover:text-primary transition-colors">settings</span>
                    Configurações
                  </button>
                  <div className="my-2 border-t border-slate-100 dark:border-slate-800"></div>
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-black text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all group"
                  >
                    <span className="material-symbols-outlined text-lg group-hover:scale-110 transition-transform">logout</span>
                    Encerrar Sessão
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
