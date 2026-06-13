'use client';

import { useMemo } from 'react';

interface Province {
  name: string;
  path: string;
  cx: number;
  cy: number;
}

interface SpainMapProps {
  provinceData: {
    province: string;
    meetings: number;
    clients: number;
  }[];
  onProvinceClick: (province: string) => void;
  selectedProvince: string | null;
}

// Simplified Spain provinces map with SVG paths
const SPAIN_PROVINCES: Province[] = [
  { name: 'Madrid', path: 'M400,280 L420,280 L420,300 L400,300 Z', cx: 410, cy: 290 },
  { name: 'Barcelona', path: 'M520,220 L550,220 L550,250 L520,250 Z', cx: 535, cy: 235 },
  { name: 'Sevilla', path: 'M280,400 L310,400 L310,430 L280,430 Z', cx: 295, cy: 415 },
  { name: 'Valencia', path: 'M450,300 L480,300 L480,330 L450,330 Z', cx: 465, cy: 315 },
  { name: 'Málaga', path: 'M300,430 L330,430 L330,460 L300,460 Z', cx: 315, cy: 445 },
  { name: 'Cádiz', path: 'M230,450 L260,450 L260,480 L230,480 Z', cx: 245, cy: 465 },
  { name: 'Granada', path: 'M330,420 L360,420 L360,450 L330,450 Z', cx: 345, cy: 435 },
  { name: 'Córdoba', path: 'M300,380 L330,380 L330,410 L300,410 Z', cx: 315, cy: 395 },
  { name: 'Huelva', path: 'M240,410 L270,410 L270,440 L240,440 Z', cx: 255, cy: 425 },
  { name: 'Almería', path: 'M380,430 L410,430 L410,460 L380,460 Z', cx: 395, cy: 445 },
  { name: 'Alicante', path: 'M460,340 L490,340 L490,370 L460,370 Z', cx: 475, cy: 355 },
  { name: 'Murcia', path: 'M430,360 L460,360 L460,390 L430,390 Z', cx: 445, cy: 375 },
  { name: 'Castellón', path: 'M470,270 L500,270 L500,300 L470,300 Z', cx: 485, cy: 285 },
  { name: 'Tarragona', path: 'M510,250 L540,250 L540,280 L510,280 Z', cx: 525, cy: 265 },
  { name: 'Lleida', path: 'M490,220 L520,220 L520,250 L490,250 Z', cx: 505, cy: 235 },
  { name: 'Girona', path: 'M540,190 L570,190 L570,220 L540,220 Z', cx: 555, cy: 205 },
  { name: 'Zaragoza', path: 'M430,230 L460,230 L460,260 L430,260 Z', cx: 445, cy: 245 },
  { name: 'Teruel', path: 'M440,260 L470,260 L470,290 L440,290 Z', cx: 455, cy: 275 },
  { name: 'Huesca', path: 'M460,200 L490,200 L490,230 L460,230 Z', cx: 475, cy: 215 },
  { name: 'Navarra', path: 'M440,180 L470,180 L470,210 L440,210 Z', cx: 455, cy: 195 },
  { name: 'La Rioja', path: 'M410,210 L440,210 L440,240 L410,240 Z', cx: 425, cy: 225 },
  { name: 'País Vasco', path: 'M390,170 L420,170 L420,200 L390,200 Z', cx: 405, cy: 185 },
  { name: 'Gipuzkoa', path: 'M420,170 L450,170 L450,200 L420,200 Z', cx: 435, cy: 185 },
  { name: 'Vizcaya', path: 'M370,160 L400,160 L400,190 L370,190 Z', cx: 385, cy: 175 },
  { name: 'Álava', path: 'M400,190 L430,190 L430,220 L400,220 Z', cx: 415, cy: 205 },
  { name: 'Cantabria', path: 'M350,150 L380,150 L380,180 L350,180 Z', cx: 365, cy: 165 },
  { name: 'Asturias', path: 'M300,140 L330,140 L330,170 L300,170 Z', cx: 315, cy: 155 },
  { name: 'Galicia', path: 'M200,150 L230,150 L230,180 L200,180 Z', cx: 215, cy: 165 },
  { name: 'León', path: 'M310,200 L340,200 L340,230 L310,230 Z', cx: 325, cy: 215 },
  { name: 'Palencia', path: 'M340,210 L370,210 L370,240 L340,240 Z', cx: 355, cy: 225 },
  { name: 'Valladolid', path: 'M350,240 L380,240 L380,270 L350,270 Z', cx: 365, cy: 255 },
  { name: 'Salamanca', path: 'M310,260 L340,260 L340,290 L310,290 Z', cx: 325, cy: 275 },
  { name: 'Zamora', path: 'M280,230 L310,230 L310,260 L280,260 Z', cx: 295, cy: 245 },
  { name: 'Ávila', path: 'M350,270 L380,270 L380,300 L350,300 Z', cx: 365, cy: 285 },
  { name: 'Segovia', path: 'M380,260 L410,260 L410,290 L380,290 Z', cx: 395, cy: 275 },
  { name: 'Guadalajara', path: 'M420,260 L450,260 L450,290 L420,290 Z', cx: 435, cy: 275 },
  { name: 'Cuenca', path: 'M430,300 L460,300 L460,330 L430,330 Z', cx: 445, cy: 315 },
  { name: 'Toledo', path: 'M370,300 L400,300 L400,330 L370,330 Z', cx: 385, cy: 315 },
  { name: 'Ciudad Real', path: 'M360,330 L390,330 L390,360 L360,360 Z', cx: 375, cy: 345 },
  { name: 'Cáceres', path: 'M280,290 L310,290 L310,320 L280,320 Z', cx: 295, cy: 305 },
  { name: 'Badajoz', path: 'M260,320 L290,320 L290,350 L260,350 Z', cx: 275, cy: 335 },
  { name: 'Jaén', path: 'M340,380 L370,380 L370,410 L340,410 Z', cx: 355, cy: 395 },
  { name: 'Albacete', path: 'M410,330 L440,330 L440,360 L410,360 Z', cx: 425, cy: 345 },
  { name: 'Islas Baleares', path: 'M580,300 L610,300 L610,330 L580,330 Z', cx: 595, cy: 315 },
];

