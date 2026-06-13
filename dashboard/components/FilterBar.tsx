'use client';

import { Calendar, User } from 'lucide-react';

interface FilterBarProps {
  selectedAnalyst: string;
  onAnalystChange: (analyst: string) => void;
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  analysts?: string[];
}

const months = [
  { value: 'all', label: 'Todos los meses' },
  { value: '2025-01', label: 'Enero 2025' },
  { value: '2025-02', label: 'Febrero 2025' },
  { value: '2025-03', label: 'Marzo 2025' },
  { value: '2025-04', label: 'Abril 2025' },
  { value: '2025-05', label: 'Mayo 2025' },
  { value: '2025-06', label: 'Junio 2025' },
  { value: '2025-07', label: 'Julio 2025' },
  { value: '2025-08', label: 'Agosto 2025' },
  { value: '2025-09', label: 'Septiembre 2025' },
  { value: '2025-10', label: 'Octubre 2025' },
  { value: '2025-11', label: 'Noviembre 2025' },
  { value: '2025-12', label: 'Diciembre 2025' },
  { value: '2026-01', label: 'Enero 2026' },
  { value: '2026-02', label: 'Febrero 2026' },
];

export default function FilterBar({
  selectedAnalyst,
  onAnalystChange,
  selectedMonth,
  onMonthChange,
  analysts = ['all', 'u.barroso@dentaldata.es', 'm.val@dentaldata.es', 'c.bosom@dentaldata.es']
}: FilterBarProps) {

  const analystNames: Record<string, string> = {
    'all': 'Todos los analistas',
    'u.barroso@dentaldata.es': 'Úrsula Barroso',
    'm.val@dentaldata.es': 'Marta Val',
    'c.bosom@dentaldata.es': 'Carolina Bosom'
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Analyst Filter */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
            <User className="w-4 h-4" />
            Analista
          </label>
          <select
            value={selectedAnalyst}
            onChange={(e) => onAnalystChange(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 text-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          >
            {analysts.map(analyst => (
              <option key={analyst} value={analyst}>
                {analystNames[analyst] || analyst}
              </option>
            ))}
          </select>
        </div>

        {/* Month Filter */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Mes
          </label>
          <select
            value={selectedMonth}
            onChange={(e) => onMonthChange(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 text-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
          >
            {months.map(month => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
