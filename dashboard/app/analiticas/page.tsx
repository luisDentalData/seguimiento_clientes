'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import Header from '@/components/Header';
import FilterBar from '@/components/FilterBar';
import { Alert } from '@/dd/components';
import { api } from '@/lib/api';
import { useAnalysts } from '@/lib/useAnalysts';
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

const CHART_TOOLTIP = {
  backgroundColor: '#181816',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '0',
};

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

  const categoryStatsKey = `/stats/categories?analyst_email=${selectedAnalyst}&month=${selectedMonth}`;
  const { data: categoryStats } = useSWR<CategoryStats>(categoryStatsKey, fetcher, { refreshInterval: 30000 });
  const { nameByEmail } = useAnalysts();

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

  const appointmentsByMonth = useMemo(() => {
    if (!allAppointments) return [];
    const today = new Date();
    const currentMonth = startOfMonth(today);
    const monthMap = new Map<string, { monthKey: string; month: string; total: number; confirmed: number; internal: number }>();
    for (let i = 6; i >= 0; i--) {
      const monthDate = subMonths(currentMonth, i);
      const monthKey = format(monthDate, 'yyyy-MM');
      const monthLabel = format(monthDate, "MMM yyyy", { locale: es });
      monthMap.set(monthKey, { monthKey, month: monthLabel, total: 0, confirmed: 0, internal: 0 });
    }
    allAppointments.forEach(apt => {
      const monthKey = format(new Date(apt.start_time), 'yyyy-MM');
      if (monthMap.has(monthKey)) {
        const data = monthMap.get(monthKey)!;
        data.total++;
        if (apt.match_status === 'CONFIRMED') data.confirmed++;
        if (apt.match_status === 'INTERNAL') data.internal++;
      }
    });
    return Array.from(monthMap.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [allAppointments]);

  const analystComparison = useMemo(() => {
    if (!stats) return [];
    return stats.analyst_stats.map(analyst => ({
      name: nameByEmail(analyst.analyst),
      total: analyst.total_appointments,
      confirmadas: analyst.confirmed_meetings,
      efectividad: analyst.total_appointments > 0
        ? parseFloat(((analyst.confirmed_meetings / analyst.total_appointments) * 100).toFixed(1))
        : 0,
    }));
  }, [stats, nameByEmail]);

  const statusDistribution = useMemo(() => {
    if (!stats) return [];
    const colors = { CONFIRMED: '#10b981', PROBABLE: '#3b82f6', INTERNAL: '#a855f7', NO_MATCH: '#f97316' };
    const labels = { CONFIRMED: 'Confirmadas', PROBABLE: 'Probables', INTERNAL: 'Internas', NO_MATCH: 'Sin Match' };
    return stats.status_distribution.map(item => ({
      name: labels[item.status as keyof typeof labels] || item.status,
      value: item.count,
      color: colors[item.status as keyof typeof colors] || '#6b7280',
    }));
  }, [stats]);

  const programDistribution = useMemo(() => {
    if (!allAppointments) return [];
    const programMap = new Map<string, number>();
    allAppointments
      .filter(apt => apt.is_client_meeting && apt.matched_client?.programa)
      .forEach(apt => {
        const programa = apt.matched_client!.programa!;
        programMap.set(programa, (programMap.get(programa) || 0) + 1);
      });
    return Array.from(programMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [allAppointments]);

  const topClients = useMemo(() => {
    if (!filteredAppointments) return [];
    const clientMap = new Map<string, { name: string; count: number; analyst: string }>();
    filteredAppointments
      .filter(apt => apt.matched_client && apt.is_client_meeting)
      .forEach(apt => {
        const clientId = apt.matched_client!.id;
        if (!clientMap.has(clientId)) {
          clientMap.set(clientId, { name: apt.matched_client!.name, count: 0, analyst: apt.analyst_email });
        }
        clientMap.get(clientId)!.count++;
      });
    return Array.from(clientMap.values()).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [filteredAppointments]);

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
      const obj: Record<string, number | string> = { analyst: nameByEmail(row.analyst) };
      CATEGORY_META.forEach(m => { obj[m.key] = row.categories[m.key] ?? 0; });
      return obj;
    });
  }, [categoryStats, nameByEmail]);

  const categoryByMonth = useMemo(() => {
    if (!categoryStats) return [];
    return categoryStats.by_month.map(row => {
      const obj: Record<string, number | string> = { month: row.month };
      CATEGORY_META.forEach(m => { obj[m.key] = row.categories[m.key] ?? 0; });
      return obj;
    });
  }, [categoryStats]);

  const allUnclassified = categoryTotal.length === 1 && categoryTotal[0].name === 'Sin clasificar';

  const kpis = [
    {
      icon: 'calendar_today',
      value: filteredAppointments.length,
      label: 'Reuniones Totales',
    },
    {
      icon: 'track_changes',
      value: filteredAppointments.filter(a => a.match_status === 'CONFIRMED').length,
      label: 'Confirmadas',
    },
    {
      icon: 'group',
      value: new Set(filteredAppointments.filter(a => a.matched_client).map(a => a.matched_client!.id)).size,
      label: 'Clientes Únicos',
    },
    {
      icon: 'trending_up',
      value: `${filteredAppointments.length > 0
        ? ((filteredAppointments.filter(a => a.is_client_meeting).length / filteredAppointments.length) * 100).toFixed(1)
        : 0}%`,
      label: 'Tasa de Cliente',
    },
  ];

  const chartContainer = 'bg-surface border border-line p-5';
  const chartHeader = 'flex items-center gap-2 mb-5';
  const chartTitle = 'text-base font-medium text-fg';

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {kpis.map(kpi => (
          <div key={kpi.label} className="bg-surface border border-line p-5">
            <div className="flex items-center gap-4">
              <span className="material-symbols-outlined text-boss-primary text-[28px] leading-none" aria-hidden="true">
                {kpi.icon}
              </span>
              <div>
                <div className="font-display font-bold text-2xl text-fg">{kpi.value}</div>
                <div className="text-sm text-fg-muted">{kpi.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
        {/* Appointments by Month */}
        <div className={chartContainer}>
          <div className={chartHeader}>
            <span className="material-symbols-outlined text-boss-primary text-[18px] leading-none" aria-hidden="true">bar_chart</span>
            <h2 className={chartTitle}>Reuniones por Mes</h2>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={appointmentsByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="month" stroke="#9d9d97" fontSize={12} />
              <YAxis stroke="#9d9d97" fontSize={12} />
              <Tooltip contentStyle={CHART_TOOLTIP} labelStyle={{ color: '#EDE9E3' }} />
              <Legend />
              <Bar dataKey="total" fill="#3b82f6" name="Total" />
              <Bar dataKey="confirmed" fill="#10b981" name="Confirmadas" />
              <Bar dataKey="internal" fill="#a855f7" name="Internas" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status Distribution */}
        <div className={chartContainer}>
          <div className={chartHeader}>
            <span className="material-symbols-outlined text-boss-primary text-[18px] leading-none" aria-hidden="true">pie_chart</span>
            <h2 className={chartTitle}>Distribución por Estado</h2>
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
                dataKey="value"
              >
                {statusDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={CHART_TOOLTIP} />
            </RePieChart>
          </ResponsiveContainer>
        </div>

        {/* Analyst Comparison */}
        <div className={chartContainer}>
          <div className={chartHeader}>
            <span className="material-symbols-outlined text-boss-primary text-[18px] leading-none" aria-hidden="true">group</span>
            <h2 className={chartTitle}>Comparativa de Analistas</h2>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analystComparison}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" stroke="#9d9d97" fontSize={12} />
              <YAxis stroke="#9d9d97" fontSize={12} />
              <Tooltip contentStyle={CHART_TOOLTIP} labelStyle={{ color: '#EDE9E3' }} />
              <Legend />
              <Bar dataKey="total" fill="#3b82f6" name="Total" />
              <Bar dataKey="confirmadas" fill="#10b981" name="Confirmadas" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Program Distribution */}
        <div className={chartContainer}>
          <div className={chartHeader}>
            <span className="material-symbols-outlined text-boss-primary text-[18px] leading-none" aria-hidden="true">bar_chart</span>
            <h2 className={chartTitle}>Distribución por Programa</h2>
          </div>
          {programDistribution.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-fg-muted">
              No hay datos disponibles
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={programDistribution} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis type="number" stroke="#9d9d97" fontSize={12} />
                <YAxis dataKey="name" type="category" stroke="#9d9d97" width={100} fontSize={12} />
                <Tooltip contentStyle={CHART_TOOLTIP} labelStyle={{ color: '#EDE9E3' }} />
                <Legend />
                <Bar dataKey="count" fill="#3b82f6" name="Reuniones" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top Clients Table */}
      <div className="bg-surface border border-line overflow-hidden mb-8">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-base font-medium text-fg">Top 10 Clientes por Reuniones</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wide">#</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wide">Cliente</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wide">Analista</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wide">Reuniones</th>
              </tr>
            </thead>
            <tbody>
              {topClients.map((client, index) => (
                <tr key={index} className="border-b border-line last:border-b-0 hover:bg-canvas/30 transition-colors duration-fast">
                  <td className="px-5 py-3.5 text-fg-muted">{index + 1}</td>
                  <td className="px-5 py-3.5 font-medium text-fg">{client.name}</td>
                  <td className="px-5 py-3.5 text-fg-muted">{nameByEmail(client.analyst)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="px-2.5 py-0.5 bg-boss-primary/10 text-boss-light text-sm font-medium">
                      {client.count}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Carga por Categoría */}
      <div className="mt-2">
        <h2 className="font-display text-xl text-fg mb-1">Carga de Reuniones por Categoría</h2>
        <p className="text-sm text-fg-muted mb-4">
          Reparto del trabajo del equipo por tipo de reunión (cliente, interno, vacaciones, evento...).
        </p>

        {allUnclassified && (
          <div className="mb-4">
            <Alert variant="info">
              Todas las reuniones figuran como <strong>Sin clasificar</strong>. La categoría se completa
              al volver a ejecutar el ETL (botón Sincronizar). Hasta entonces este es el estado esperado.
            </Alert>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          {/* Distribución total */}
          <div className={chartContainer}>
            <h3 className={chartTitle + ' mb-4'}>Distribución total</h3>
            <ResponsiveContainer width="100%" height={300}>
              <RePieChart>
                <Pie data={categoryTotal} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {categoryTotal.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={CHART_TOOLTIP} />
                <Legend />
              </RePieChart>
            </ResponsiveContainer>
          </div>

          {/* Por analista */}
          <div className={chartContainer}>
            <h3 className={chartTitle + ' mb-4'}>Por analista</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryByAnalyst}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="analyst" stroke="#9d9d97" fontSize={12} />
                <YAxis stroke="#9d9d97" fontSize={12} />
                <Tooltip contentStyle={CHART_TOOLTIP} />
                <Legend />
                {CATEGORY_META.map(m => (
                  <Bar key={m.key} dataKey={m.key} stackId="cat" fill={m.color} name={m.label} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Evolución por mes */}
        <div className={chartContainer}>
          <h3 className={chartTitle + ' mb-4'}>Evolución por mes</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={categoryByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="month" stroke="#9d9d97" fontSize={12} />
              <YAxis stroke="#9d9d97" fontSize={12} />
              <Tooltip contentStyle={CHART_TOOLTIP} />
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
