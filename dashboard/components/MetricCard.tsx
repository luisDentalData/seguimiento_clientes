'use client';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'blue' | 'purple' | 'green' | 'orange' | 'pink';
  onClick?: () => void;
}

const iconChipClass: Record<string, string> = {
  blue:   'text-boss-primary',
  purple: 'text-boss-primary',
  green:  'text-success',
  orange: 'text-accent',
  pink:   'text-accent',
};

export default function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'blue',
  onClick,
}: MetricCardProps) {
  return (
    <div
      onClick={onClick}
      className={[
        'bg-surface border border-line p-5 transition-colors duration-base',
        onClick ? 'cursor-pointer hover:border-line-strong hover:bg-canvas/30' : '',
      ].join(' ')}
    >
      <div className="flex items-start justify-between mb-3">
        <span
          className={`material-symbols-outlined text-[24px] leading-none ${iconChipClass[color]}`}
          aria-hidden="true"
        >
          {icon}
        </span>
        {trend && (
          <span className={`text-xs font-medium ${trend.isPositive ? 'text-success' : 'text-danger-fg'}`}>
            {trend.isPositive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>

      <div className="font-display font-bold text-3xl text-fg leading-none mb-1">
        {value}
      </div>
      <div className="text-sm text-fg-muted mt-1">{title}</div>
      {subtitle && (
        <div className="text-xs text-fg-subtle mt-1">{subtitle}</div>
      )}
    </div>
  );
}
