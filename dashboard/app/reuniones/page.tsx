'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import Header from '@/components/Header';
import FilterBar from '@/components/FilterBar';
import { Spinner } from '@/dd/components';
import { api } from '@/lib/api';
import { useAnalysts } from '@/lib/useAnalysts';
import type { Appointment } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const fetcher = (url: string) => api.get(url).then(res => res.data);

const statusClass: Record<string, string> = {
  CONFIRMED: 'bg-success/10 text-success border-success/20',
  PROBABLE:  'bg-fg-subtle/20 text-fg-muted border-line-strong',
  NO_MATCH:  'bg-accent/10 text-accent border-accent/20',
  INTERNAL:  'bg-boss-primary/10 text-boss-light border-boss-primary/20',
};

const statusLabel: Record<string, string> = {
  CONFIRMED: 'Confirmada',
  PROBABLE:  'Probable',
  NO_MATCH:  'Sin Match',
  INTERNAL:  'Interna',
};

export default function ReunionesPage() {
  const [selectedAnalyst, setSelectedAnalyst] = useState('all');
  const { nameByEmail } = useAnalysts();
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const { data: allAppointments, isLoading } = useSWR<Appointment[]>(
    '/appointments?limit=1000',
    fetcher,
    { refreshInterval: 30000 }
  );

  const filteredAppointments = useMemo(() => {
    if (!allAppointments) return [];

    return allAppointments.filter(apt => {
      const analystMatch = selectedAnalyst === 'all' || apt.analyst_email === selectedAnalyst;
      let monthMatch = true;
      if (selectedMonth !== 'all') {
        const aptMonth = format(new Date(apt.start_time), 'yyyy-MM');
        monthMatch = aptMonth === selectedMonth;
      }
      const statusMatch = selectedStatus === 'all' || apt.match_status === selectedStatus;
      return analystMatch && monthMatch && statusMatch;
    }).sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  }, [allAppointments, selectedAnalyst, selectedMonth, selectedStatus]);

  const monthLabel = selectedMonth === 'all' ? 'todos los meses' : selectedMonth;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="h-8 w-8" label="Cargando reuniones..." />
      </div>
    );
  }

  return (
    <div>
      <Header
        title="Gestión de Reuniones"
        subtitle={`Todas las reuniones registradas — ${monthLabel}`}
      />

      <FilterBar
        selectedAnalyst={selectedAnalyst}
        onAnalystChange={setSelectedAnalyst}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
      />

      {/* Status filter chips */}
      <div className="mb-4 flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-xs text-fg-muted">
          <span className="material-symbols-outlined text-[14px] leading-none" aria-hidden="true">filter_list</span>
          Estado:
        </span>
        <div className="flex gap-2">
          {(['all', 'CONFIRMED', 'PROBABLE', 'INTERNAL', 'NO_MATCH'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSelectedStatus(s)}
              className={[
                'px-3 py-1 text-xs font-medium transition-colors duration-base border',
                selectedStatus === s
                  ? 'bg-boss-primary text-paper border-boss-primary'
                  : 'bg-surface text-fg-muted border-line hover:border-line-strong hover:text-fg',
              ].join(' ')}
            >
              {s === 'all' ? 'Todos' : statusLabel[s] ?? s}
            </button>
          ))}
        </div>
      </div>

      {/* Stats mini-grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: filteredAppointments.length, color: 'text-fg' },
          { label: 'Confirmadas', value: filteredAppointments.filter(a => a.match_status === 'CONFIRMED').length, color: 'text-success' },
          { label: 'Internas', value: filteredAppointments.filter(a => a.match_status === 'INTERNAL').length, color: 'text-boss-light' },
          { label: 'Con Cliente', value: filteredAppointments.filter(a => a.is_client_meeting).length, color: 'text-boss-primary' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-surface border border-line p-4">
            <div className={`font-display font-bold text-2xl ${color}`}>{value}</div>
            <div className="text-xs text-fg-muted">{label}</div>
          </div>
        ))}
      </div>

      {/* Appointments list */}
      <div className="bg-surface border border-line overflow-hidden">
        <div className="border-b border-line px-5 py-3.5">
          <span className="text-sm font-medium text-fg">Listado de Reuniones ({filteredAppointments.length})</span>
        </div>

        <div className="divide-y divide-line max-h-[calc(100vh-380px)] overflow-y-auto">
          {filteredAppointments.length === 0 ? (
            <div className="p-10 text-center text-fg-muted">
              No hay reuniones que coincidan con los filtros seleccionados
            </div>
          ) : (
            filteredAppointments.map((apt) => (
              <div key={apt.id} className="p-5 hover:bg-canvas/30 transition-colors duration-fast">
                <div className="flex items-start justify-between mb-3 gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h3 className="text-sm font-medium text-fg">{apt.summary}</h3>
                      <span className={`px-2 py-0.5 text-xs font-medium border ${statusClass[apt.match_status] ?? 'border-line text-fg-muted'}`}>
                        {statusLabel[apt.match_status] ?? apt.match_status}
                      </span>
                      {apt.is_client_meeting && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-success/10 text-success border border-success/20">
                          Cliente
                        </span>
                      )}
                    </div>

                    {apt.description && (
                      <p className="text-xs text-fg-muted mb-2 line-clamp-2">{apt.description}</p>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="flex items-center gap-1.5 text-xs text-fg-muted">
                        <span className="material-symbols-outlined text-[13px] leading-none" aria-hidden="true">calendar_today</span>
                        {format(new Date(apt.start_time), "d MMM yyyy", { locale: es })}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-fg-muted">
                        <span className="material-symbols-outlined text-[13px] leading-none" aria-hidden="true">schedule</span>
                        {format(new Date(apt.start_time), "HH:mm")} – {format(new Date(apt.end_time), "HH:mm")}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-fg-muted">
                        <span className="material-symbols-outlined text-[13px] leading-none" aria-hidden="true">group</span>
                        {apt.attendees?.length || 0} asistentes
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-fg-muted">
                        <span className="material-symbols-outlined text-[13px] leading-none" aria-hidden="true">person</span>
                        <span className="truncate">{nameByEmail(apt.analyst_email)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {apt.matched_client && (
                  <div className="mt-3 pt-3 border-t border-line">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="material-symbols-outlined text-boss-primary text-[14px] leading-none" aria-hidden="true">business</span>
                          <span className="text-sm font-medium text-fg">{apt.matched_client.name}</span>
                        </div>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
                          {apt.matched_client.nombre_contacto && (
                            <span>Contacto: {apt.matched_client.nombre_contacto}</span>
                          )}
                          {apt.matched_client.programa && (
                            <span className="px-1.5 py-0.5 bg-boss-primary/10 text-boss-light">{apt.matched_client.programa}</span>
                          )}
                          {apt.matched_client.provincia && (
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[12px] leading-none" aria-hidden="true">location_on</span>
                              {apt.matched_client.provincia}
                            </span>
                          )}
                        </div>
                      </div>

                      {apt.match_confidence && (
                        <div className="text-right shrink-0">
                          <div className="text-xs text-fg-subtle mb-0.5">Confianza</div>
                          <div className="text-lg font-display font-bold text-boss-primary">
                            {(apt.match_confidence * 100).toFixed(0)}%
                          </div>
                        </div>
                      )}
                    </div>

                    {apt.match_reason && (
                      <div className="mt-1.5 text-xs text-fg-subtle italic">{apt.match_reason}</div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
