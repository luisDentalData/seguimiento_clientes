'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { Users, Search, Calendar, Clock, AlertCircle, CheckCircle2, AlertTriangle, X, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import Header from '@/components/Header';
import { api } from '@/lib/api';
import type { PortfolioClient, ClientStatus, Appointment } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const fetcher = (url: string) => api.get(url).then(res => res.data);

export default function ClientesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClientStatus | 'ALL'>('ALL');
  const [analystFilter, setAnalystFilter] = useState<string>('all');
  const [dateSort, setDateSort] = useState<'desc' | 'asc' | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // Estado calculado en el BACKEND (una sola verdad). El analista se filtra
  // server-side; el resto (búsqueda/estado/orden) es solo presentación.
  const portfolioKey = analystFilter === 'all'
    ? '/clients/portfolio'
    : `/clients/portfolio?analyst_email=${encodeURIComponent(analystFilter)}`;

  const { data: portfolio, error, isLoading } = useSWR<PortfolioClient[]>(
    portfolioKey,
    fetcher,
    { refreshInterval: 30000 }
  );

  // Historial de reuniones del cliente seleccionado (bajo demanda, no bulk).
  const { data: clientMeetings } = useSWR<Appointment[]>(
    selectedClientId ? `/appointments?matched_client_id=${selectedClientId}&limit=1000` : null,
    fetcher
  );

  const clients = useMemo(() => portfolio ?? [], [portfolio]);

  // Búsqueda + filtro de estado + orden por fecha (presentación; el orden por
  // prioridad ya viene del backend salvo que el usuario ordene por fecha).
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
    OK: clients.filter(c => c.status === 'OK').length,
    ATTENTION: clients.filter(c => c.status === 'ATTENTION').length,
    CRITICAL: clients.filter(c => c.status === 'CRITICAL').length,
  }), [clients]);

  const getStatusConfig = (status: ClientStatus) => {
    switch (status) {
      case 'OK':
        return { label: 'OK', color: 'text-green-300', bgColor: 'bg-green-500/20', borderColor: 'border-green-500/50', icon: CheckCircle2 };
      case 'ATTENTION':
        return { label: 'Pendiente', color: 'text-yellow-300', bgColor: 'bg-yellow-500/20', borderColor: 'border-yellow-500/50', icon: AlertTriangle };
      case 'CRITICAL':
        return { label: 'Crítico', color: 'text-red-300', bgColor: 'bg-red-500/20', borderColor: 'border-red-500/50', icon: AlertCircle };
    }
  };

  const formatDaysSince = (days: number | null) => {
    if (days === null) return 'Sin sesiones';
    if (days === 0) return 'Hoy';
    if (days === 1) return 'Ayer';
    return `${days} días`;
  };

  const selectedClient = selectedClientId
    ? clients.find(c => c.id === selectedClientId) ?? null
    : null;

  const selectedClientMeetings = useMemo(() => {
    if (!clientMeetings) return [];
    return clientMeetings
      .filter(apt => apt.is_client_meeting)
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  }, [clientMeetings]);

  const analystNames: Record<string, string> = {
    'u.barroso@dentaldata.es': 'Úrsula',
    'm.val@dentaldata.es': 'm.val',
    'c.bosom@dentaldata.es': 'c.bosom',
  };

  const analysts = [
    { value: 'all', label: 'Todos los analistas' },
    { value: 'u.barroso@dentaldata.es', label: 'Úrsula' },
    { value: 'm.val@dentaldata.es', label: 'm.val' },
    { value: 'c.bosom@dentaldata.es', label: 'c.bosom' },
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

      {/* Estado de error: el usuario DEBE enterarse si el backend falla */}
      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/40 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-red-300">No se pudo cargar el portfolio de clientes</p>
            <p className="text-slate-400">El backend no respondió. Verificá que esté corriendo y reintentá.</p>
          </div>
        </div>
      )}

      {/* Status Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div
          className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 cursor-pointer hover:bg-slate-800/70 transition-all"
          onClick={() => setStatusFilter('ALL')}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{clients.length}</div>
              <div className="text-sm text-slate-400">Total Clientes</div>
            </div>
          </div>
        </div>

        <div
          className={`bg-slate-800/50 backdrop-blur-sm border ${statusFilter === 'OK' ? 'border-green-500' : 'border-slate-700'} rounded-xl p-6 cursor-pointer hover:bg-slate-800/70 transition-all`}
          onClick={() => setStatusFilter(statusFilter === 'OK' ? 'ALL' : 'OK')}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{statusCounts.OK}</div>
              <div className="text-sm text-slate-400">Clientes OK</div>
              <div className="text-xs text-green-400">Sesión reciente (≤30d)</div>
            </div>
          </div>
        </div>

        <div
          className={`bg-slate-800/50 backdrop-blur-sm border ${statusFilter === 'ATTENTION' ? 'border-yellow-500' : 'border-slate-700'} rounded-xl p-6 cursor-pointer hover:bg-slate-800/70 transition-all`}
          onClick={() => setStatusFilter(statusFilter === 'ATTENTION' ? 'ALL' : 'ATTENTION')}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{statusCounts.ATTENTION}</div>
              <div className="text-sm text-slate-400">Pendientes</div>
              <div className="text-xs text-yellow-400">31-60 días sin sesión</div>
            </div>
          </div>
        </div>

        <div
          className={`bg-slate-800/50 backdrop-blur-sm border ${statusFilter === 'CRITICAL' ? 'border-red-500 animate-pulse' : 'border-slate-700'} rounded-xl p-6 cursor-pointer hover:bg-slate-800/70 transition-all`}
          onClick={() => setStatusFilter(statusFilter === 'CRITICAL' ? 'ALL' : 'CRITICAL')}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-red-500 to-pink-500 rounded-lg">
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{statusCounts.CRITICAL}</div>
              <div className="text-sm text-slate-400">Críticos</div>
              <div className="text-xs text-red-400">&gt;60 días sin sesión</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar + Analyst Filter */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre de cliente o contacto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="relative">
          <select
            value={analystFilter}
            onChange={(e) => setAnalystFilter(e.target.value)}
            className="appearance-none pl-4 pr-10 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-colors cursor-pointer min-w-[180px]"
          >
            {analysts.map(a => (
              <option key={a.value} value={a.value} className="bg-slate-800">
                {a.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Clients Table */}
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-slate-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Listado de Clientes ({filteredClients.length})
            </h2>
            {statusFilter !== 'ALL' && (
              <button
                onClick={() => setStatusFilter('ALL')}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                Ver todos
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900/50 border-b border-slate-700">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Cliente</th>
                <th
                  className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white select-none group"
                  onClick={cycleDateSort}
                >
                  <div className="flex items-center gap-1">
                    Última Sesión
                    <span className="text-slate-500 group-hover:text-slate-300 transition-colors">
                      {dateSort === null && <ArrowUpDown className="w-3 h-3" />}
                      {dateSort === 'desc' && <ArrowDown className="w-3 h-3 text-blue-400" />}
                      {dateSort === 'asc' && <ArrowUp className="w-3 h-3 text-blue-400" />}
                    </span>
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Días sin Sesión</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Sesiones</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Analista</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    Cargando portfolio...
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    {searchQuery ? 'No se encontraron clientes con ese criterio' : 'No hay clientes disponibles'}
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const statusConfig = getStatusConfig(client.status);
                  const StatusIcon = statusConfig.icon;
                  const lastSessionDate = client.last_session ? new Date(client.last_session) : null;

                  return (
                    <tr key={client.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${statusConfig.bgColor} border ${statusConfig.borderColor}`}>
                          <StatusIcon className={`w-4 h-4 ${statusConfig.color}`} />
                          <span className={`text-sm font-medium ${statusConfig.color}`}>{statusConfig.label}</span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-white">{client.name}</div>
                          {client.nombre_contacto && (
                            <div className="text-sm text-slate-400">{client.nombre_contacto}</div>
                          )}
                          <div className="flex gap-2 mt-1">
                            {client.programa && (
                              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs">{client.programa}</span>
                            )}
                            {client.provincia && (
                              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs">{client.provincia}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {lastSessionDate ? (
                          <div className="text-sm text-slate-300">{format(lastSessionDate, "d MMM yyyy", { locale: es })}</div>
                        ) : (
                          <div className="text-sm text-slate-500">Sin sesiones</div>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm font-medium ${
                          client.days_since === null || client.days_since > 60 ? 'text-red-400' :
                          client.days_since > 30 ? 'text-yellow-400' :
                          'text-green-400'
                        }`}>
                          {formatDaysSince(client.days_since)}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-300">{client.valid_sessions}</div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {client.last_analyst ? (
                          <div className="text-sm text-slate-300">{client.last_analyst.split('@')[0]}</div>
                        ) : (
                          <div className="text-sm text-slate-500">-</div>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-2">
                          <button
                            className="p-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-colors"
                            title="Agendar reunión"
                          >
                            <Calendar className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setSelectedClientId(client.id)}
                            className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                            title="Ver historial"
                          >
                            <Clock className="w-4 h-4" />
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
      <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-300">
            <p className="font-medium text-blue-300 mb-1">Criterios de clasificación (desde HOY):</p>
            <ul className="space-y-1 text-slate-400">
              <li>• <strong className="text-green-400">OK</strong>: Cliente con sesión en los últimos 30 días (desde hoy)</li>
              <li>• <strong className="text-yellow-400">Pendiente</strong>: Cliente sin sesión entre 31-60 días (desde hoy)</li>
              <li>• <strong className="text-red-400">Crítico</strong>: Cliente sin sesión hace más de 60 días o sin sesiones</li>
              <li className="mt-2 pt-2 border-t border-blue-500/20">
                ℹ️ El estado se calcula <strong>en el servidor, siempre desde la fecha actual</strong> — una sola verdad para todos los analistas.
              </li>
              <li className="mt-1">
                Solo se contabilizan reuniones de cliente: <code className="px-1 py-0.5 bg-slate-800 rounded text-xs">is_client_meeting=true</code> (incluye CONFIRMED y PROBABLE, excluye INTERNAL y NO_MATCH)
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Meeting History Modal */}
      {selectedClientId && selectedClient && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedClientId(null)}
        >
          <div
            className="bg-slate-800 border border-slate-700 rounded-xl max-w-3xl w-full max-h-[80vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-slate-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white">Historial de Reuniones</h2>
                  <p className="text-sm text-slate-400 mt-1">{selectedClient.name}</p>
                </div>
                <button
                  onClick={() => setSelectedClientId(null)}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto max-h-[calc(80vh-80px)] p-6">
              {selectedClientMeetings.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">No hay reuniones registradas para este cliente</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedClientMeetings.map((meeting) => (
                    <div
                      key={meeting.id}
                      className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 hover:bg-slate-900/70 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="font-medium text-white mb-2">{meeting.summary || 'Sin título'}</div>
                          <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                            <Calendar className="w-4 h-4" />
                            <span>{format(new Date(meeting.start_time), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}</span>
                            <span className="text-slate-500">•</span>
                            <span>{format(new Date(meeting.start_time), 'HH:mm', { locale: es })}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">Analista:</span>
                            <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">
                              {analystNames[meeting.analyst_email] || meeting.analyst_email.split('@')[0]}
                            </span>
                          </div>
                        </div>
                        <div>
                          <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                            meeting.match_status === 'CONFIRMED'
                              ? 'bg-green-500/20 text-green-300'
                              : 'bg-yellow-500/20 text-yellow-300'
                          }`}>
                            {meeting.match_status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-700 px-6 py-4 bg-slate-900/50">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">
                  Total de reuniones: <strong className="text-white">{selectedClientMeetings.length}</strong>
                </span>
                <button
                  onClick={() => setSelectedClientId(null)}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
