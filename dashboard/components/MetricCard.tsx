'use client';

import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  gradient: 'blue' | 'purple' | 'green' | 'orange' | 'pink';
  onClick?: () => void;
}

const gradients = {
  blue: 'from-blue-500 to-cyan-500',
  purple: 'from-purple-500 to-pink-500',
  green: 'from-green-500 to-emerald-500',
  orange: 'from-orange-500 to-red-500',
  pink: 'from-pink-500 to-rose-500',
};

const glowColors = {
  blue: 'shadow-blue-500/20',
  purple: 'shadow-purple-500/20',
  green: 'shadow-green-500/20',
  orange: 'shadow-orange-500/20',
  pink: 'shadow-pink-500/20',
};
export default function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  gradient,
  onClick
}: MetricCardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        relative overflow-hidden bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6
        transition-all duration-300 hover:shadow-xl ${glowColors[gradient]}
        ${onClick ? 'cursor-pointer hover:scale-105 hover:border-slate-600' : ''}
      `}
    >
      {/* Gradient Background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradients[gradient]} opacity-5`} />

      {/* Content */}
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 bg-gradient-to-br ${gradients[gradient]} rounded-lg`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          {trend && (
            <div className={`text-sm font-medium ${trend.isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {trend.isPositive ? '+' : ''}{trend.value}%
            </div>
          )}
        </div>

        <div className="text-3xl font-bold text-white mb-1">
          {value}
        </div>

        <div className="text-sm text-slate-400">
          {title}
        </div>

        {subtitle && (
          <div className="text-xs text-slate-500 mt-2">
            {subtitle}
          </div>
        )}
      </div>

      {/* Hover Glow Effect */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradients[gradient]} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
    </div>
  );
}
