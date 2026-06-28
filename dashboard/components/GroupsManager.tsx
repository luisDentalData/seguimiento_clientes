'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { useGroups } from '@/lib/useGroups';
import { Alert, Button } from '@/dd/components';

interface ClientLite { id: string; name: string; }
const fetcher = (url: string) => api.get(url).then(res => res.data);

const inputCls = 'px-3 py-2 bg-canvas border border-fg-subtle text-fg text-sm rounded-sm placeholder-fg-subtle focus:outline-none focus:border-ink transition-colors duration-base';

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

  return (
    <div className="bg-surface border border-line overflow-hidden mt-6">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-base font-medium text-fg flex items-center gap-2">
          <span className="material-symbols-outlined text-boss-primary text-[18px] leading-none" aria-hidden="true">layers</span>
          Grupos de sedes ({groups.length})
        </h2>
        <p className="text-xs text-fg-muted mt-1">Sedes de un mismo grupo comparten sus reuniones automáticamente.</p>
      </div>

      <div className="p-5 space-y-4">
        {error && (
          <Alert variant="error">{error}</Alert>
        )}

        {/* Crear grupo */}
        <div className="flex gap-2">
          <input
            className={`${inputCls} flex-1`}
            placeholder="Nombre del grupo (ej. Maxal)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createGroup()}
          />
          <Button variant="primary" onClick={createGroup}>
            <span className="material-symbols-outlined text-[14px] leading-none" aria-hidden="true">add</span>
            Crear grupo
          </Button>
        </div>

        {groups.length === 0 ? (
          <p className="text-fg-muted text-sm py-4 text-center">No hay grupos. Creá uno arriba.</p>
        ) : (
          <div className="space-y-3">
            {groups.map(g => (
              <div key={g.id} className="bg-canvas border border-line p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-fg">{g.name}</h3>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => renameGroup(g.id, g.name)}
                      title="Renombrar"
                      className="p-1.5 text-boss-primary hover:bg-boss-primary/10 transition-colors duration-fast"
                    >
                      <span className="material-symbols-outlined text-[15px] leading-none" aria-hidden="true">edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteGroup(g.id, g.name)}
                      title="Borrar grupo"
                      className="p-1.5 text-fg-muted hover:text-danger-fg hover:bg-danger-tint transition-colors duration-fast"
                    >
                      <span className="material-symbols-outlined text-[15px] leading-none" aria-hidden="true">delete</span>
                    </button>
                  </div>
                </div>

                {/* Sedes (chips) */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {g.members.length === 0 ? (
                    <span className="text-xs text-fg-subtle">Sin sedes asignadas</span>
                  ) : g.members.map(m => (
                    <span key={m.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface border border-line text-sm text-fg">
                      {m.name}
                      <button
                        type="button"
                        onClick={() => removeMember(g.id, m.id)}
                        title="Quitar sede"
                        className="text-fg-muted hover:text-danger-fg transition-colors duration-fast"
                      >
                        <span className="material-symbols-outlined text-[13px] leading-none" aria-hidden="true">close</span>
                      </button>
                    </span>
                  ))}
                </div>

                {/* Agregar sede */}
                <div className="flex gap-2">
                  <select
                    className={`${inputCls} flex-1`}
                    value={picker[g.id] ?? ''}
                    onChange={e => setPicker(p => ({ ...p, [g.id]: e.target.value }))}
                  >
                    <option value="">+ Agregar sede...</option>
                    {(clients ?? []).map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => addMember(g.id)}
                    disabled={!picker[g.id]}
                    className="px-3 py-2 text-sm bg-surface border border-line text-fg hover:border-line-strong disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-base"
                  >
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
