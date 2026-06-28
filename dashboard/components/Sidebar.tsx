'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navigation = [
  { name: 'Inicio',           href: '/',             icon: 'home' },
  { name: 'Reuniones',        href: '/reuniones',     icon: 'calendar_today' },
  { name: 'Clientes',         href: '/clientes',      icon: 'group' },
  { name: 'Mapa Provincial',  href: '/mapa',          icon: 'location_on' },
  { name: 'Analíticas',       href: '/analiticas',    icon: 'bar_chart' },
  { name: 'Configuración',    href: '/configuracion', icon: 'settings' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-surface border-r border-line">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 px-5 border-b border-line shrink-0">
        <span className="material-symbols-outlined text-boss-primary text-[22px] leading-none">
          calendar_today
        </span>
        <span className="font-display font-bold text-lg text-fg tracking-tight">
          DentalData
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={[
                'flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors duration-base',
                'border-l-2',
                isActive
                  ? 'border-boss-light bg-canvas/40 text-fg'
                  : 'border-transparent text-fg-muted hover:text-fg hover:bg-canvas/20',
              ].join(' ')}
            >
              <span
                className="material-symbols-outlined text-[20px] leading-none shrink-0"
                aria-hidden="true"
              >
                {item.icon}
              </span>
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-line px-5 py-3 shrink-0">
        <p className="text-xs text-fg-subtle text-center">Sistema de Análisis v1.0</p>
      </div>
    </div>
  );
}
