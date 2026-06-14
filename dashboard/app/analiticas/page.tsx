'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { TrendingUp, Calendar, Users, Target, BarChart3, PieChart } from 'lucide-react';
import Header from '@/components/Header';
import FilterBar from '@/components/FilterBar';
import { api } from '@/lib/api';
import type { Appointment, SummaryStats, CategoryStats } from '@/lib/types';
import { format, startOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
} from 'recharts';

const fetcher = (url: string) => api.get(url).then(res => res.data);

// Categorías de la taxonomía rica + color/etiqueta para los gráficos.
const CATEGORY_META: { key: string; label: string; color: string }[] = [
  { key: 'CLIENTE', label: 'Cliente', color: '#10b981' },
  { key: 'INTERNO', label: 'Interno', color: '#3b82f6' },
  { key: 'VACACIONES', label: 'Vacaciones', color: '#f59e0b' },
  { key: 'EVENTO', label: 'Evento', color: '#a855f7' },
  { key: 'PERSONAL', label: 'Personal', color: '#ec4899' },
  { key: 'SIN_CLASIFICAR', label: 'Sin clasificar', color: '#6b7280' },
];

export default function AnaliticasPage() {
  const [selectedAnalyst, setSelectedAnalyst] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');

  const { data: stats } = useSWR<SummaryStats>('/stats/summary', fetcher, { refreshInterval: 30000 });
  const { data: allAppointments } = useSWR<Appointment[]>('/appointments?limit=10000', fetcher, { refreshInterval: 30000 });

  // Carga por categoría (backend agrega; total/analista respetan filtros, mes ignora el mes)
  const categoryStatsKey = `/stats/categories?analyst_email=${selectedAnalyst}&month=${selectedMonth}`;
  const { data: categoryStats } = useSWR<CategoryStats>(categoryStatsKey, fetcher, { refreshInterval: 30000 });

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

      return analystMatch && monthMatch;
    });
  }, [allAppointments, selectedAnalyst, selectedMonth]);

  // Appointments by month - Show last 7 months from current month
  const appointmentsByMonth = useMemo(() => {
    if (!allAppointments) return [];

    const today = new Date();
    const currentMonth = startOfMonth(today);

    console.log('Today:', today);
    console.log('Current month:', currentMonth);

    const monthMap = new Map<string, { monthKey: string; month: string; total: number; confirmed: number; internal: number }>();

    // Initialize the last 7 months (current month + 6 previous months)
    // If today is Dec 28, 2025, we want: Jun, Jul, Aug, Sep, Oct, Nov, Dec 2025
    for (let i = 6; i >= 0; i--) {
      const monthDate = subMonths(currentMonth, i);
      const monthKey = format(monthDate, 'yyyy-MM');
      const monthLabel = format(monthDate, "MMM yyyy", { locale: es });
      monthMap.set(monthKey, { monthKey, month: monthLabel, total: 0, confirmed: 0, internal: 0 });
      console.log(`Initialized month ${i}:`, monthKey, monthLabel);
    }

    // Count ALL appointments for each month (ignore filters for this chart)
    console.log('Processing appointments...');
    let oct = 0, nov = 0, dec = 0;
    allAppointments.forEach(apt => {
      const aptDate = new Date(apt.start_time);
      const monthKey = format(aptDate, 'yyyy-MM');

      if (monthKey === '2025-10') oct++;
      if (monthKey === '2025-11') nov++;
      if (monthKey === '2025-12') dec++;

      if (monthMap.has(monthKey)) {
        const data = monthMap.get(monthKey)!;
        data.total++;
        if (apt.match_status === 'CONFIRMED') data.confirmed++;
        if (apt.match_status === 'INTERNAL') data.internal++;
      }
    });
    console.log('Oct 2025 appointments:', oct);
    console.log('Nov 2025 appointments:', nov);
    console.log('Dec 2025 appointments:', dec);

    // Sort by monthKey (yyyy-MM) to ensure chronological order
    const result = Array.from(monthMap.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    console.log('Appointments by month result:', result);
    return result;
  }, [allAppointments]);

  // Analyst comparison
  const analystComparison = useMemo(() => {
    if (!stats) return [];

    return stats.analyst_stats.map(analyst => {
      const name = analyst.analyst === 'u.barroso@dentaldata.es' ? 'Úrsula' :
                   analyst.analyst === 'm.val@dentaldata.es' ? 'Marta' :
                   analyst.analyst === 'c.bosom@dentaldata.es' ? 'Carolina' : analyst.analyst;

      const effectiveness = analyst.total_appointments > 0
        ? (analyst.confirmed_meetings / analyst.total_appointments) * 100
        : 0;

      return {
        name,
        total: analyst.total_appointments,
        confirmadas: analyst.confirmed_meetings,
        efectividad: parseFloat(effectiveness.toFixed(1)),
      };
    });
  }, [stats]);

  // Status distribution for pie chart
  const statusDistribution = useMemo(() => {
    if (!stats) return [];

    const colors = {
      'CONFIRMED': '#10b981',
      'PROBABLE': '#3b82f6',
      'INTERNAL': '#a855f7',
      'NO_MATCH': '#f97316',
    };

    const labels = {
      'CONFIRMED': 'Confirmadas',
      'PROBABLE': 'Probables',
      'INTERNAL': 'Internas',
      'NO_MATCH': 'Sin Match',
    };

    return stats.status_distribution.map(item => ({
      name: labels[item.status as keyof typeof labels] || item.status,
      value: item.count,
      color: colors[item.status as keyof typeof colors] || '#6b7280',
    }));
  }, [stats]);

  // Program distribution - Use all appointments with client meetings only
  const programDistribution = useMemo(() => {
    if (!allAppointments) return [];

    console.log('Total appointments received:', allAppointments.length);
    console.log('Appointments with matched_client:', allAppointments.filter(apt => apt.matched_client).length);
    console.log('Appointments with programa:', allAppointments.filter(apt => apt.matched_client?.programa).length);

    const programMap = new Map<string, number>();

    allAppointments
      .filter(apt => apt.is_client_meeting && apt.matched_client?.programa)
      .forEach(apt => {
        const programa = apt.matched_client!.programa!;
        programMap.set(programa, (programMap.get(programa) || 0) + 1);
      });

    const result = Array.from(programMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    console.log('Program distribution result:', result);

    return result;
  }, [allAppointments]);

  // Top clients by meetings
  const topClients = useMemo(() => {
    if (!filteredAppointments) return [];

    const clientMap = new Map<string, { name: string; count: number; analyst: string }>();

    filteredAppointments
      .filter(apt => apt.matched_client && apt.is_client_meeting)
      .forEach(apt => {
        const clientId = apt.matched_client!.id;
        if (!clientMap.has(clientId)) {
          clientMap.set(clientId, {
            name: apt.matched_client!.name,
            count: 0,
            analyst: apt.analyst_email,
          });
        }
        clientMap.get(clientId)!.count++;
      });

    return Array.from(clientMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredAppointments]);

  const getAnalystName = (email: string) => {
    const names: Record<string, string> = {
      'u.barroso@dentaldata.es': 'Úrsula Barroso',
      'm.val@dentaldata.es': 'Marta Val',
      'c.bosom@dentaldata.es': 'Carolina Bosom',
    };
    return names[email] || email;
  };

  // Transforms para los gráficos de carga por categoría
  const categoryTotal = useMemo(() => {
    if (!categoryStats) return [];
    return categoryStats.total
      .map(t => {
        const meta = CATEGORY_META.find(m => m.key === t.category);
        return { name: meta?.label ?? t.category, value: t.count, color: meta?.color ?? '#6b7280' };
      })
      .sort((a, b) => b.value - a.value);
  }, [categoryStats]);

  const categoryByAnalyst = useMemo(() => {
    if (!categoryStats) return [];
    return categoryStats.by_analyst.map(row => {
      const obj: Record<string, number | string> = { analyst: getAnalystName(row.analyst) };
      CATEGORY_META.forEach(m => { obj[m.key] = row.categories[m.key] ?? 0; });
      return obj;
    });
  }, [categoryStats]);

  const categoryByMonth = useMemo(() => {
    if (!categoryStats) return [];
    return categoryStats.by_month.map(row => {
      const obj: Record<string, number | string> = { month: row.month };
      CATEGORY_META.forEach(m => { obj[m.key] = row.categories[m.key] ?? 0; });
      return obj;
    });
  }, [categoryStats]);

  const allUnclassified = categoryTotal.length === 1 && categoryTotal[0].name === 'Sin clasificar';

  return (
    <div>
      <Header
        title="Analíticas Avanzadas"
        subtitle="Visualización y análisis detallado de métricas"
      />

      <FilterBar
        selectedAnalyst={selectedAnalyst}
        onAnalystChange={setSelectedAnalyst}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <Calendar className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{filteredAppointments.length}</div>
              <div className="text-sm text-slate-400">Reuniones Totales</div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/20 rounded-lg">
              <Target className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {filteredAppointments.filter(a => a.match_status === 'CONFIRMED').length}
              </div>
              <div className="text-sm text-slate-400">Confirmadas</div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500/20 rounded-lg">
              <Users className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {new Set(filteredAppointments.filter(a => a.matched_client).map(a => a.matched_client!.id)).size}
              </div>
              <div className="text-sm text-slate-400">Clientes Únicos</div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-500/20 rounded-lg">
              <TrendingUp className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {filteredAppointments.length > 0
                  ? ((filteredAppointments.filter(a => a.is_client_meeting).length / filteredAppointments.length) * 100).toFixed(1)
                  : 0}%
              </div>
              <div className="text-sm text-slate-400">Tasa de Cliente</div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Appointments by Month */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Reuniones por Mes</h2>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={appointmentsByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                labelStyle={{ color: '#f1f5f9' }}
              />
              <Legend />
              <Bar dataKey="total" fill="#3b82f6" name="Total" />
              <Bar dataKey="confirmed" fill="#10b981" name="Confirmadas" />
              <Bar dataKey="internal" fill="#a855f7" name="Internas" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status Distribution */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <PieChart className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Distribución por Estado</h2>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <RePieChart>
              <Pie
                data={statusDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {statusDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
              />
            </RePieChart>
          </ResponsiveContainer>
        </div>

        {/* Analyst Comparison */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <Users className="w-5 h-5 text-green-400" />
            <h2 className="text-lg font-semibold text-white">Comparativa de Analistas</h2>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analystComparison}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                labelStyle={{ color: '#f1f5f9' }}
              />
              <Legend />
              <Bar dataKey="total" fill="#3b82f6" name="Total" />
              <Bar dataKey="confirmadas" fill="#10b981" name="Confirmadas" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Program Distribution */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold text-white">Distribución por Programa</h2>
          </div>
          {programDistribution.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-slate-400">
              No hay datos disponibles
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={programDistribution} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" stroke="#94a3b8" />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" width={100} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                  labelStyle={{ color: '#f1f5f9' }}
                />
                <Legend />
                <Bar dataKey="count" fill="#3b82f6" name="Reuniones" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top Clients Table */}
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-slate-700 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Top 10 Clientes por Reuniones</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900/50">
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-400">#</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-400">Cliente</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-400">Analista</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-slate-400">Reuniones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {topClients.map((client, index) => (
                <tr key={index} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-6 py-4 text-slate-300">{index + 1}</td>
                  <td className="px-6 py-4 font-medium text-white">{client.name}</td>
                  <td className="px-6 py-4 text-slate-400">{getAnalystName(client.analyst)}</td>
                  <td className="px-6 py-4 text-right">
                    <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm font-medium">
                      {client.count}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Carga de Reuniones por Categoría */}
      <div className="mt-8">
        <h2 className="text-xl font-bold text-white mb-1">Carga de Reuniones por Categoría</h2>
        <p className="text-sm text-slate-400 mb-4">
          Reparto del trabajo del equipo por tipo de reunión (cliente, interno, vacaciones, evento...).
        </p>

        {allUnclassified && (
          <div className="mb-4 bg-yellow-500/10 border border-yellow-500/40 rounded-xl p-4 text-sm text-yellow-300">
            Todas las reuniones figuran como <strong>Sin clasificar</strong>. La categoría se completa
            al volver a ejecutar el ETL (botón Sincronizar). Hasta entonces este es el estado esperado.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Distribución total */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Distribución total</h3>
            <ResponsiveContainer width="100%" height={300}>
              <RePieChart>
                <Pie data={categoryTotal} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {categoryTotal.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                <Legend />
              </RePieChart>
            </ResponsiveContainer>
          </div>

          {/* Por analista (apilado) */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Por analista</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryByAnalyst}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="analyst" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                <Legend />
                {CATEGORY_META.map(m => (
                  <Bar key={m.key} dataKey={m.key} stackId="cat" fill={m.color} name={m.label} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Evolución por mes (apilado) */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Evolución por mes</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={categoryByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
              <Legend />
              {CATEGORY_META.map(m => (
                <Bar key={m.key} dataKey={m.key} stackId="cat" fill={m.color} name={m.label} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
