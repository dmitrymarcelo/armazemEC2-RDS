import React, { useMemo, useState } from 'react';
import { User, ALL_MODULES, Module, ROLE_LABELS, Warehouse } from '../types';

interface SettingsProps {
  users: User[];
  warehouses: Warehouse[];
  onAddUser: (user: User) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
}

const DEFAULT_ALLOWED_WAREHOUSES = ['ARMZ28'];

const createEmptyUserDraft = (): Partial<User> => ({
  name: '',
  email: '',
  role: 'buyer',
  password: '',
  status: 'Ativo',
  modules: [],
  allowedWarehouses: DEFAULT_ALLOWED_WAREHOUSES,
  hasWorkshopAccess: false
});

export const Settings: React.FC<SettingsProps> = ({
  users,
  warehouses,
  onAddUser,
  onUpdateUser,
  onDeleteUser
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState<Partial<User>>(createEmptyUserDraft());

  const activeUsers = useMemo(() => users.filter((user) => user.status === 'Ativo').length, [users]);
  const workshopUsers = useMemo(() => users.filter((user) => user.hasWorkshopAccess).length, [users]);
  const adminUsers = useMemo(() => users.filter((user) => user.role === 'admin').length, [users]);

  const openAddModal = () => {
    setEditingUser(null);
    setNewUser(createEmptyUserDraft());
    setIsModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setNewUser({ ...user });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setNewUser(createEmptyUserDraft());
  };

  const handleSaveUser = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newUser.name || !newUser.email || !newUser.role) return;

    if (editingUser) {
      onUpdateUser({
        ...editingUser,
        ...newUser,
      } as User);
    } else {
      onAddUser({
        id: Math.random().toString(36).slice(2, 11),
        name: newUser.name,
        email: newUser.email,
        role: newUser.role as User['role'],
        status: (newUser.status || 'Ativo') as User['status'],
        lastAccess: 'Nunca',
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(newUser.name)}&background=0D8ABC&color=fff`,
        password: newUser.password || '',
        modules: newUser.modules || [],
        allowedWarehouses: newUser.allowedWarehouses || DEFAULT_ALLOWED_WAREHOUSES,
        hasWorkshopAccess: Boolean(newUser.hasWorkshopAccess)
      });
    }

    closeModal();
  };

  const toggleWarehouse = (warehouseId: string) => {
    setNewUser((previous) => {
      const current = previous.allowedWarehouses || [];
      if (current.includes(warehouseId)) {
        if (current.length === 1) return previous;
        return { ...previous, allowedWarehouses: current.filter((value) => value !== warehouseId) };
      }
      return { ...previous, allowedWarehouses: [...current, warehouseId] };
    });
  };

  const toggleModule = (moduleId: Module) => {
    setNewUser((previous) => {
      const currentModules = previous.modules || [];
      if (currentModules.includes(moduleId)) {
        return { ...previous, modules: currentModules.filter((module) => module !== moduleId) };
      }
      return { ...previous, modules: [...currentModules, moduleId] };
    });
  };

  const toggleAllModules = () => {
    if ((newUser.modules || []).length === ALL_MODULES.length) {
      setNewUser({ ...newUser, modules: [] });
      return;
    }
    setNewUser({ ...newUser, modules: ALL_MODULES.map((module) => module.id) });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-widest text-[#617589]">
        <span>Configurações</span>
        <span>/</span>
        <span className="text-primary">Gestão de Usuários</span>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-black tracking-tight">Equipe e Permissões</h2>
          <p className="text-[#617589] font-medium">Controle de perfis, módulos, armazéns e acesso à oficina.</p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-black shadow-lg shadow-primary/20 hover:bg-blue-600 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
          Cadastrar Usuário
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Usuários ativos</p>
          <p className="mt-2 text-3xl font-black text-slate-800">{activeUsers}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Com acesso à oficina</p>
          <p className="mt-2 text-3xl font-black text-amber-600">{workshopUsers}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Administradores</p>
          <p className="mt-2 text-3xl font-black text-blue-600">{adminUsers}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/40">
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
            Total de usuários: {users.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/60">
                <th className="px-6 py-4 text-[10px] font-black text-[#617589] uppercase tracking-wider">Usuário</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#617589] uppercase tracking-wider">Função</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#617589] uppercase tracking-wider">Módulos</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#617589] uppercase tracking-wider">Último acesso</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#617589] uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#617589] uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full border border-gray-100 bg-cover bg-center" style={{ backgroundImage: `url(${user.avatar})` }} />
                      <div>
                        <p className="text-sm font-black text-slate-800">{user.name}</p>
                        <p className="text-[10px] font-medium text-[#617589]">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${user.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
                      {ROLE_LABELS[user.role]}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1 max-w-[260px]">
                      {(user.modules || []).slice(0, 4).map((module) => (
                        <span key={module} className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 uppercase font-bold">
                          {module}
                        </span>
                      ))}
                      {(user.modules?.length || 0) > 4 && (
                        <span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-bold">
                          +{user.modules!.length - 4}
                        </span>
                      )}
                      {user.hasWorkshopAccess && (
                        <span className="text-[9px] bg-amber-100 px-1.5 py-0.5 rounded text-amber-700 font-bold uppercase">
                          Oficina
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-700">{user.lastAccess}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`size-2 rounded-full ${user.status === 'Ativo' ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <span className={`text-xs font-bold ${user.status === 'Ativo' ? 'text-green-600' : 'text-gray-500'}`}>{user.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEditModal(user)}
                        className="p-2 text-slate-400 hover:text-primary transition-colors"
                        title="Editar usuário"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => onDeleteUser(user.id)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                        title="Remover usuário"
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

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 my-8 border border-slate-100">
            <div className="p-6 border-b border-gray-100 flex items-start justify-between gap-4">
              <div>
                <h3 className="font-black text-xl text-slate-800">
                  {editingUser ? 'Editar Usuário' : 'Cadastrar Usuário'}
                </h3>
                <p className="text-sm text-slate-500 font-medium">
                  Configure perfil, módulos, armazéns e acesso à oficina em um único formulário.
                </p>
              </div>
              <button onClick={closeModal} className="size-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:text-red-500">
                <span className="text-lg font-black leading-none">×</span>
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black uppercase text-gray-500 mb-1">Nome completo</label>
                      <input
                        required
                        type="text"
                        value={newUser.name}
                        onChange={(event) => setNewUser({ ...newUser, name: event.target.value })}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-gray-200 rounded-xl font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase text-gray-500 mb-1">E-mail / login</label>
                      <input
                        required
                        type="email"
                        value={newUser.email}
                        onChange={(event) => setNewUser({ ...newUser, email: event.target.value })}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-gray-200 rounded-xl font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase text-gray-500 mb-1">Função</label>
                      <select
                        value={newUser.role}
                        onChange={(event) => setNewUser({ ...newUser, role: event.target.value as User['role'] })}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-gray-200 rounded-xl font-bold"
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
                      <label className="block text-xs font-black uppercase text-gray-500 mb-1">Status</label>
                      <select
                        value={newUser.status}
                        onChange={(event) => setNewUser({ ...newUser, status: event.target.value as User['status'] })}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-gray-200 rounded-xl font-bold"
                      >
                        <option value="Ativo">Ativo</option>
                        <option value="Inativo">Inativo</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-gray-500 mb-1">Senha</label>
                    <input
                      required={!editingUser}
                      type="password"
                      value={newUser.password || ''}
                      onChange={(event) => setNewUser({ ...newUser, password: event.target.value })}
                      placeholder={editingUser ? 'Preencha para alterar a senha' : ''}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-gray-200 rounded-xl font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Resumo de acesso</p>
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-slate-700">
                      Perfil: <span className="text-primary">{newUser.role ? ROLE_LABELS[newUser.role] : '--'}</span>
                    </p>
                    <p className="text-sm font-bold text-slate-700">
                      Módulos: <span className="text-primary">{(newUser.modules || []).length}</span>
                    </p>
                    <p className="text-sm font-bold text-slate-700">
                      Armazéns: <span className="text-primary">{(newUser.allowedWarehouses || []).length}</span>
                    </p>
                    <p className={`text-sm font-bold ${(newUser.hasWorkshopAccess || newUser.role === 'admin') ? 'text-emerald-600' : 'text-slate-500'}`}>
                      Oficina: {(newUser.hasWorkshopAccess || newUser.role === 'admin') ? 'Liberada' : 'Bloqueada'}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-black uppercase text-gray-500">Módulos de acesso</label>
                  <button type="button" onClick={toggleAllModules} className="text-[10px] font-bold text-primary hover:underline uppercase">
                    {(newUser.modules || []).length === ALL_MODULES.length ? 'Desmarcar todos' : 'Marcar todos'}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {ALL_MODULES.map((module) => (
                    <label
                      key={module.id}
                      className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${(newUser.modules || []).includes(module.id)
                        ? 'bg-primary/5 border-primary/30'
                        : 'bg-slate-50 border-gray-100 hover:bg-slate-100'
                        }`}
                    >
                      <input
                        type="checkbox"
                        checked={(newUser.modules || []).includes(module.id)}
                        onChange={() => toggleModule(module.id)}
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-xs font-bold text-gray-700">{module.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-gray-500 mb-2">Armazéns com permissão</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {warehouses.map((warehouse) => (
                    <label
                      key={warehouse.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${(newUser.allowedWarehouses || []).includes(warehouse.id)
                        ? 'bg-blue-500/10 border-blue-500/30'
                        : 'bg-slate-50 border-gray-100 hover:bg-slate-100'
                        }`}
                    >
                      <input
                        type="checkbox"
                        checked={(newUser.allowedWarehouses || []).includes(warehouse.id)}
                        onChange={() => toggleWarehouse(warehouse.id)}
                        className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-gray-800 uppercase">{warehouse.id}</span>
                        <span className="text-[10px] font-bold text-gray-500">{warehouse.name}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label
                  className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${newUser.hasWorkshopAccess
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-slate-50 border-gray-100 hover:bg-slate-100'
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={newUser.hasWorkshopAccess || false}
                    onChange={(event) => setNewUser({ ...newUser, hasWorkshopAccess: event.target.checked })}
                    className="rounded border-gray-300 text-amber-500 focus:ring-amber-500 size-5"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-gray-800">Acesso à Oficina</span>
                    <span className="text-[11px] font-bold text-gray-500">Controla acesso ao módulo de frota e manutenção.</span>
                  </div>
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-black shadow-lg shadow-primary/20 hover:bg-blue-600 transition-all"
                >
                  {editingUser ? 'Atualizar usuário' : 'Salvar usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
