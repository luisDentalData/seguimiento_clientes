'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import GroupsManager from '@/components/GroupsManager';
import { Alert, Button, Spinner } from '@/dd/components';
import { api } from '@/lib/api';
import { useAnalysts } from '@/lib/useAnalysts';

const inputCls = 'px-3 py-2 bg-canvas border border-fg-subtle text-fg text-sm rounded-sm placeholder-fg-subtle focus:outline-none focus:border-ink transition-colors duration-base';

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

  return (
    <div>
      <Header title="Configuración" subtitle="Gestión de analistas del equipo" />

      {error && (
        <div className="mb-5">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {/* Alta de analista */}
      <div className="bg-surface border border-line p-5 mb-5">
        <h2 className="text-base font-medium text-fg mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-boss-primary text-[18px] leading-none" aria-hidden="true">person_add</span>
          Nueva analista
        </h2>
        <div className="flex flex-col md:flex-row gap-3">
          <input
            className={`${inputCls} flex-1`}
            placeholder="email@dentaldata.es"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <input
            className={`${inputCls} flex-1`}
            placeholder="Nombre y apellido"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <Button variant="primary" loading={saving} disabled={saving} onClick={handleCreate}>
            {saving ? 'Creando...' : 'Crear analista'}
          </Button>
        </div>
        <p className="text-xs text-fg-subtle mt-3">
          Debe ser @dentaldata.es para que el ETL pueda leer su calendario de Google. El próximo Sync bajará sus reuniones.
        </p>
      </div>

      {/* Lista de analistas */}
      <div className="bg-surface border border-line overflow-hidden">
        <div className="border-b border-line px-5 py-3.5">
          <span className="text-sm font-medium text-fg">Analistas ({all.length})</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas/50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-fg-muted uppercase tracking-wide">Nombre</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-fg-muted uppercase tracking-wide">Email</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-fg-muted uppercase tracking-wide">Estado</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-fg-muted uppercase tracking-wide">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center">
                    <Spinner className="mx-auto h-5 w-5" />
                  </td>
                </tr>
              ) : all.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-fg-muted">No hay analistas. Agregá una arriba.</td>
                </tr>
              ) : (
                all.map(a => (
                  <tr key={a.email} className="border-b border-line last:border-b-0 hover:bg-canvas/30 transition-colors duration-fast">
                    <td className="px-5 py-3.5 font-medium text-fg">{a.name}</td>
                    <td className="px-5 py-3.5 text-fg-muted">{a.email}</td>
                    <td className="px-5 py-3.5">
                      {a.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium bg-success/10 text-success border border-success/20">
                          <span className="material-symbols-outlined text-[13px] leading-none" aria-hidden="true">check_circle</span>
                          Activa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium bg-canvas text-fg-subtle border border-line">
                          Inactiva
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => renameAnalyst(a.email, a.name)}
                          title="Renombrar"
                          className="p-1.5 text-boss-primary hover:bg-boss-primary/10 transition-colors duration-fast"
                        >
                          <span className="material-symbols-outlined text-[16px] leading-none" aria-hidden="true">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(a.email, a.is_active)}
                          title={a.is_active ? 'Desactivar' : 'Reactivar'}
                          className={`p-1.5 transition-colors duration-fast ${
                            a.is_active
                              ? 'text-fg-muted hover:text-danger-fg hover:bg-danger-tint'
                              : 'text-success hover:bg-success/10'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px] leading-none" aria-hidden="true">power_settings_new</span>
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

      <GroupsManager />
    </div>
  );
}
