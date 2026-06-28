'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import Header from '@/components/Header';
import ClientFormModal from '@/components/ClientFormModal';
import { Alert, Modal, Button, Spinner } from '@/dd/components';
import { api } from '@/lib/api';
import { useAnalysts } from '@/lib/useAnalysts';
import type { PortfolioClient, ClientStatus, Appointment } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const fetcher = (url: string) => api.get(url).then(res => res.data);

const statusConfig: Record<ClientStatus, { label: string; icon: string; className: string }> = {
  OK: {
    label: 'OK',
    icon: 'check_circle',
    className: 'bg-success/10 text-success border border-success/20',
  },
  ATTENTION: {
    label: 'Pendiente',
    icon: 'warning',
    className: 'bg-accent/10 text-accent border border-accent/20',
  },
  CRITICAL: {
    label: 'Crítico',
    icon: 'error',
    className: 'bg-danger-tint text-danger-fg border border-danger-fg/20',
  },
};

const daysSinceClass = (days: number | null) => {
  if (days === null || days > 60) return 'text-danger-fg';
  if (days > 30) return 'text-accent';
  return 'text-success';
};

function formatDays(days: number | null) {
  if (days === null) return 'Sin sesiones';
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  return `${days} días`;
}

export default function ClientesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClientStatus | 'ALL'>('ALL');
  const [analystFilter, setAnalystFilter] = useState<string>('all');
  const [dateSort, setDateSort] = useState<'desc' | 'asc' | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formClientId, setFormClientId] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const portfolioKey = analystFilter === 'all'
    ? '/clients/portfolio'
    : `/clients/portfolio?analyst_email=${encodeURIComponent(analystFilter)}`;

  const { data: portfolio, error, isLoading, mutate } = useSWR<PortfolioClient[]>(
    portfolioKey,
    fetcher,
    { refreshInterval: 30000 }
  );

  const openCreate = () => { setFormClientId(null); setFormOpen(true); };
  const openEdit = (id: string) => { setFormClientId(id); setFormOpen(true); };

  const handleSaved = (createdId: string | null) => {
    mutate();
    setSavedMsg(
      createdId
        ? `Cliente ${createdId} creado. Dale a "Sincronizar" para matchear sus reuniones.`
        : 'Cliente actualizado.'
    );
  };

  const handleDeactivate = async (id: string, name: string) => {
    if (!window.confirm(`¿Desactivar a "${name}"? No se borra nada; deja de aparecer en el portfolio activo.`)) return;
    try {
      await api.post(`/clients/${id}/deactivate`);
      mutate();
      setSavedMsg(`Cliente ${name} desactivado.`);
    } catch {
      setSavedMsg('No se pudo desactivar el cliente. Reintentá.');
    }
  };

  const { data: clientMeetings } = useSWR<Appointment[]>(
    selectedClientId ? `/appointments?matched_client_id=${selectedClientId}&limit=1000` : null,
    fetcher
  );

  const clients = useMemo(() => portfolio ?? [], [portfolio]);

  const filteredClients = useMemo(() => {
    let result = clients.filter(client => {
      const matchesSearch = searchQuery === '' ||
        client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (client.nombre_contacto?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
      const matchesStatus = statusFilter === 'ALL' || client.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    if (dateSort !== null) {
      result = [...result].sort((a, b) => {
        const aTime = a.last_session ? new Date(a.last_session).getTime() : 0;
        const bTime = b.last_session ? new Date(b.last_session).getTime() : 0;
        return dateSort === 'asc' ? aTime - bTime : bTime - aTime;
      });
    }
    return result;
  }, [clients, searchQuery, statusFilter, dateSort]);

  const statusCounts = useMemo(() => ({
    OK:        clients.filter(c => c.status === 'OK').length,
    ATTENTION: clients.filter(c => c.status === 'ATTENTION').length,
    CRITICAL:  clients.filter(c => c.status === 'CRITICAL').length,
  }), [clients]);

  const selectedClient = selectedClientId
    ? clients.find(c => c.id === selectedClientId) ?? null
    : null;

  const selectedClientMeetings = useMemo(() => {
    if (!clientMeetings) return [];
    return clientMeetings
      .filter(apt => apt.is_client_meeting)
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  }, [clientMeetings]);

  const { active: activeAnalysts, nameByEmail } = useAnalysts();
  const analysts = [
    { value: 'all', label: 'Todos los analistas' },
    ...activeAnalysts.map(a => ({ value: a.email, label: a.name })),
  ];

  const cycleDateSort = () => {
    setDateSort(prev => prev === null ? 'desc' : prev === 'desc' ? 'asc' : null);
  };

  return (
    <div>
      <Header
        title="Gestión de Clientes"
        subtitle="Seguimiento y priorización por estado actual de sesiones (calculado en el servidor, desde HOY)"
      />

      {error && (
        <div className="mb-6">
          <Alert variant="error" title="No se pudo cargar el portfolio de clientes">
            El backend no respondió. Verificá que esté corriendo y reintentá.
          </Alert>
        </div>
      )}

      {/* Status Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <button
          onClick={() => setStatusFilter('ALL')}
          className="bg-surface border border-line p-5 text-left transition-colors duration-base hover:border-line-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-boss-primary"
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-boss-primary text-[24px] leading-none" aria-hidden="true">group</span>
            <div>
              <div className="font-display font-bold text-2xl text-fg">{clients.length}</div>
              <div className="text-xs text-fg-muted">Total Clientes</div>
            </div>
          </div>
        </button>

        <button
          onClick={() => setStatusFilter(statusFilter === 'OK' ? 'ALL' : 'OK')}
          className={`bg-surface border p-5 text-left transition-colors duration-base hover:border-success/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-boss-primary ${statusFilter === 'OK' ? 'border-success' : 'border-line'}`}
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-success text-[24px] leading-none" aria-hidden="true">check_circle</span>
            <div>
              <div className="font-display font-bold text-2xl text-fg">{statusCounts.OK}</div>
              <div className="text-xs text-fg-muted">Clientes OK</div>
              <div className="text-xs text-success">Sesión reciente (≤30d)</div>
            </div>
          </div>
        </button>

        <button
          onClick={() => setStatusFilter(statusFilter === 'ATTENTION' ? 'ALL' : 'ATTENTION')}
          className={`bg-surface border p-5 text-left transition-colors duration-base hover:border-accent/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-boss-primary ${statusFilter === 'ATTENTION' ? 'border-accent' : 'border-line'}`}
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-accent text-[24px] leading-none" aria-hidden="true">warning</span>
            <div>
              <div className="font-display font-bold text-2xl text-fg">{statusCounts.ATTENTION}</div>
              <div className="text-xs text-fg-muted">Pendientes</div>
              <div className="text-xs text-accent">31-60 días sin sesión</div>
            </div>
          </div>
        </button>

        <button
          onClick={() => setStatusFilter(statusFilter === 'CRITICAL' ? 'ALL' : 'CRITICAL')}
          className={`bg-surface border p-5 text-left transition-colors duration-base hover:border-danger-fg/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-boss-primary ${statusFilter === 'CRITICAL' ? 'border-danger-fg' : 'border-line'}`}
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-danger-fg text-[24px] leading-none" aria-hidden="true">error</span>
            <div>
              <div className="font-display font-bold text-2xl text-fg">{statusCounts.CRITICAL}</div>
              <div className="text-xs text-fg-muted">Críticos</div>
              <div className="text-xs text-danger-fg">&gt;60 días sin sesión</div>
            </div>
          </div>
        </button>
      </div>

      {/* Success notification */}
      {savedMsg && (
        <div className="mb-4">
          <Alert variant="success">
            <span className="flex items-center justify-between gap-3">
              {savedMsg}
              <button
                type="button"
                onClick={() => setSavedMsg(null)}
                className="text-success/70 hover:text-success shrink-0"
                aria-label="Cerrar"
              >
                <span className="material-symbols-outlined text-[16px] leading-none" aria-hidden="true">close</span>
              </button>
            </span>
          </Alert>
        </div>
      )}

      {/* Search Bar + Analyst Filter + Nuevo cliente */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted text-[18px] leading-none pointer-events-none" aria-hidden="true">
            search
          </span>
          <input
            type="text"
            placeholder="Buscar por nombre de cliente o contacto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-fg-subtle text-fg text-sm rounded-sm placeholder-fg-muted focus:outline-none focus:border-ink transition-colors duration-base"
          />
        </div>

        <div className="relative">
          <select
            value={analystFilter}
            onChange={(e) => setAnalystFilter(e.target.value)}
            className="appearance-none pl-3 pr-9 py-2.5 bg-surface border border-fg-subtle text-fg text-sm rounded-sm focus:outline-none focus:border-ink transition-colors duration-base cursor-pointer min-w-[180px]"
          >
            {analysts.map(a => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
          <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-muted text-[18px] leading-none pointer-events-none" aria-hidden="true">
            expand_more
          </span>
        </div>

        <Button variant="primary" onClick={openCreate}>
          <span className="material-symbols-outlined text-[16px] leading-none" aria-hidden="true">person_add</span>
          Nuevo cliente
        </Button>
      </div>

      {/* Clients Table */}
      <div className="bg-surface border border-line overflow-hidden mb-6">
        <div className="border-b border-line px-5 py-3.5 flex items-center justify-between">
          <span className="text-sm font-medium text-fg">
            Listado de Clientes ({filteredClients.length})
          </span>
          {statusFilter !== 'ALL' && (
            <button
              onClick={() => setStatusFilter('ALL')}
              className="text-xs text-boss-primary hover:text-boss-primary-2 transition-colors duration-base"
            >
              Ver todos
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas/50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-fg-muted uppercase tracking-wide">Estado</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-fg-muted uppercase tracking-wide">Cliente</th>
                <th
                  className="px-5 py-3 text-left text-xs font-semibold text-fg-muted uppercase tracking-wide cursor-pointer hover:text-fg select-none"
                  onClick={cycleDateSort}
                >
                  <span className="flex items-center gap-1">
                    Última Sesión
                    <span className="material-symbols-outlined text-[14px] leading-none" aria-hidden="true">
                      {dateSort === null ? 'unfold_more' : dateSort === 'desc' ? 'arrow_downward' : 'arrow_upward'}
                    </span>
                  </span>
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-fg-muted uppercase tracking-wide">Días sin Sesión</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-fg-muted uppercase tracking-wide">Sesiones</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-fg-muted uppercase tracking-wide">Analista</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-fg-muted uppercase tracking-wide">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center">
                    <div className="flex items-center justify-center gap-2 text-fg-muted">
                      <Spinner className="h-4 w-4" />
                      <span>Cargando portfolio...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-fg-muted">
                    {searchQuery ? 'No se encontraron clientes con ese criterio' : 'No hay clientes disponibles'}
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const cfg = statusConfig[client.status];
                  const lastSessionDate = client.last_session ? new Date(client.last_session) : null;

                  return (
                    <tr key={client.id} className="border-b border-line last:border-b-0 hover:bg-canvas/30 transition-colors duration-fast">
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium ${cfg.className}`}>
                          <span className="material-symbols-outlined text-[13px] leading-none" aria-hidden="true">{cfg.icon}</span>
                          {cfg.label}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="font-medium text-fg">{client.name}</div>
                        {client.nombre_contacto && (
                          <div className="text-xs text-fg-muted">{client.nombre_contacto}</div>
                        )}
                        <div className="flex gap-1.5 mt-1">
                          {client.programa && (
                            <span className="px-1.5 py-0.5 bg-boss-primary/10 text-boss-light text-xs">{client.programa}</span>
                          )}
                          {client.provincia && (
                            <span className="px-1.5 py-0.5 bg-canvas text-fg-muted text-xs border border-line">{client.provincia}</span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap text-sm text-fg-muted">
                        {lastSessionDate
                          ? format(lastSessionDate, "d MMM yyyy", { locale: es })
                          : <span className="text-fg-subtle">Sin sesiones</span>
                        }
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`text-sm font-medium ${daysSinceClass(client.days_since)}`}>
                          {formatDays(client.days_since)}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap text-sm text-fg">
                        {client.valid_sessions}
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap text-sm text-fg-muted">
                        {client.last_analyst ? client.last_analyst.split('@')[0] : '—'}
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedClientId(client.id)}
                            title="Ver historial"
                            className="p-1.5 text-fg-muted hover:text-fg hover:bg-canvas transition-colors duration-fast"
                          >
                            <span className="material-symbols-outlined text-[16px] leading-none" aria-hidden="true">history</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(client.id)}
                            title="Editar cliente"
                            className="p-1.5 text-boss-primary hover:text-boss-primary-2 hover:bg-boss-primary/10 transition-colors duration-fast"
                          >
                            <span className="material-symbols-outlined text-[16px] leading-none" aria-hidden="true">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeactivate(client.id, client.name)}
                            title="Desactivar cliente"
                            className="p-1.5 text-fg-muted hover:text-danger-fg hover:bg-danger-tint transition-colors duration-fast"
                          >
                            <span className="material-symbols-outlined text-[16px] leading-none" aria-hidden="true">power_settings_new</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Footer */}
      <div className="mb-6">
        <Alert variant="info" title="Criterios de clasificación (desde HOY):">
          <ul className="space-y-1 text-xs text-fg-muted mt-1">
            <li><strong className="text-success">OK</strong>: sesión en los últimos 30 días</li>
            <li><strong className="text-accent">Pendiente</strong>: sin sesión entre 31-60 días</li>
            <li><strong className="text-danger-fg">Crítico</strong>: sin sesión &gt;60 días o sin sesiones</li>
            <li className="mt-2 pt-2 border-t border-line">
              Solo se contabilizan <code className="px-1 bg-canvas text-xs">is_client_meeting=true</code> (CONFIRMED y PROBABLE).
            </li>
          </ul>
        </Alert>
      </div>

      {/* Meeting History Modal */}
      <Modal
        open={selectedClientId !== null}
        onClose={() => setSelectedClientId(null)}
        title="Historial de Reuniones"
        className="max-w-3xl"
      >
        {selectedClient && (
          <p className="text-sm text-fg-muted -mt-2">{selectedClient.name}</p>
        )}

        <div className="overflow-y-auto max-h-[50vh] space-y-2.5">
          {selectedClientMeetings.length === 0 ? (
            <div className="text-center py-10 text-fg-muted">
              <span className="material-symbols-outlined text-[48px] text-fg-subtle leading-none block mb-3" aria-hidden="true">history</span>
              No hay reuniones registradas para este cliente
            </div>
          ) : (
            selectedClientMeetings.map((meeting) => (
              <div
                key={meeting.id}
                className="bg-canvas border border-line p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-fg mb-1 truncate">{meeting.summary || 'Sin título'}</div>
                    <div className="flex items-center gap-2 text-xs text-fg-muted">
                      <span className="material-symbols-outlined text-[14px] leading-none" aria-hidden="true">calendar_today</span>
                      <span>{format(new Date(meeting.start_time), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}</span>
                      <span className="text-fg-subtle">•</span>
                      <span>{format(new Date(meeting.start_time), 'HH:mm')}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs text-fg-subtle">Analista:</span>
                      <span className="px-1.5 py-0.5 bg-boss-primary/10 text-boss-light text-xs">{nameByEmail(meeting.analyst_email)}</span>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 shrink-0 ${
                    meeting.match_status === 'CONFIRMED'
                      ? 'bg-success/10 text-success'
                      : 'bg-accent/10 text-accent'
                  }`}>
                    {meeting.match_status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line pt-4">
          <span className="text-xs text-fg-muted">
            Total: <strong className="text-fg">{selectedClientMeetings.length}</strong> reuniones
          </span>
          <Button variant="ghost" onClick={() => setSelectedClientId(null)}>Cerrar</Button>
        </div>
      </Modal>

      {/* Modal de alta/edición de cliente */}
      {formOpen && (
        <ClientFormModal
          clientId={formClientId}
          onClose={() => setFormOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
