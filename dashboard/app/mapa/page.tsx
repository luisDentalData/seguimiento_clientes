'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import useSWR from 'swr';
import Header from '@/components/Header';
import FilterBar from '@/components/FilterBar';
import { api } from '@/lib/api';
import type { Appointment, ClientWithMeetings } from '@/lib/types';
import { format } from 'date-fns';

const SpainMapLeaflet = dynamic(() => import('@/components/SpainMapLeaflet'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-canvas">
      <div className="text-center">
        <div className="animate-spin h-10 w-10 border-2 border-boss-primary border-t-transparent mx-auto mb-3" />
        <p className="text-fg-muted text-sm">Cargando mapa...</p>
      </div>
    </div>
  ),
});

const fetcher = (url: string) => api.get(url).then(res => res.data);

export default function MapaPage() {
  const [selectedAnalyst, setSelectedAnalyst] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);

  const { data: allAppointments } = useSWR<Appointment[]>('/appointments?limit=1000', fetcher, { refreshInterval: 30000 });
  const { data: clientsWithMeetings } = useSWR<ClientWithMeetings[]>('/clients/with-meetings', fetcher, { refreshInterval: 30000 });

  const provinceStats = useMemo(() => {
    if (!allAppointments) return [];

    const provinceMap: Record<string, {
      province: string;
      meetings: number;
      clients: Set<string>;
      confirmed: number;
    }> = {};

    allAppointments
      .filter(apt => {
        const analystMatch = selectedAnalyst === 'all' || apt.analyst_email === selectedAnalyst;
        let monthMatch = true;
        if (selectedMonth !== 'all') {
          const aptMonth = format(new Date(apt.start_time), 'yyyy-MM');
          monthMatch = aptMonth === selectedMonth;
        }
        return analystMatch && monthMatch && apt.matched_client?.provincia && apt.is_client_meeting;
      })
      .forEach(apt => {
        const province = apt.matched_client!.provincia!;
        if (!provinceMap[province]) {
          provinceMap[province] = { province, meetings: 0, clients: new Set(), confirmed: 0 };
        }
        const stat = provinceMap[province];
        stat.meetings++;
        stat.clients.add(apt.matched_client!.id);
        if (apt.match_status === 'CONFIRMED') stat.confirmed++;
      });

    return Object.values(provinceMap)
      .map(stat => ({
        province: stat.province,
        meetings: stat.meetings,
        clients: stat.clients.size,
        confirmed: stat.confirmed,
        effectiveness: stat.meetings > 0 ? (stat.confirmed / stat.meetings) * 100 : 0,
      }))
      .sort((a, b) => b.meetings - a.meetings);
  }, [allAppointments, selectedAnalyst, selectedMonth]);

  const clientsInProvince = useMemo(() => {
    if (!selectedProvince || !allAppointments || !clientsWithMeetings) return [];

    const clientMeetingCount: Record<string, number> = {};
    allAppointments
      .filter(apt => {
        const analystMatch = selectedAnalyst === 'all' || apt.analyst_email === selectedAnalyst;
        let monthMatch = true;
        if (selectedMonth !== 'all') {
          const aptMonth = format(new Date(apt.start_time), 'yyyy-MM');
          monthMatch = aptMonth === selectedMonth;
        }
        return analystMatch && monthMatch &&
               apt.matched_client?.provincia === selectedProvince &&
               apt.is_client_meeting;
      })
      .forEach(apt => {
        const clientId = apt.matched_client!.id;
        clientMeetingCount[clientId] = (clientMeetingCount[clientId] || 0) + 1;
      });

    return clientsWithMeetings
      .filter(client => client.provincia === selectedProvince)
      .map(client => ({ ...client, meeting_count: clientMeetingCount[client.id] || 0 }))
      .filter(client => client.meeting_count > 0)
      .sort((a, b) => b.meeting_count - a.meeting_count);
  }, [selectedProvince, allAppointments, clientsWithMeetings, selectedAnalyst, selectedMonth]);

  const getIntensityColor = (meetings: number) => {
    const max = Math.max(...provinceStats.map(p => p.meetings), 1);
    const intensity = meetings / max;
    if (intensity >= 0.8) return 'bg-boss-primary';
    if (intensity >= 0.6) return 'bg-boss-light';
    if (intensity >= 0.4) return 'bg-accent';
    if (intensity >= 0.2) return 'bg-success';
    return 'bg-fg-subtle';
  };

  const maxMeetings = Math.max(...provinceStats.map(p => p.meetings), 1);

  const summaryStats = [
    { icon: 'location_on', value: provinceStats.length, label: 'Provincias Activas', color: 'text-boss-primary' },
    { icon: 'corporate_fare', value: provinceStats.reduce((sum, p) => sum + p.clients, 0), label: 'Clientes Únicos', color: 'text-success' },
    { icon: 'trending_up', value: provinceStats.reduce((sum, p) => sum + p.meetings, 0), label: 'Total Reuniones', color: 'text-boss-light' },
    {
      icon: 'location_on',
      value: provinceStats.length > 0 ? provinceStats[0].province : '-',
      label: `Más Activa (${provinceStats.length > 0 ? provinceStats[0].meetings : 0} reuniones)`,
      color: 'text-accent',
    },
  ];

  return (
    <div>
      <Header
        title="Mapa Provincial"
        subtitle="Distribución geográfica de reuniones y clientes"
      />

      <FilterBar
        selectedAnalyst={selectedAnalyst}
        onAnalystChange={setSelectedAnalyst}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {summaryStats.map(stat => (
          <div key={stat.label} className="bg-surface border border-line p-5">
            <div className="flex items-center gap-3">
              <span className={`material-symbols-outlined text-[28px] leading-none ${stat.color}`} aria-hidden="true">
                {stat.icon}
              </span>
              <div>
                <div className="font-display font-bold text-2xl text-fg">{stat.value}</div>
                <div className="text-xs text-fg-muted">{stat.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Interactive Map */}
      <div className="mb-6">
        <div className="bg-surface border border-line overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-boss-primary text-[18px] leading-none" aria-hidden="true">map</span>
              <h2 className="text-base font-medium text-fg">Mapa Interactivo de España</h2>
            </div>
            <p className="text-xs text-fg-muted mt-0.5">Visualización de concentración de clientes por provincia</p>
          </div>
          <div className="p-5">
            <div className="h-[600px]">
              <SpainMapLeaflet
                provinceData={provinceStats}
                onProvinceClick={setSelectedProvince}
                selectedProvince={selectedProvince}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Province List */}
        <div className="lg:col-span-2 bg-surface border border-line overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-base font-medium text-fg">Provincias ({provinceStats.length})</h2>
            <p className="text-xs text-fg-muted mt-0.5">Hacé clic en una provincia para ver detalles</p>
          </div>

          <div className="divide-y divide-line max-h-[600px] overflow-y-auto">
            {provinceStats.length === 0 ? (
              <div className="p-8 text-center text-fg-muted">
                No hay datos de provincias para el período seleccionado
              </div>
            ) : (
              provinceStats.map((stat) => (
                <div
                  key={stat.province}
                  onClick={() => setSelectedProvince(stat.province)}
                  className={`p-4 cursor-pointer transition-colors duration-fast ${
                    selectedProvince === stat.province
                      ? 'bg-boss-primary/10 border-l-2 border-boss-primary'
                      : 'hover:bg-canvas/30 border-l-2 border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2.5 mb-2">
                        <span
                          className={`material-symbols-outlined text-[18px] leading-none ${
                            selectedProvince === stat.province ? 'text-boss-primary' : 'text-fg-subtle'
                          }`}
                          aria-hidden="true"
                        >location_on</span>
                        <h3 className="font-medium text-fg">{stat.province}</h3>
                      </div>

                      <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                        <div>
                          <div className="text-xs text-fg-subtle">Reuniones</div>
                          <div className="text-fg font-medium">{stat.meetings}</div>
                        </div>
                        <div>
                          <div className="text-xs text-fg-subtle">Clientes</div>
                          <div className="text-fg font-medium">{stat.clients}</div>
                        </div>
                        <div>
                          <div className="text-xs text-fg-subtle">Confirmadas</div>
                          <div className="text-success font-medium">{stat.confirmed}</div>
                        </div>
                      </div>

                      <div className="relative h-1.5 bg-canvas overflow-hidden">
                        <div
                          className={`absolute inset-y-0 left-0 ${getIntensityColor(stat.meetings)} transition-all duration-slow`}
                          style={{ width: `${(stat.meetings / maxMeetings) * 100}%` }}
                        />
                      </div>
                      <div className="text-xs text-fg-subtle mt-1">{stat.effectiveness.toFixed(1)}% efectividad</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Province Detail */}
        <div className="bg-surface border border-line overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-base font-medium text-fg">
              {selectedProvince ? `Clientes en ${selectedProvince}` : 'Seleccioná una provincia'}
            </h2>
            {selectedProvince && (
              <p className="text-xs text-fg-muted mt-0.5">
                {clientsInProvince.length} clientes con reuniones
              </p>
            )}
          </div>

          <div className="divide-y divide-line max-h-[600px] overflow-y-auto">
            {!selectedProvince ? (
              <div className="p-8 text-center text-fg-muted">
                <span className="material-symbols-outlined text-[48px] leading-none text-fg-subtle block mx-auto mb-3" aria-hidden="true">location_on</span>
                <p className="text-sm">Seleccioná una provincia del listado o del mapa para ver sus clientes</p>
              </div>
            ) : clientsInProvince.length === 0 ? (
              <div className="p-8 text-center text-fg-muted text-sm">
                No hay clientes con reuniones en esta provincia
              </div>
            ) : (
              clientsInProvince.map((client) => (
                <div key={client.id} className="p-4 hover:bg-canvas/30 transition-colors duration-fast">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-fg text-sm mb-1">{client.name}</h3>
                      {client.nombre_contacto && (
                        <p className="text-xs text-fg-muted mb-2">{client.nombre_contacto}</p>
                      )}
                      {client.programa && (
                        <span className="px-2 py-0.5 bg-boss-primary/10 text-boss-light text-xs">
                          {client.programa}
                        </span>
                      )}
                    </div>
                    <div className="ml-3 shrink-0">
                      <div className="px-2.5 py-0.5 bg-success/10 text-success border border-success/20 text-sm font-medium">
                        {client.meeting_count} {client.meeting_count === 1 ? 'reunión' : 'reuniones'}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
