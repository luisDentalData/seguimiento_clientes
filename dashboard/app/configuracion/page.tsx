'use client';

import { useState } from 'react';
import { UserPlus, Power, Pencil, CheckCircle2, AlertCircle } from 'lucide-react';
import Header from '@/components/Header';
import GroupsManager from '@/components/GroupsManager';
import { api } from '@/lib/api';
import { useAnalysts } from '@/lib/useAnalysts';

export default function ConfiguracionPage() {
  const { all, mutate, isLoading } = useAnalysts();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const showError = (err: unknown, fallback: string) => {
    const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
    setError(detail || fallback);
  };

  const handleCreate = async () => {
    setError(null);
    if (!email.trim() || !name.trim()) {
      setError('Email y nombre son obligatorios');
      return;
    }
    setSaving(true);
    try {
      await api.post('/analysts', { email: email.trim(), name: name.trim() });
      setEmail('');
      setName('');
      mutate();
    } catch (err) {
      showError(err, 'No se pudo crear la analista');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (analystEmail: string, isActive: boolean) => {
    try {
      if (isActive) {
        await api.post(`/analysts/${encodeURIComponent(analystEmail)}/deactivate`);
      } else {
        await api.put(`/analysts/${encodeURIComponent(analystEmail)}`, { is_active: true });
      }
      mutate();
    } catch (err) {
      showError(err, 'No se pudo cambiar el estado');
    }
  };

  const renameAnalyst = async (analystEmail: string, currentName: string) => {
    const nuevo = window.prompt('Nuevo nombre:', currentName);
    if (!nuevo || !nuevo.trim() || nuevo.trim() === currentName) return;
    try {
      await api.put(`/analysts/${encodeURIComponent(analystEmail)}`, { name: nuevo.trim() });
      mutate();
    } catch (err) {
      showError(err, 'No se pudo renombrar');
    }
  };

  const inputClass =
    'px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors';

  return (
    <div>
      <Header title="Configuración" subtitle="Gestión de analistas del equipo" />

      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/40 rounded-xl p-4 flex items-center gap-3 text-sm text-red-300">
          <AlertCircle className="w-5 h-5 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Alta de analista */}
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <UserPlus className="w-5 h-5" /> Nueva analista
        </h2>
        <div className="flex flex-col md:flex-row gap-3">
          <input
            className={`${inputClass} flex-1`}
            placeholder="email@dentaldata.es"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <input
            className={`${inputClass} flex-1`}
            placeholder="Nombre y apellido"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <button
            onClick={handleCreate}
            disabled={saving}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg transition-colors whitespace-nowrap"
          >
            {saving ? 'Creando...' : 'Crear analista'}
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Debe ser @dentaldata.es para que el ETL pueda leer su calendario de Google. El próximo Sync bajará sus reuniones.
        </p>
      </div>

      {/* Lista de analistas */}
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-slate-700 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Analistas ({all.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900/50 border-b border-slate-700">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Nombre</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Email</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {isLoading ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400">Cargando...</td></tr>
              ) : all.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400">No hay analistas. Agregá una arriba.</td></tr>
              ) : (
                all.map(a => (
                  <tr key={a.email} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-white">{a.name}</td>
                    <td className="px-6 py-4 text-slate-400">{a.email}</td>
                    <td className="px-6 py-4">
                      {a.is_active ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-500/20 border border-green-500/50 text-green-300 text-sm">
                          <CheckCircle2 className="w-4 h-4" /> Activa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-600/30 border border-slate-600 text-slate-400 text-sm">
                          Inactiva
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => renameAnalyst(a.email, a.name)}
                          className="p-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-colors"
                          title="Renombrar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleActive(a.email, a.is_active)}
                          className={`p-2 rounded-lg transition-colors ${
                            a.is_active
                              ? 'bg-slate-700 hover:bg-red-500/30 text-slate-300 hover:text-red-300'
                              : 'bg-green-500/20 hover:bg-green-500/30 text-green-300'
                          }`}
                          title={a.is_active ? 'Desactivar' : 'Reactivar'}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grupos de sedes que comparten reuniones */}
      <GroupsManager />
    </div>
  );
}
