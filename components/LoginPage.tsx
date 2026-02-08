import React, { useState } from 'react';
import { User } from '../types';
import { api } from '../api-client';

interface LoginPageProps {
  onLogin: (user: User, token?: string) => void;
}

const parseJsonArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value as string[];
  if (typeof value !== 'string' || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const response = await api
        .from('login')
        .insert({
          email: loginInput,
          password,
        })
        .execute();

      if (response.error) {
        const normalizedError = String(response.error)
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();

        const isAuthError =
          response.error === 'Unauthorized' ||
          normalizedError.includes('credenciais invalidas') ||
          normalizedError.includes('usuario inativo') ||
          normalizedError.includes('token invalido') ||
          normalizedError.includes('token ausente');

        const isApiConnectionError =
          normalizedError.includes('not found') ||
          normalizedError.includes('failed to fetch') ||
          normalizedError.includes('networkerror') ||
          normalizedError.includes('falha de conexao');

        if (isAuthError) {
          setError('Credenciais inválidas ou usuário inativo');
          return;
        }

        if (isApiConnectionError) {
          setError('Falha de conexão com a API. Verifique se o backend está rodando na porta 3001.');
          return;
        }

        setError(String(response.error));
        return;
      }

      const finalUser = response.data;
      const token = response.token as string | undefined;

      if (finalUser) {
        onLogin(
          {
            ...finalUser,
            lastAccess: finalUser.last_access,
            warehouseId: finalUser.warehouse_id || 'ARMZ28',
            modules: parseJsonArray(finalUser.modules),
            allowedWarehouses: parseJsonArray(finalUser.allowed_warehouses),
          },
          token
        );
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Erro ao conectar com o servidor');
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-100 dark:bg-slate-900 relative">
      <div className="hidden md:flex md:w-[65%] relative overflow-hidden bg-slate-800">
        <img
          src={`${import.meta.env.BASE_URL}login_hero.png`}
          alt="Hero"
          className="absolute inset-0 w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/40 to-transparent" />
        <div className="relative z-10 flex flex-col justify-end p-12 text-white">
          <h2 className="text-4xl font-black mb-2 drop-shadow-lg">Bem-vindo ao Futuro da Logística</h2>
          <p className="text-lg font-bold text-slate-200 drop-shadow-md">Norte Tech WMS - Gestão Inteligente e Conectada.</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-right duration-500">
          <div className="flex flex-col items-center mb-10">
            <img
              src={`${import.meta.env.BASE_URL}norte_tech_logo.png`}
              alt="Norte Tech Logo"
              className="h-40 w-auto drop-shadow-2xl transition-all duration-700 hover:scale-110 mb-6"
            />
            <p className="text-slate-500 font-black uppercase text-[10px] tracking-[0.2em] mt-1 bg-slate-100 px-5 py-2 rounded-full border border-slate-200/50">
              Acesso restrito ao sistema
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-black text-center border border-red-100 animate-bounce">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Usuário ou e-mail</label>
              </div>
              <input
                type="text"
                required
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-700 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-sm"
                placeholder="ex: admin@nortetech.com"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Senha de acesso</label>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-700 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-sm"
                placeholder="Digite sua senha"
              />
            </div>

            <button
              type="submit"
              className="group relative w-full py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-primary/25 active:scale-[0.98] text-xs overflow-hidden"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                Entrar no sistema
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="size-4 group-hover:translate-x-1 transition-transform"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
