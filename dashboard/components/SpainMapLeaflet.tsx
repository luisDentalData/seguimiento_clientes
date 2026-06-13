'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import type { LeafletMouseEvent } from 'leaflet';

interface SpainMapLeafletProps {
  provinceData: {
    province: string;
    meetings: number;
    clients: number;
  }[];
  onProvinceClick: (province: string) => void;
  selectedProvince: string | null;
}

// Coordenadas aproximadas de las capitales de provincia de España
const PROVINCE_COORDINATES: Record<string, [number, number]> = {
  'Madrid': [40.4168, -3.7038],
  'Barcelona': [41.3851, 2.1734],
  'Valencia': [39.4699, -0.3763],
  'Sevilla': [37.3891, -5.9845],
  'Zaragoza': [41.6488, -0.8891],
  'Málaga': [36.7213, -4.4214],
  'Murcia': [37.9922, -1.1307],
  'Palma': [39.5696, 2.6502],
  'Las Palmas': [28.1248, -15.4300],
  'Bilbao': [43.2630, -2.9350],
  'Alicante': [38.3452, -0.4810],
  'Córdoba': [37.8882, -4.7794],
  'Valladolid': [41.6520, -4.7245],
  'Vigo': [42.2406, -8.7207],
  'Gijón': [43.5322, -5.6611],
  'Hospitalet': [41.3599, 2.1073],
  'Vitoria': [42.8467, -2.6716],
  'Granada': [37.1773, -3.5986],
  'Elche': [38.2699, -0.6983],
  'Oviedo': [43.3614, -5.8493],
  'Badalona': [41.4501, 2.2445],
  'Cartagena': [37.6256, -0.9960],
  'Terrassa': [41.5633, 2.0118],
  'Jerez': [36.6866, -6.1362],
  'Sabadell': [41.5432, 2.1088],
  'Móstoles': [40.3227, -3.8649],
  'Alcalá': [40.4818, -3.3642],
  'Pamplona': [42.8125, -1.6458],
  'Fuenlabrada': [40.2842, -3.7938],
  'Almería': [36.8381, -2.4597],
  'Leganés': [40.3273, -3.7635],
  'Santander': [43.4623, -3.8100],
  'Castellón': [39.9864, -0.0513],
  'Burgos': [42.3439, -3.6969],
  'Albacete': [38.9943, -1.8585],
  'Getafe': [40.3056, -3.7329],
  'Alcorcón': [40.3456, -3.8242],
  'Logroño': [42.4627, -2.4450],
  'Badajoz': [38.8794, -6.9707],
  'Salamanca': [40.9701, -5.6635],
  'Huelva': [37.2614, -6.9447],
  'Tarragona': [41.1189, 1.2445],
  'Lleida': [41.6175, 0.6200],
  'Marbella': [36.5100, -4.8825],
  'León': [42.5987, -5.5671],
  'Cádiz': [36.5271, -6.2886],
  'Dos Hermanas': [37.2826, -5.9208],
  'Mataró': [41.5426, 2.4445],
  'Torrejón': [40.4559, -3.4770],
  'Santa Cruz': [28.4636, -16.2518],
  'Parla': [40.2374, -3.7673],
  'Alcobendas': [40.5479, -3.6418],
  'Reus': [41.1557, 1.1064],
  'Telde': [27.9924, -15.4188],
  'Ourense': [42.3369, -7.8642],
  'Torrevieja': [37.9787, -0.6820],
  'Girona': [41.9794, 2.8214],
  'Lugo': [43.0097, -7.5567],
  'Cáceres': [39.4753, -6.3724],
  'Palencia': [42.0096, -4.5288],
  'Melilla': [35.2923, -2.9381],
  'San Sebastián': [43.3183, -1.9812],
  'Pontevedra': [42.4332, -8.6482],
  'Zamora': [41.5034, -5.7446],
  'Cuenca': [40.0704, -2.1374],
  'Guadalajara': [40.6327, -3.1677],
  'Segovia': [40.9429, -4.1088],
  'Ávila': [40.6566, -4.6810],
  'Toledo': [39.8628, -4.0273],
  'Soria': [41.7665, -2.4790],
  'Teruel': [40.3456, -1.1065],
  'Jaén': [37.7796, -3.7849],
  'Ciudad Real': [38.9848, -3.9272],
  'Gipuzkoa': [43.1828, -2.1019],
  'Vizcaya': [43.2630, -2.9350],
  'Álava': [42.8467, -2.6716],
  'Navarra': [42.8125, -1.6458],
  'La Rioja': [42.4627, -2.4450],
  'Cantabria': [43.4623, -3.8100],
  'Asturias': [43.3614, -5.8493],
  'Galicia': [42.8782, -8.5448],
  'Islas Baleares': [39.5696, 2.6502],
  'Illes Balears': [39.5696, 2.6502],
  'Provincia': [40.4168, -3.7038], // Default
};

