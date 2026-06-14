'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, Users, MapPin, BarChart3, Home, Settings } from 'lucide-react';

const navigation = [
  { name: 'Inicio', href: '/', icon: Home },
  { name: 'Reuniones', href: '/reuniones', icon: Calendar },
  { name: 'Clientes', href: '/clientes', icon: Users },
  { name: 'Mapa Provincial', href: '/mapa', icon: MapPin },
  { name: 'Analíticas', href: '/analiticas', icon: BarChart3 },
  { name: 'Configuración', href: '/configuracion', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-r border-slate-700">
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            DentalData
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all
                ${isActive
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/50'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }
              `}
            >
              <item.icon
                className={`mr-3 h-5 w-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-700 p-4">
        <div className="text-xs text-slate-400 text-center">
          <p>Sistema de Análisis</p>
          <p className="text-slate-500">v1.0.0</p>
        </div>
      </div>
    </div>
  );
}