export default function SpainMap({ provinceData, onProvinceClick, selectedProvince }: SpainMapProps) {
  const maxMeetings = useMemo(() => {
    return Math.max(...provinceData.map(p => p.meetings), 1);
  }, [provinceData]);

  const getProvinceColor = (provinceName: string) => {
    const data = provinceData.find(p => p.province === provinceName);
    if (!data) return '#1e293b'; // slate-800

    const intensity = data.meetings / maxMeetings;

    if (intensity >= 0.8) return '#3b82f6'; // blue-500
    if (intensity >= 0.6) return '#60a5fa'; // blue-400
    if (intensity >= 0.4) return '#93c5fd'; // blue-300
    if (intensity >= 0.2) return '#bfdbfe'; // blue-200
    return '#334155'; // slate-700
  };

  const getProvinceData = (provinceName: string) => {
    return provinceData.find(p => p.province === provinceName);
  };

  const getCircleSize = (meetings: number) => {
    const baseSize = 5;
    const scale = meetings / maxMeetings;
    return baseSize + (scale * 25);
  };

  return (
    <div className="relative w-full h-full bg-slate-900/50 rounded-xl border border-slate-700 overflow-hidden">
      <svg viewBox="0 0 800 600" className="w-full h-full">
        {/* Background */}
        <rect width="800" height="600" fill="#0f172a" />

        {/* Grid */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.5" opacity="0.3"/>
          </pattern>
        </defs>
        <rect width="800" height="600" fill="url(#grid)" />

        {/* Provinces */}
        <g>
          {SPAIN_PROVINCES.map((province) => {
            const data = getProvinceData(province.name);
            const isSelected = selectedProvince === province.name;
            const hasData = !!data;

            return (
              <g key={province.name}>
                {/* Province shape (simplified as rectangles for now) */}
                <rect
                  x={province.cx - 15}
                  y={province.cy - 15}
                  width="30"
                  height="30"
                  fill={getProvinceColor(province.name)}
                  stroke={isSelected ? '#3b82f6' : '#334155'}
                  strokeWidth={isSelected ? '2' : '1'}
                  opacity="0.6"
                  className="transition-all duration-300 cursor-pointer hover:opacity-100"
                  onClick={() => hasData && onProvinceClick(province.name)}
                  rx="4"
                />

                {/* Concentration circles */}
                {data && (
                  <>
                    <circle
                      cx={province.cx}
                      cy={province.cy}
                      r={getCircleSize(data.meetings)}
                      fill="#3b82f6"
                      opacity="0.3"
                      className="animate-pulse"
                    />
                    <circle
                      cx={province.cx}
                      cy={province.cy}
                      r={getCircleSize(data.meetings) * 0.6}
                      fill="#60a5fa"
                      opacity="0.5"
                    />
                    <circle
                      cx={province.cx}
                      cy={province.cy}
                      r={getCircleSize(data.meetings) * 0.3}
                      fill="#93c5fd"
                      opacity="0.8"
                    />

                    {/* Meeting count */}
                    <text
                      x={province.cx}
                      y={province.cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      fontSize="10"
                      fontWeight="bold"
                      className="pointer-events-none"
                    >
                      {data.meetings}
                    </text>
                  </>
                )}

                {/* Province name */}
                <text
                  x={province.cx}
                  y={province.cy + (data ? getCircleSize(data.meetings) + 12 : 20)}
                  textAnchor="middle"
                  fill={hasData ? '#cbd5e1' : '#475569'}
                  fontSize="9"
                  fontWeight={hasData ? '500' : '400'}
                  className="pointer-events-none"
                >
                  {province.name}
                </text>
              </g>
            );
          })}
        </g>

        {/* Legend */}
        <g transform="translate(20, 520)">
          <rect x="0" y="0" width="200" height="70" fill="#1e293b" opacity="0.9" rx="8" />
          <text x="10" y="20" fill="#f1f5f9" fontSize="12" fontWeight="bold">Concentración</text>

          {[
            { color: '#3b82f6', label: 'Alta (80%+)', y: 35 },
            { color: '#60a5fa', label: 'Media-Alta (60%)', y: 50 },
            { color: '#bfdbfe', label: 'Baja (20%)', y: 65 },
          ].map((item) => (
            <g key={item.label}>
              <circle cx="20" cy={item.y - 3} r="5" fill={item.color} />
              <text x="35" y={item.y} fill="#cbd5e1" fontSize="10">{item.label}</text>
            </g>
          ))}
        </g>

        {/* Stats */}
        <g transform="translate(580, 520)">
          <rect x="0" y="0" width="200" height="70" fill="#1e293b" opacity="0.9" rx="8" />
          <text x="10" y="20" fill="#f1f5f9" fontSize="12" fontWeight="bold">Estadísticas</text>
          <text x="10" y="38" fill="#cbd5e1" fontSize="10">
            Total Provincias: {provinceData.length}
          </text>
          <text x="10" y="53" fill="#cbd5e1" fontSize="10">
            Total Clientes: {provinceData.reduce((sum, p) => sum + p.clients, 0)}
          </text>
          <text x="10" y="68" fill="#cbd5e1" fontSize="10">
            Total Reuniones: {provinceData.reduce((sum, p) => sum + p.meetings, 0)}
          </text>
        </g>
      </svg>

      {/* Tooltip hint */}
      <div className="absolute top-4 right-4 bg-slate-800/90 backdrop-blur-sm border border-slate-600 rounded-lg px-3 py-2">
        <p className="text-xs text-slate-300">
          Haz clic en una provincia para ver detalles
        </p>
      </div>
    </div>
  );
}
