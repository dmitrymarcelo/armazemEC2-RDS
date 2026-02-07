import React, { useState } from 'react';
import { InventoryItem, Vendor, Vehicle } from '../types';
import * as XLSX from 'xlsx';

type Tab = 'itens' | 'fornecedores' | 'frota';

interface MasterDataProps {
  inventory: InventoryItem[];
  vendors: Vendor[];
  vehicles?: Vehicle[];
  onAddRecord: (type: 'item' | 'vendor' | 'vehicle', data: any, isEdit: boolean) => void;
  onRemoveRecord?: (type: 'item' | 'vendor' | 'vehicle', id: string) => void;
  onImportRecords: (type: 'item' | 'vendor' | 'vehicle', data: any[]) => void;
  onSyncAPI?: (token: string) => void;
}

export const MasterData: React.FC<MasterDataProps> = ({ inventory, vendors, vehicles = [], onAddRecord, onRemoveRecord, onImportRecords, onSyncAPI }) => {
  const [activeTab, setActiveTab] = useState<Tab>('itens');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Form States
  const [formData, setFormData] = useState<any>({});

  const handleOpenModal = (existingData?: any) => {
    if (existingData) {
      setFormData(existingData);
      setIsEditing(true);
    } else {
      setFormData({});
      setIsEditing(false);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const type = activeTab === 'itens' ? 'item' :
      activeTab === 'fornecedores' ? 'vendor' : 'vehicle';
    onAddRecord(type as any, formData, isEditing);
    setIsModalOpen(false);
  };

  const handleSyncAPI = () => {
    const savedToken = localStorage.getItem('fleet_api_token') || '42eee9fe816a9a49c7edcc909eba561db2ea23dc'; // Default to user's provided token for convenience
    const token = window.prompt('Informe o Token da Fleet API:', savedToken);
    if (token && onSyncAPI) {
      localStorage.setItem('fleet_api_token', token);
      onSyncAPI(token);
    }
  };

  const handleDelete = (id: string) => {
    if (onRemoveRecord) {
      const type = activeTab === 'itens' ? 'item' :
        activeTab === 'fornecedores' ? 'vendor' : 'vehicle';
      if (confirm('Tem certeza que deseja excluir este registro?')) {
        onRemoveRecord(type, id);
      }
    }
  };

  const handleDownloadTemplate = () => {
    let headers: string[] = [];
    let fileName = '';

    if (activeTab === 'itens') {
      headers = ['Nome', 'Unidade de Medida', 'Quantidade', 'Quantidade Mínima'];
      fileName = 'template_itens_logiwms.xlsx';
    } else if (activeTab === 'fornecedores') {
      headers = ['NOME', 'CNPJ', 'CONTATO', 'STATUS'];
      fileName = 'template_fornecedores_logiwms.xlsx';
    } else if (activeTab === 'frota') {
      headers = ['PLACA', 'MODELO', 'TIPO', 'CENTRO_CUSTO'];
      fileName = 'template_frota_logiwms.xlsx';
    }

    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, fileName);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      const findKey = (row: any, ...keys: string[]) => {
        const rowKeys = Object.keys(row);
        for (const k of keys) {
          const found = rowKeys.find(rk => rk.toLowerCase().trim() === k.toLowerCase());
          if (found) return row[found];
        }
        return undefined;
      };

      let mappedData: any[] = [];
      const type = activeTab === 'itens' ? 'item' : activeTab === 'fornecedores' ? 'vendor' : 'vehicle';

      if (activeTab === 'itens') {
        mappedData = data.map((row: any) => {
          return {
            sku: '',
            name: findKey(row, 'Nome', 'NOME', 'PRODUTO', 'DESCRICAO') || 'Produto Sem Nome',
            unit: findKey(row, 'Unidade de Medida', 'UNIDADE', 'UN', 'UNIT') || 'UN',
            category: findKey(row, 'Categoria', 'CATEGORIA') || 'Geral',
            quantity: Math.round(Number(findKey(row, 'Quantidade', 'QTD', 'QUANTIDADE')) || 0),
            minQty: Math.round(Number(findKey(row, 'Quantidade Mínima', 'QTD_MIN', 'MIN_QTY')) || 10),
            maxQty: 1000,
            imageUrl: findKey(row, 'Imagem', 'URL', 'IMAGE') || 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=400&q=80',
            status: 'disponivel',
            batch: 'N/A',
            expiry: 'N/A',
            location: 'DOCA-01'
          };
        });
      } else if (activeTab === 'fornecedores') {
        mappedData = data.map((row: any) => ({
          name: findKey(row, 'NOME', 'RAZAO SOCIAL', 'NOME FANTASIA') || 'Fornecedor Sem Nome',
          cnpj: findKey(row, 'CNPJ', 'DOCUMENTO', 'ID') || '',
          contact: findKey(row, 'CONTATO', 'RESPONSAVEL', 'EMAIL') || '',
          status: findKey(row, 'STATUS', 'SITUACAO') || 'Ativo',
          id: `VEN-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        }));
      } else if (activeTab === 'frota') {
        mappedData = data.map((row: any) => ({
          plate: findKey(row, 'PLACA', 'VEICULO') || '',
          model: findKey(row, 'MODELO', 'MARCA') || '',
          type: findKey(row, 'TIPO', 'CATEGORIA') || 'Truck',
          status: 'Disponível',
          lastMaintenance: new Date().toLocaleDateString('pt-BR'),
          costCenter: findKey(row, 'CENTRO_CUSTO', 'CENTRO DE CUSTO', 'CC') || ''
        }));
      }

      onImportRecords(type, mappedData);
      e.target.value = ''; // Reset input
    };
    reader.readAsBinaryString(file);
  };

  const ActionButtons = ({ onEdit, onDelete }: { onEdit: () => void, onDelete: () => void }) => (
    <div className="flex items-center gap-3 justify-end">
      {/* Botão de Edição - Estilo Premium Square */}
      <button
        onClick={onEdit}
        className="group relative size-11 flex items-center justify-center transition-all active:scale-95"
        title="Editar"
      >
        <div className="absolute inset-0 border-[2.5px] border-primary rounded-xl bg-primary/5 group-hover:bg-primary/10 group-hover:scale-105 transition-all"></div>
        <svg xmlns="http://www.w3.org/2000/svg" className="size-5 text-primary z-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>

      {/* Botão de Exclusão - Estilo Premium Square Rose */}
      <button
        onClick={onDelete}
        className="group relative size-11 flex items-center justify-center transition-all active:scale-95"
        title="Excluir"
      >
        <div className="absolute inset-0 border-[2.5px] border-rose-500 rounded-xl bg-rose-500/5 group-hover:bg-rose-500/10 group-hover:scale-105 transition-all"></div>
        <svg xmlns="http://www.w3.org/2000/svg" className="size-5 text-rose-500 z-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </button>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h2 className="text-2xl lg:text-4xl font-black tracking-tighter text-slate-800 dark:text-white">Cadastro Geral</h2>
          <p className="text-slate-500 text-sm font-medium mt-1">Gestão centralizada de ativos, parceiros e logística.</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleDownloadTemplate}
            className="px-6 py-4 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-2 border-slate-100 dark:border-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95 flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Baixar Modelo (.xlsx)
          </button>

          <label className="px-6 py-4 bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:bg-emerald-600 transition-all active:scale-95 flex items-center gap-2 cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Importar (.xlsx)
            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImport} />
          </label>

          {activeTab === 'frota' && (
            <button
              onClick={handleSyncAPI}
              className="px-6 py-4 bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:bg-indigo-600 transition-all active:scale-95 flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9-9a9 9 0 0 0-9 9" />
              </svg>
              Sincronizar API
            </button>
          )}

          <button
            onClick={() => handleOpenModal()}
            className="px-8 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/25 hover:bg-blue-600 transition-all active:scale-95 flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
            Novo {activeTab === 'itens' ? 'Item' : activeTab === 'fornecedores' ? 'Fornecedor' : 'Veículo'}
          </button>
        </div>
      </div>

      <div className="flex gap-2 p-1.5 bg-slate-200/50 dark:bg-slate-800/40 rounded-2xl w-fit border border-slate-200 dark:border-slate-800 overflow-x-auto max-w-full">
        {(['itens', 'fornecedores', 'frota'] as const).map((tab) => {
          const count = tab === 'itens' ? inventory.length : tab === 'fornecedores' ? vendors.length : vehicles.length;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 lg:px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === tab ? 'bg-white dark:bg-slate-900 text-primary shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                }`}
            >
              {tab}
              <span className={`px-1.5 py-0.5 rounded-md text-[9px] ${activeTab === tab ? 'bg-primary/10 text-primary' : 'bg-slate-300/30 text-slate-400'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                {activeTab === 'itens' && (
                  <>
                    <th className="px-8 py-6">Identificação / Produto</th>
                    <th className="px-8 py-6">Código do Produto</th>
                    <th className="px-8 py-6">Categoria</th>
                    <th className="px-8 py-6 text-right">Gestão</th>
                  </>
                )}
                {activeTab === 'fornecedores' && (
                  <>
                    <th className="px-8 py-6">Razão Social / Nome</th>
                    <th className="px-8 py-6">CNPJ / Documento</th>
                    <th className="px-8 py-6 text-center">Status</th>
                    <th className="px-8 py-6 text-right">Gestão</th>
                  </>
                )}
                {activeTab === 'frota' && (
                  <>
                    <th className="px-8 py-6">Veículo / Placa</th>
                    <th className="px-8 py-6">Tipo</th>
                    <th className="px-8 py-6">Centro de Custo</th>
                    <th className="px-8 py-6 text-right">Gestão</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {activeTab === 'itens' && inventory.map((item, i) => (
                <tr key={item.sku} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all group">
                  <td className="px-8 py-5 flex items-center gap-4">
                    <img src={item.imageUrl} className="size-12 rounded-xl object-cover shadow-sm border-2 border-white dark:border-slate-800" alt="" />
                    <div>
                      <p className="text-sm font-black text-slate-800 dark:text-white leading-tight">{item.name}</p>
                      <p className="text-[10px] text-slate-400 font-black uppercase">EAN: 7891000{i}221</p>
                    </div>
                  </td>
                  <td className="px-8 py-5 font-mono text-[11px] font-black text-primary">{item.sku}</td>
                  <td className="px-8 py-5">
                    <span className="text-[10px] font-black px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 uppercase tracking-tighter">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end">
                      <ActionButtons
                        onEdit={() => handleOpenModal(item)}
                        onDelete={() => handleDelete(item.sku)}
                      />
                    </div>
                  </td>
                </tr>
              ))}

              {activeTab === 'fornecedores' && vendors.map((vendor) => (
                <tr key={vendor.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all group">
                  <td className="px-8 py-5">
                    <p className="text-sm font-black text-slate-800 dark:text-white leading-tight">{vendor.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{vendor.contact}</p>
                  </td>
                  <td className="px-8 py-5 font-mono text-[11px] font-black text-slate-500">{vendor.cnpj}</td>
                  <td className="px-8 py-5 text-center">
                    <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${vendor.status === 'Ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {vendor.status}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end">
                      <ActionButtons
                        onEdit={() => handleOpenModal(vendor)}
                        onDelete={() => handleDelete(vendor.id)}
                      />
                    </div>
                  </td>
                </tr>
              ))}

              {activeTab === 'frota' && vehicles.map((v) => (
                <tr key={v.plate} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all group">
                  <td className="px-8 py-5">
                    <p className="text-sm font-black text-slate-800 dark:text-white leading-tight">{v.plate}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{v.model}</p>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-[10px] font-black px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 uppercase">
                      {v.type}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-xs font-bold text-slate-600 dark:text-slate-400">
                    {v.costCenter || '-'}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end">
                      <ActionButtons
                        onEdit={() => handleOpenModal(v)}
                        onDelete={() => handleDelete(v.plate)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500 border border-slate-100 dark:border-slate-800">
            <div className="p-10 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
              <div>
                <h3 className="text-2xl font-black tracking-tight text-slate-800 dark:text-white">
                  {isEditing ? 'Editar' : 'Novo'} {activeTab === 'itens' ? 'Item Mestre' : activeTab === 'fornecedores' ? 'Fornecedor' : 'Ativo de Frota'}
                </h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">LogiWMS Pro • Sincronização em Tempo Real</p>
              </div>
              <div className="flex items-center gap-3">
                {isEditing && (
                  <button
                    onClick={() => {
                      const id = activeTab === 'itens' ? formData.sku : activeTab === 'fornecedores' ? formData.id : formData.plate;
                      handleDelete(id);
                      setIsModalOpen(false);
                    }}
                    className="size-12 flex items-center justify-center bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white shadow-sm transition-all border border-rose-100 dark:border-rose-800"
                    title="Excluir Registro"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                )}
                <button onClick={() => setIsModalOpen(false)} className="size-12 flex items-center justify-center bg-white dark:bg-slate-800 rounded-2xl text-slate-400 hover:text-red-500 shadow-sm transition-all border border-slate-100 dark:border-slate-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-10 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {activeTab === 'itens' && (
                  <>
                    <div className="space-y-2 col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nome do Produto</label>
                      <input required value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 focus:border-primary focus:ring-0 rounded-2xl font-bold text-sm" placeholder="Ex: Monitor UltraWide 34..." />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Código do Produto</label>
                      <input
                        required
                        disabled
                        value={formData.sku || 'Gerado Automaticamente'}
                        className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-black text-sm text-primary opacity-70"
                        placeholder="000000"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Categoria</label>
                      <select required value={formData.category || ''} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-bold text-sm">
                        <option value="">Selecione...</option>
                        <option value="Equipamentos">Equipamentos</option>
                        <option value="Máquinas">Máquinas</option>
                        <option value="Ferramentas Manuais">Ferramentas Manuais</option>
                        <option value="Pneumáticas">Pneumáticas</option>
                        <option value="Elétricas">Elétricas</option>
                        <option value="Motor">Motor</option>
                        <option value="Freios">Freios</option>
                        <option value="Suspensão">Suspensão</option>
                        <option value="Direção">Direção</option>
                        <option value="Insumos Químicos">Insumos Químicos</option>
                        <option value="Lubrificantes">Lubrificantes</option>
                        <option value="Fluidos">Fluidos</option>
                        <option value="Óleos">Óleos</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Unidade de Medida</label>
                      <select required value={formData.unit || ''} onChange={e => setFormData({ ...formData, unit: e.target.value })} className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-bold text-sm">
                        <option value="">Selecione...</option>
                        <option value="UN">UN - Unidade</option>
                        <option value="KG">KG - Quilograma</option>
                        <option value="LT">LT - Litro</option>
                        <option value="MT">MT - Metro</option>
                        <option value="CX">CX - Caixa</option>
                        <option value="FD">FD - Fardo</option>
                        <option value="PCT">PCT - Pacote</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Quantidade Mínima (Estoque)</label>
                      <input type="number" required value={formData.minQty || 10} onChange={e => setFormData({ ...formData, minQty: Number(e.target.value) })} className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-bold text-sm" />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">URL da Imagem (Ex: Unsplash)</label>
                      <input required value={formData.imageUrl || ''} onChange={e => setFormData({ ...formData, imageUrl: e.target.value })} className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-medium text-sm" placeholder="https://..." />
                    </div>
                  </>
                )}

                {activeTab === 'fornecedores' && (
                  <>
                    <div className="space-y-2 col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Razão Social</label>
                      <input required value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-bold text-sm" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">CNPJ</label>
                      <input required value={formData.cnpj || ''} onChange={e => setFormData({ ...formData, cnpj: e.target.value })} className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-mono text-sm" placeholder="00.000.000/0001-00" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Contato Responsável</label>
                      <input required value={formData.contact || ''} onChange={e => setFormData({ ...formData, contact: e.target.value })} className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-bold text-sm" />
                    </div>
                  </>
                )}

                {activeTab === 'frota' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Placa do Veículo</label>
                      <input required disabled={isEditing} value={formData.plate || ''} onChange={e => setFormData({ ...formData, plate: e.target.value.toUpperCase() })} className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-black text-sm disabled:opacity-50" placeholder="ABC-1234" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Modelo</label>
                      <input required value={formData.model || ''} onChange={e => setFormData({ ...formData, model: e.target.value })} className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-bold text-sm" />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Centro de Custo</label>
                      <input
                        value={formData.costCenter || ''}
                        onChange={e => setFormData({ ...formData, costCenter: e.target.value })}
                        className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-bold text-sm"
                        placeholder="Ex: OFICINA, ADM..."
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="pt-8 flex gap-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-3xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-[2] py-5 bg-primary text-white rounded-3xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary/20 hover:opacity-90 transition-all active:scale-95"
                >
                  {isEditing ? 'Salvar Alterações' : 'Finalizar Cadastro Master'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
