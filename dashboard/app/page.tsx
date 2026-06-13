'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Calendar, Users, CheckCircle, XCircle, TrendingUp, BarChart3 } from 'lucide-react';
import Header from '@/components/Header';
import FilterBar from '@/components/FilterBar';
import MetricCard from '@/components/MetricCard';
import { api } from '@/lib/api';
import type { SummaryStats } from '@/lib/types';

const fetcher = (url: string) => api.get(url).then(res => res.data);

export default function HomePage() {
  const [selectedAnalyst, setSelectedAnalyst] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');

  // Fetch data
  const { data: stats, error, isLoading } = useSWR<SummaryStats>(
    '/stats/summary',
    fetcher,
    { refreshInterval: 30000 }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-400">Error cargando datos: {error.message}</div>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Total Clientes"
          value={stats?.total_clients || 0}
          subtitle="En base de datos"
          icon={Users}
          gradient="blue"
        />
        <MetricCard
          title="Clientes con Reuniones"
          value={stats?.clients_with_meetings || 0}
          subtitle={`${stats?.total_clients ? ((stats.clients_with_meetings / stats.total_clients) * 100).toFixed(1) : 0}% del total`}
          icon={CheckCircle}
          gradient="green"
        />
        <MetricCard
          title="Clientes sin Reuniones"
          value={stats?.clients_without_meetings || 0}
          subtitle="Requieren atención"
          icon={XCircle}
          gradient="orange"
        />
        <MetricCard
          title="Total Eventos"
          value={stats?.analyst_stats?.reduce((sum, a) => sum + a.total_appointments, 0) || 0}
          subtitle="Período Sep-Dic 2025"
          icon={Calendar}
          gradient="purple"
        />
      </div>

      {/* Rendimiento por Analista */}
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 mb-8">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-5 h-5 text-blue-400" />
          <h2 className="text-xl font-semibold text-white">Rendimiento por Analista</h2>
        </div>

        <div className="space-y-4">
          {stats?.analyst_stats?.map((analyst) => {
            const percentage = analyst.total_appointments > 0
              ? (analyst.confirmed_meetings / analyst.total_appointments) * 100
              : 0;

            const analystName = analyst.analyst === 'u.barroso@dentaldata.es' ? 'Úrsula Barroso' :
                               analyst.analyst === 'm.val@dentaldata.es' ? 'Marta Val' :
                               analyst.analyst === 'c.bosom@dentaldata.es' ? 'Carolina Bosom' :
                               analyst.analyst;

            return (
              <div key={analyst.analyst} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300 font-medium">{analystName}</span>
                  <span className="text-slate-400">
                    {analyst.confirmed_meetings} / {analyst.total_appointments} reuniones
                  </span>
                </div>
                <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="text-xs text-slate-500 text-right">{percentage.toFixed(1)}% efectividad</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Distribución de Estados */}
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="w-5 h-5 text-purple-400" />
          <h2 className="text-xl font-semibold text-white">Distribución de Estados</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats?.status_distribution?.map((item) => {
            const total = stats.status_distribution.reduce((sum, s) => sum + s.count, 0);
            const percentage = total > 0 ? (item.count / total) * 100 : 0;

            const statusColors: Record<string, string> = {
              'CONFIRMED': 'from-green-500 to-emerald-500',
              'PROBABLE': 'from-blue-500 to-cyan-500',
              'NO_MATCH': 'from-orange-500 to-red-500',
              'INTERNAL': 'from-purple-500 to-pink-500'
            };

            const statusLabels: Record<string, string> = {
              'CONFIRMED': 'Confirmadas',
              'PROBABLE': 'Probables',
              'NO_MATCH': 'Sin Match',
              'INTERNAL': 'Internas'
            };

            return (
              <div key={item.status} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">{statusLabels[item.status] || item.status}</span>
                  <span className="text-sm font-medium text-white">{item.count}</span>
                </div>
                <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`absolute inset-y-0 left-0 bg-gradient-to-r ${statusColors[item.status] || 'from-gray-500 to-gray-600'} rounded-full`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="text-xs text-slate-500 text-right">{percentage.toFixed(1)}%</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
