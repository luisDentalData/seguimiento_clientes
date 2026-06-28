'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Header from '@/components/Header';
import FilterBar from '@/components/FilterBar';
import MetricCard from '@/components/MetricCard';
import { Spinner, Alert } from '@/dd/components';
import { api } from '@/lib/api';
import { useAnalysts } from '@/lib/useAnalysts';
import type { SummaryStats } from '@/lib/types';

const fetcher = (url: string) => api.get(url).then(res => res.data);

const statusBarColors: Record<string, string> = {
  CONFIRMED: 'bg-success',
  PROBABLE:  'bg-boss-primary',
  NO_MATCH:  'bg-accent',
  INTERNAL:  'bg-fg-subtle',
};

const statusLabels: Record<string, string> = {
  CONFIRMED: 'Confirmadas',
  PROBABLE:  'Probables',
  NO_MATCH:  'Sin Match',
  INTERNAL:  'Internas',
};

export default function HomePage() {
  const [selectedAnalyst, setSelectedAnalyst] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const { nameByEmail } = useAnalysts();

  const { data: stats, error, isLoading } = useSWR<SummaryStats>(
    '/stats/summary',
    fetcher,
    { refreshInterval: 30000 }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="h-8 w-8" label="Cargando datos..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8">
        <Alert variant="error">Error cargando datos: {error.message}</Alert>
      </div>
    );
  }

  return (
    <div>
      <Header
        title="Dashboard Principal"
        subtitle="Resumen general de reuniones y métricas de analistas"
      />

      <FilterBar
        selectedAnalyst={selectedAnalyst}
        onAnalystChange={setSelectedAnalyst}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
      />

      {/* Métricas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Total Clientes"
          value={stats?.total_clients || 0}
          subtitle="En base de datos"
          icon="group"
          color="blue"
        />
        <MetricCard
          title="Clientes con Reuniones"
          value={stats?.clients_with_meetings || 0}
          subtitle={`${stats?.total_clients ? ((stats.clients_with_meetings / stats.total_clients) * 100).toFixed(1) : 0}% del total`}
          icon="check_circle"
          color="green"
        />
        <MetricCard
          title="Clientes sin Reuniones"
          value={stats?.clients_without_meetings || 0}
          subtitle="Requieren atención"
          icon="cancel"
          color="orange"
        />
        <MetricCard
          title="Total Eventos"
          value={stats?.analyst_stats?.reduce((sum, a) => sum + a.total_appointments, 0) || 0}
          subtitle="Período Sep-Dic 2025"
          icon="calendar_today"
          color="purple"
        />
      </div>

      {/* Rendimiento por Analista */}
      <div className="bg-surface border border-line p-6 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <span className="material-symbols-outlined text-boss-primary text-[20px] leading-none" aria-hidden="true">
            trending_up
          </span>
          <h2 className="font-display text-xl text-fg">Rendimiento por Analista</h2>
        </div>

        <div className="space-y-5">
          {stats?.analyst_stats?.map((analyst) => {
            const percentage = analyst.total_appointments > 0
              ? (analyst.confirmed_meetings / analyst.total_appointments) * 100
              : 0;
            const analystName = nameByEmail(analyst.analyst);

            return (
              <div key={analyst.analyst} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-fg font-medium">{analystName}</span>
                  <span className="text-fg-muted">
                    {analyst.confirmed_meetings} / {analyst.total_appointments} reuniones
                  </span>
                </div>
                <div className="relative h-1.5 bg-canvas rounded-none overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-boss-primary transition-all duration-slow"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="text-xs text-fg-subtle text-right">{percentage.toFixed(1)}% efectividad</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Distribución de Estados */}
      <div className="bg-surface border border-line p-6">
        <div className="flex items-center gap-2 mb-5">
          <span className="material-symbols-outlined text-boss-primary text-[20px] leading-none" aria-hidden="true">
            bar_chart
          </span>
          <h2 className="font-display text-xl text-fg">Distribución de Estados</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {stats?.status_distribution?.map((item) => {
            const total = stats.status_distribution.reduce((sum, s) => sum + s.count, 0);
            const percentage = total > 0 ? (item.count / total) * 100 : 0;

            return (
              <div key={item.status} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-fg">{statusLabels[item.status] || item.status}</span>
                  <span className="text-sm font-medium text-fg">{item.count}</span>
                </div>
                <div className="relative h-1.5 bg-canvas rounded-none overflow-hidden">
                  <div
                    className={`absolute inset-y-0 left-0 ${statusBarColors[item.status] || 'bg-fg-subtle'} transition-all duration-slow`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="text-xs text-fg-subtle text-right">{percentage.toFixed(1)}%</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
