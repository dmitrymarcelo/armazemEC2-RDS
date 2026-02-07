import React, { useState } from 'react';
import { User, ALL_MODULES, Module, ROLE_LABELS, Warehouse } from '../types';

interface SettingsProps {
  users: User[];
  warehouses: Warehouse[]; // NOVO
  onAddUser: (user: User) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
}

export const Settings: React.FC<SettingsProps> = ({ users, warehouses, onAddUser, onUpdateUser, onDeleteUser }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState<Partial<User>>({
    name: '',
    email: '',
    role: 'buyer',
    password: '',
    status: 'Ativo',
    modules: [],
    allowedWarehouses: ['ARMZ28'] // Default
  });

  const openAddModal = () => {
    setEditingUser(null);
    setNewUser({ name: '', email: '', role: 'buyer', password: '', status: 'Ativo', modules: [], allowedWarehouses: ['ARMZ28'] });
    setIsModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setNewUser({ ...user });
    setIsModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (newUser.name && newUser.email) {
      if (editingUser) {
        onUpdateUser({
          ...editingUser,
          ...newUser,
        } as User);
      } else {
        onAddUser({
          id: Math.random().toString(36).substr(2, 9),
          name: newUser.name!,
          email: newUser.email!,
          role: newUser.role as any,
          status: newUser.status || 'Ativo',
          lastAccess: 'Nunca',
          avatar: `https://ui-avatars.com/api/?name=${newUser.name}&background=random`,
          password: newUser.password || '',
          modules: newUser.modules || [],
          allowedWarehouses: newUser.allowedWarehouses || ['ARMZ28']
        });
      }
      setIsModalOpen(false);
      setEditingUser(null);
      setNewUser({ name: '', email: '', role: 'buyer', password: '', status: 'Ativo', modules: [], allowedWarehouses: ['ARMZ28'] });
    }
  };

  const toggleWarehouse = (warehouseId: string) => {
    setNewUser(prev => {
      const current = prev.allowedWarehouses || [];
      if (current.includes(warehouseId)) {
        // Garantir que pelo menos um sempre esteja selecionado
        if (current.length === 1) return prev;
        return { ...prev, allowedWarehouses: current.filter(w => w !== warehouseId) };
      } else {
        return { ...prev, allowedWarehouses: [...current, warehouseId] };
      }
    });
  };

  const toggleModule = (moduleId: Module) => {
    setNewUser(prev => {
      const currentModules = prev.modules || [];
      if (currentModules.includes(moduleId)) {
        return { ...prev, modules: currentModules.filter(m => m !== moduleId) };
      } else {
        return { ...prev, modules: [...currentModules, moduleId] };
      }
    });
  };

  const toggleAllModules = () => {
    if (newUser.modules?.length === ALL_MODULES.length) {
      setNewUser({ ...newUser, modules: [] });
    } else {
      setNewUser({ ...newUser, modules: ALL_MODULES.map(m => m.id) });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-widest text-[#617589]">
        <span>Configurações</span>
        <span>/</span>
        <span className="text-primary">Gestão de Usuários</span>
      </div>

      <div className="flex flex-wrap justify-between items-end gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-black tracking-tight">Equipe e Permissões</h2>
          <p className="text-[#617589] font-medium">Gerencie o acesso de funcionários, cargos e níveis de segurança.</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-lg text-sm font-black shadow-lg shadow-primary/20 hover:bg-blue-600 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
          CADASTRAR USUÁRIO
        </button>
      </div>

      {/* Tabela de Usuários */}
      <div className="bg-white dark:bg-[#1a222c] rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-4 flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-800/20">
          <div className="flex gap-2">
            <button className="px-4 py-1.5 bg-primary text-white text-[10px] font-black rounded-lg">TODOS</button>
          </div>
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Listando {users.length} usuários ativos</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-gray-800/50">
                <th className="px-6 py-4 text-[10px] font-black text-[#617589] uppercase tracking-wider">Perfil de Usuário</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#617589] uppercase tracking-wider">Cargo</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#617589] uppercase tracking-wider">Acesso</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#617589] uppercase tracking-wider">Último Acesso</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#617589] uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#617589] uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full border border-gray-100 dark:border-gray-700 bg-cover bg-center" style={{ backgroundImage: `url(${user.avatar})` }} />
                      <div>
                        <p className="text-sm font-black">{user.name}</p>
                        <p className="text-[10px] font-medium text-[#617589]">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${user.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                      {ROLE_LABELS[user.role]}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {user.modules?.slice(0, 3).map(m => (
                        <span key={m} className="text-[9px] bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300 uppercase font-bold">{m}</span>
                      ))}
                      {(user.modules?.length || 0) > 3 && (
                        <span className="text-[9px] bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300 font-bold">+{user.modules!.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium">{user.lastAccess}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`size-2 rounded-full ${user.status === 'Ativo' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                      <span className={`text-xs font-bold ${user.status === 'Ativo' ? 'text-green-600' : 'text-gray-500'}`}>{user.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEditModal(user)}
                        className="p-2 text-slate-400 hover:text-primary transition-colors"
                        title="Editar Usuário"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => onDeleteUser(user.id)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                        title="Remover Usuário"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18" />
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Cadastro */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 my-8">
            <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-black text-lg">{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <span className="text-lg font-black leading-none">✕</span>
              </button>
            </div>
            <form onSubmit={handleSaveUser} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-black uppercase text-gray-500 mb-1">Nome Completo</label>
                  <input
                    required
                    type="text"
                    value={newUser.name}
                    onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-gray-500 mb-1">Status</label>
                  <select
                    value={newUser.status}
                    onChange={e => setNewUser({ ...newUser, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg font-bold"
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-gray-500 mb-1">Email / Login</label>
                  <input
                    required
                    type="email"
                    value={newUser.email}
                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-gray-500 mb-1">Função</label>
                  <select
                    value={newUser.role}
                    onChange={e => setNewUser({ ...newUser, role: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg font-bold"
                  >
                    <option value="buyer">Comprador</option>
                    <option value="admin">Administrador</option>
                    <option value="manager">Gerente</option>
                    <option value="driver">Motorista</option>
                    <option value="operator">Operador</option>
                    <option value="checker">Conferente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-gray-500 mb-1">Senha</label>
                  <input
                    required
                    type="password"
                    value={newUser.password}
                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-gray-200 rounded-lg font-bold"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-black uppercase text-gray-500">Módulos de Acesso</label>
                  <button type="button" onClick={toggleAllModules} className="text-[10px] font-bold text-primary hover:underline uppercase">
                    {newUser.modules?.length === ALL_MODULES.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {ALL_MODULES.map(module => (
                    <label key={module.id} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${(newUser.modules || []).includes(module.id)
                      ? 'bg-primary/5 border-primary/30'
                      : 'bg-slate-50 dark:bg-slate-800 border-gray-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}>
                      <input
                        type="checkbox"
                        checked={(newUser.modules || []).includes(module.id)}
                        onChange={() => toggleModule(module.id)}
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{module.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Seção de Armazéns Permetidos */}
              <div className="pt-2">
                <label className="block text-xs font-black uppercase text-gray-500 mb-2">Armazéns com Permissão</label>
                <div className="flex flex-wrap gap-3">
                  {warehouses.map(wh => (
                    <label key={wh.id} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all flex-1 min-w-[140px] ${(newUser.allowedWarehouses || []).includes(wh.id)
                      ? 'bg-blue-500/10 border-blue-500/30'
                      : 'bg-slate-50 dark:bg-slate-800 border-gray-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}>
                      <input
                        type="checkbox"
                        checked={(newUser.allowedWarehouses || []).includes(wh.id)}
                        onChange={() => toggleWarehouse(wh.id)}
                        className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-gray-800 dark:text-white uppercase">{wh.id}</span>
                        <span className="text-[10px] font-bold text-gray-500">{wh.name}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-black shadow-lg shadow-primary/20 hover:bg-blue-600 transition-all"
                >
                  {editingUser ? 'ATUALIZAR DADOS' : 'SALVAR USUÁRIO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