function SpainMapLeafletComponent({ provinceData, onProvinceClick, selectedProvince }: SpainMapLeafletProps) {
  const [map, setMap] = useState<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const L = require('leaflet');

    // Fix para los iconos de Leaflet
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });

    const mapInstance = L.map('map').setView([40.4168, -3.7038], 6);

    // Mapa con colores vibrantes (Voyager de CARTO)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(mapInstance);

    setMap(mapInstance);

    return () => {
      mapInstance.remove();
    };
  }, []);

  useEffect(() => {
    if (!map || typeof window === 'undefined') return;

    const L = require('leaflet');

    // Limpiar marcadores previos
    map.eachLayer((layer: any) => {
      if (layer instanceof L.CircleMarker) {
        map.removeLayer(layer);
      }
    });

    const maxMeetings = Math.max(...provinceData.map(p => p.meetings), 1);

    provinceData.forEach((province) => {
      const coords = PROVINCE_COORDINATES[province.province] || PROVINCE_COORDINATES['Provincia'];
      const intensity = province.meetings / maxMeetings;

      // Tamaño del círculo basado en el número de reuniones
      const radius = 10 + (intensity * 35);

      // Gradiente de colores vibrantes (de cyan a magenta)
      let color = '#06b6d4'; // cyan-500
      let fillColor = '#06b6d4';

      if (intensity >= 0.8) {
        color = '#ec4899'; // pink-500
        fillColor = '#f472b6'; // pink-400
      } else if (intensity >= 0.6) {
        color = '#8b5cf6'; // violet-500
        fillColor = '#a78bfa'; // violet-400
      } else if (intensity >= 0.4) {
        color = '#3b82f6'; // blue-500
        fillColor = '#60a5fa'; // blue-400
      } else if (intensity >= 0.2) {
        color = '#06b6d4'; // cyan-500
        fillColor = '#22d3ee'; // cyan-400
      } else {
        color = '#10b981'; // emerald-500
        fillColor = '#34d399'; // emerald-400
      }

      const circle = L.circleMarker(coords, {
        radius: radius,
        fillColor: fillColor,
        color: selectedProvince === province.province ? '#fbbf24' : color,
        weight: selectedProvince === province.province ? 4 : 2,
        opacity: 1,
        fillOpacity: 0.7
      }).addTo(map);

      // Tooltip con colores vibrantes
      circle.bindTooltip(`
        <div style="text-align: center;">
          <strong style="font-size: 14px; color: ${fillColor};">${province.province}</strong><br/>
          <span style="color: #60a5fa;">📅 ${province.meetings} reuniones</span><br/>
          <span style="color: #34d399;">👥 ${province.clients} clientes</span>
        </div>
      `, {
        permanent: false,
        direction: 'top',
        className: 'custom-tooltip'
      });

      // Click event
      circle.on('click', () => {
        onProvinceClick(province.province);
      });

      // Hover effect
      circle.on('mouseover', (e: LeafletMouseEvent) => {
        e.target.setStyle({
          fillOpacity: 0.9,
          weight: 3
        });
      });

      circle.on('mouseout', (e: LeafletMouseEvent) => {
        e.target.setStyle({
          fillOpacity: 0.6,
          weight: selectedProvince === province.province ? 3 : 1
        });
      });
    });
  }, [map, provinceData, selectedProvince, onProvinceClick]);

  return (
    <div className="relative w-full h-full">
      <div id="map" className="w-full h-full rounded-lg" />
      <style jsx global>{`
        .custom-tooltip {
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.98), rgba(51, 65, 85, 0.98)) !important;
          border: 2px solid rgba(96, 165, 250, 0.5) !important;
          border-radius: 12px !important;
          padding: 10px 14px !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(59, 130, 246, 0.3) !important;
          backdrop-filter: blur(10px) !important;
        }
        .custom-tooltip::before {
          border-top-color: rgba(30, 41, 59, 0.98) !important;
        }
        .leaflet-container {
          background: #f8fafc !important;
          font-family: inherit !important;
        }
      `}</style>
    </div>
  );
}

// Exportar como componente dinámico (sin SSR)
export default dynamic(() => Promise.resolve(SpainMapLeafletComponent), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-900/50 rounded-lg">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-slate-400">Cargando mapa...</p>
      </div>
    </div>
  ),
});
