'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import useSWR from 'swr';
import { MapPin, TrendingUp, Building, Map } from 'lucide-react';
import Header from '@/components/Header';
import FilterBar from '@/components/FilterBar';
import { api } from '@/lib/api';
import type { Appointment, ClientWithMeetings } from '@/lib/types';
import { format } from 'date-fns';

// El mapa solo se carga en el navegador (Leaflet necesita window).
// Import dinámico REAL con ssr:false → el módulo nunca se evalúa en el servidor,
// lo que permite usar `import L from 'leaflet'` de forma segura en el componente.
const SpainMapLeaflet = dynamic(() => import('@/components/SpainMapLeaflet'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-900/50 rounded-lg">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-slate-400">Cargando mapa...</p>
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

  // Provincial statistics
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
          provinceMap[province] = {
            province,
            meetings: 0,
            clients: new Set(),
            confirmed: 0
          };
        }

        const stats = provinceMap[province];
        stats.meetings++;
        stats.clients.add(apt.matched_client!.id);
        if (apt.match_status === 'CONFIRMED') {
          stats.confirmed++;
        }
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

  // Clients in selected province
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
      .map(client => ({
        ...client,
        meeting_count: clientMeetingCount[client.id] || 0,
      }))
      .filter(client => client.meeting_count > 0)
      .sort((a, b) => b.meeting_count - a.meeting_count);
  }, [selectedProvince, allAppointments, clientsWithMeetings, selectedAnalyst, selectedMonth]);

  const getIntensityColor = (meetings: number) => {
    const max = Math.max(...provinceStats.map(p => p.meetings));
    const intensity = max > 0 ? meetings / max : 0;

    if (intensity >= 0.8) return 'from-blue-600 to-purple-600';
    if (intensity >= 0.6) return 'from-blue-500 to-purple-500';
    if (intensity >= 0.4) return 'from-blue-400 to-purple-400';
    if (intensity >= 0.2) return 'from-blue-300 to-purple-300';
    return 'from-slate-600 to-slate-500';
  };

  const maxMeetings = Math.max(...provinceStats.map(p => p.meetings), 1);

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{provinceStats.length}</div>
              <div className="text-sm text-slate-400">Provincias Activas</div>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg">
              <Building className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {provinceStats.reduce((sum, p) => sum + p.clients, 0)}
              </div>
              <div className="text-sm text-slate-400">Clientes Únicos</div>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {provinceStats.reduce((sum, p) => sum + p.meetings, 0)}
              </div>
              <div className="text-sm text-slate-400">Total Reuniones</div>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg">
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {provinceStats.length > 0 ? provinceStats[0].province : '-'}
              </div>
              <div className="text-sm text-slate-400">
                Más Activa ({provinceStats.length > 0 ? provinceStats[0].meetings : 0} reuniones)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Map */}
      <div className="mb-8">
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-slate-700 px-6 py-4">
            <div className="flex items-center gap-2">
              <Map className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-white">Mapa Interactivo de España</h2>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Visualización de concentración de clientes por provincia
            </p>
          </div>

          <div className="p-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Province List */}
        <div className="lg:col-span-2 bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-slate-700 px-6 py-4">
            <h2 className="text-lg font-semibold text-white">Provincias ({provinceStats.length})</h2>
            <p className="text-sm text-slate-400 mt-1">Haz clic en una provincia para ver detalles</p>
          </div>

          <div className="divide-y divide-slate-700 max-h-[600px] overflow-y-auto">
            {provinceStats.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                No hay datos de provincias para el período seleccionado
              </div>
            ) : (
              provinceStats.map((stat) => (
                <div
                  key={stat.province}
                  onClick={() => setSelectedProvince(stat.province)}
                  className={`p-4 cursor-pointer transition-all ${
                    selectedProvince === stat.province
                      ? 'bg-blue-500/20 border-l-4 border-blue-500'
                      : 'hover:bg-slate-700/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <MapPin className={`w-5 h-5 ${
                          selectedProvince === stat.province ? 'text-blue-400' : 'text-slate-500'
                        }`} />
                        <h3 className="font-semibold text-white text-lg">{stat.province}</h3>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                        <div>
                          <div className="text-slate-400 text-xs">Reuniones</div>
                          <div className="text-white font-medium">{stat.meetings}</div>
                        </div>
                        <div>
                          <div className="text-slate-400 text-xs">Clientes</div>
                          <div className="text-white font-medium">{stat.clients}</div>
                        </div>
                        <div>
                          <div className="text-slate-400 text-xs">Confirmadas</div>
                          <div className="text-green-400 font-medium">{stat.confirmed}</div>
                        </div>
                      </div>

                      {/* Meeting intensity bar */}
                      <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`absolute inset-y-0 left-0 bg-gradient-to-r ${getIntensityColor(stat.meetings)} rounded-full transition-all duration-500`}
                          style={{ width: `${(stat.meetings / maxMeetings) * 100}%` }}
                        />
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {stat.effectiveness.toFixed(1)}% efectividad
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Province Detail */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl overflow-hidden">
          <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-b border-slate-700 px-6 py-4">
            <h2 className="text-lg font-semibold text-white">
              {selectedProvince ? `Clientes en ${selectedProvince}` : 'Selecciona una provincia'}
            </h2>
            {selectedProvince && (
              <p className="text-sm text-slate-400 mt-1">
                {clientsInProvince.length} clientes con reuniones
              </p>
            )}
          </div>

          <div className="divide-y divide-slate-700 max-h-[600px] overflow-y-auto">
            {!selectedProvince ? (
              <div className="p-8 text-center text-slate-400">
                <MapPin className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                <p>Selecciona una provincia del listado o del mapa para ver sus clientes</p>
              </div>
            ) : clientsInProvince.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                No hay clientes con reuniones en esta provincia
              </div>
            ) : (
              clientsInProvince.map((client) => (
                <div key={client.id} className="p-4 hover:bg-slate-700/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-white mb-1">{client.name}</h3>
                      {client.nombre_contacto && (
                        <p className="text-sm text-slate-400 mb-2">{client.nombre_contacto}</p>
                      )}
                      {client.programa && (
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">
                          {client.programa}
                        </span>
                      )}
                    </div>
                    <div className="ml-4 flex-shrink-0">
                      <div className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-sm font-medium">
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
