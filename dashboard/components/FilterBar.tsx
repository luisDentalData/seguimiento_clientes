'use client';

import { useAnalysts } from '@/lib/useAnalysts';

interface FilterBarProps {
  selectedAnalyst: string;
  onAnalystChange: (analyst: string) => void;
  selectedMonth: string;
  onMonthChange: (month: string) => void;
}

const months = [
  { value: 'all',     label: 'Todos los meses' },
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
}: FilterBarProps) {
  const { active } = useAnalysts();
  const analystOptions = [
    { value: 'all', label: 'Todos los analistas' },
    ...active.map(a => ({ value: a.email, label: a.name })),
  ];

  return (
    <div className="bg-surface border border-line p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-fg-muted mb-1.5">
            <span className="material-symbols-outlined text-[14px] leading-none" aria-hidden="true">
              person
            </span>
            Analista
          </label>
          <select
            value={selectedAnalyst}
            onChange={(e) => onAnalystChange(e.target.value)}
            className="w-full bg-canvas border border-fg-subtle text-fg text-sm rounded-sm px-3 py-2 focus:outline-none focus:border-ink transition-colors duration-base"
          >
            {analystOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-fg-muted mb-1.5">
            <span className="material-symbols-outlined text-[14px] leading-none" aria-hidden="true">
              calendar_today
            </span>
            Mes
          </label>
          <select
            value={selectedMonth}
            onChange={(e) => onMonthChange(e.target.value)}
            className="w-full bg-canvas border border-fg-subtle text-fg text-sm rounded-sm px-3 py-2 focus:outline-none focus:border-ink transition-colors duration-base"
          >
            {months.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
