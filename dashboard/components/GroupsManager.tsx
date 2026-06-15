'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Layers, Plus, Pencil, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useGroups } from '@/lib/useGroups';

interface ClientLite { id: string; name: string; }
const fetcher = (url: string) => api.get(url).then(res => res.data);

export default function GroupsManager() {
  const { groups, mutate } = useGroups();
  const { data: clients } = useSWR<ClientLite[]>('/clients?limit=500&active_only=true', fetcher);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<Record<number, string>>({});

  const showErr = (err: unknown, fb: string) => {
    const d = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
    setError(d || fb);
  };

  const createGroup = async () => {
    setError(null);
    if (!newName.trim()) { setError('El nombre del grupo es obligatorio'); return; }
    try {
      await api.post('/groups', { name: newName.trim() });
      setNewName('');
      mutate();
    } catch (err) { showErr(err, 'No se pudo crear el grupo'); }
  };

  const renameGroup = async (id: number, current: string) => {
    const n = window.prompt('Nuevo nombre del grupo:', current);
    if (!n || !n.trim() || n.trim() === current) return;
    try { await api.put(`/groups/${id}`, { name: n.trim() }); mutate(); }
    catch (err) { showErr(err, 'No se pudo renombrar'); }
  };

  const deleteGroup = async (id: number, name: string) => {
    if (!window.confirm(`¿Borrar el grupo "${name}"? Las sedes quedan sin grupo (no se borran) y se limpian sus reuniones duplicadas.`)) return;
    try { await api.delete(`/groups/${id}`); mutate(); }
    catch (err) { showErr(err, 'No se pudo borrar el grupo'); }
  };

  const addMember = async (groupId: number) => {
    const clientId = picker[groupId];
    if (!clientId) return;
    try {
      await api.post(`/groups/${groupId}/members/${encodeURIComponent(clientId)}`);
      setPicker(p => ({ ...p, [groupId]: '' }));
      mutate();
    } catch (err) { showErr(err, 'No se pudo asignar la sede'); }
  };

  const removeMember = async (groupId: number, clientId: string) => {
    try { await api.delete(`/groups/${groupId}/members/${encodeURIComponent(clientId)}`); mutate(); }
    catch (err) { showErr(err, 'No se pudo quitar la sede'); }
  };

  const inputClass = 'px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors';

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl overflow-hidden mt-6">
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-slate-700 px-6 py-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Layers className="w-5 h-5" /> Grupos de sedes ({groups.length})
        </h2>
        <p className="text-sm text-slate-400 mt-1">Sedes de un mismo grupo comparten sus reuniones automáticamente.</p>
      </div>

      <div className="p-6 space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-3 text-sm text-red-300">{error}</div>
        )}

        {/* Crear grupo */}
        <div className="flex gap-3">
          <input className={`${inputClass} flex-1`} placeholder="Nombre del grupo (ej. Maxal)" value={newName} onChange={e => setNewName(e.target.value)} />
          <button onClick={createGroup} className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors whitespace-nowrap">
            <Plus className="w-4 h-4" /> Crear grupo
          </button>
        </div>

        {/* Lista de grupos */}
        {groups.length === 0 ? (
          <p className="text-slate-400 text-sm py-4 text-center">No hay grupos. Creá uno arriba.</p>
        ) : (
          <div className="space-y-3">
            {groups.map(g => (
              <div key={g.id} className="bg-slate-900/40 border border-slate-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-white">{g.name}</h3>
                  <div className="flex gap-2">
                    <button onClick={() => renameGroup(g.id, g.name)} className="p-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded transition-colors" title="Renombrar">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteGroup(g.id, g.name)} className="p-1.5 bg-slate-700 hover:bg-red-500/30 text-slate-300 hover:text-red-300 rounded transition-colors" title="Borrar grupo">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Sedes (chips) */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {g.members.length === 0 ? (
                    <span className="text-xs text-slate-500">Sin sedes asignadas</span>
                  ) : g.members.map(m => (
                    <span key={m.id} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-700/60 border border-slate-600 rounded text-sm text-slate-200">
                      {m.name}
                      <button onClick={() => removeMember(g.id, m.id)} className="text-slate-400 hover:text-red-300" title="Quitar sede">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                {/* Agregar sede */}
                <div className="flex gap-2">
                  <select
                    className={`${inputClass} flex-1`}
                    value={picker[g.id] ?? ''}
                    onChange={e => setPicker(p => ({ ...p, [g.id]: e.target.value }))}
                  >
                    <option value="">+ Agregar sede...</option>
                    {(clients ?? []).map(c => (
                      <option key={c.id} value={c.id} className="bg-slate-800">{c.name} ({c.id})</option>
                    ))}
                  </select>
                  <button onClick={() => addMember(g.id)} disabled={!picker[g.id]} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 rounded-lg transition-colors">
                    Agregar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
