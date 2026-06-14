'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { Calendar, Users, Clock, Mail, MapPin, Building, Filter } from 'lucide-react';
import Header from '@/components/Header';
import FilterBar from '@/components/FilterBar';
import { api } from '@/lib/api';
import { useAnalysts } from '@/lib/useAnalysts';
import type { Appointment } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const fetcher = (url: string) => api.get(url).then(res => res.data);

export default function ReunionesPage() {
  const [selectedAnalyst, setSelectedAnalyst] = useState('all');
  const { nameByEmail } = useAnalysts();
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Fetch appointments
  const { data: allAppointments, isLoading } = useSWR<Appointment[]>(
    '/appointments?limit=1000',
    fetcher,
    { refreshInterval: 30000 }
  );

  // Filter appointments
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

  const getStatusColor = (status: string) => {
    const colors = {
      'CONFIRMED': 'bg-green-500/20 text-green-300 border-green-500/30',
      'PROBABLE': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      'NO_MATCH': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
      'INTERNAL': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-500/20 text-gray-300 border-gray-500/30';
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      'CONFIRMED': 'Confirmada',
      'PROBABLE': 'Probable',
      'NO_MATCH': 'Sin Match',
      'INTERNAL': 'Interna',
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getAnalystName = nameByEmail;

  const monthLabel = selectedMonth === 'all' ? 'todos los meses' :
    selectedMonth === '2025-09' ? 'Septiembre 2025' :
    selectedMonth === '2025-10' ? 'Octubre 2025' :
    selectedMonth === '2025-11' ? 'Noviembre 2025' :
    selectedMonth === '2025-12' ? 'Diciembre 2025' : selectedMonth;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div>
      <Header
        title="Gestión de Reuniones"
        subtitle={`Todas las reuniones registradas - ${monthLabel}`}
      />

      <FilterBar
        selectedAnalyst={selectedAnalyst}
        onAnalystChange={setSelectedAnalyst}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
      />

      {/* Additional Status Filter */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex items-center gap-2 text-slate-400">
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium">Estado:</span>
        </div>
        <div className="flex gap-2">
          {['all', 'CONFIRMED', 'PROBABLE', 'INTERNAL', 'NO_MATCH'].map((status) => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedStatus === status
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {status === 'all' ? 'Todos' : getStatusLabel(status)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{filteredAppointments.length}</div>
          <div className="text-sm text-slate-400">Total Reuniones</div>
        </div>
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-4">
          <div className="text-2xl font-bold text-green-400">
            {filteredAppointments.filter(a => a.match_status === 'CONFIRMED').length}
          </div>
          <div className="text-sm text-slate-400">Confirmadas</div>
        </div>
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-4">
          <div className="text-2xl font-bold text-purple-400">
            {filteredAppointments.filter(a => a.match_status === 'INTERNAL').length}
          </div>
          <div className="text-sm text-slate-400">Internas</div>
        </div>
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-4">
          <div className="text-2xl font-bold text-blue-400">
            {filteredAppointments.filter(a => a.is_client_meeting).length}
          </div>
          <div className="text-sm text-slate-400">Con Cliente</div>
        </div>
      </div>

      {/* Appointments List */}
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-slate-700 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">
            Listado de Reuniones ({filteredAppointments.length})
          </h2>
        </div>

        <div className="divide-y divide-slate-700 max-h-[calc(100vh-400px)] overflow-y-auto">
          {filteredAppointments.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              No hay reuniones que coincidan con los filtros seleccionados
            </div>
          ) : (
            filteredAppointments.map((appointment) => (
              <div
                key={appointment.id}
                className="p-6 hover:bg-slate-700/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-white">
                        {appointment.summary}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(appointment.match_status)}`}>
                        {getStatusLabel(appointment.match_status)}
                      </span>
                      {appointment.is_client_meeting && (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          Cliente
                        </span>
                      )}
                    </div>

                    {appointment.description && (
                      <p className="text-sm text-slate-400 mb-3 line-clamp-2">
                        {appointment.description}
                      </p>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2 text-slate-300">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        <span>{format(new Date(appointment.start_time), "d MMM yyyy", { locale: es })}</span>
                      </div>

                      <div className="flex items-center gap-2 text-slate-300">
                        <Clock className="w-4 h-4 text-slate-500" />
                        <span>
                          {format(new Date(appointment.start_time), "HH:mm")} - {format(new Date(appointment.end_time), "HH:mm")}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-slate-300">
                        <Users className="w-4 h-4 text-slate-500" />
                        <span>{appointment.attendees?.length || 0} asistentes</span>
                      </div>

                      <div className="flex items-center gap-2 text-slate-300">
                        <Mail className="w-4 h-4 text-slate-500" />
                        <span className="truncate">{getAnalystName(appointment.analyst_email)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {appointment.matched_client && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Building className="w-4 h-4 text-blue-400" />
                          <span className="font-medium text-white">{appointment.matched_client.name}</span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                          {appointment.matched_client.nombre_contacto && (
                            <div className="text-slate-400">
                              <span className="text-slate-500">Contacto:</span> {appointment.matched_client.nombre_contacto}
                            </div>
                          )}
                          {appointment.matched_client.programa && (
                            <div>
                              <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">
                                {appointment.matched_client.programa}
                              </span>
                            </div>
                          )}
                          {appointment.matched_client.provincia && (
                            <div className="flex items-center gap-1 text-slate-400">
                              <MapPin className="w-3 h-3" />
                              {appointment.matched_client.provincia}
                            </div>
                          )}
                        </div>
                      </div>

                      {appointment.match_confidence && (
                        <div className="text-right">
                          <div className="text-xs text-slate-500 mb-1">Confianza</div>
                          <div className="text-lg font-semibold text-blue-400">
                            {(appointment.match_confidence * 100).toFixed(0)}%
                          </div>
                        </div>
                      )}
                    </div>

                    {appointment.match_reason && (
                      <div className="mt-2 text-xs text-slate-500 italic">
                        {appointment.match_reason}
                      </div>
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
