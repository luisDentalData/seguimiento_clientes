'use client';

import { useState } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';

export default function SyncButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSync = async () => {
    setIsLoading(true);
    setStatus('idle');
    setMessage('');

    try {
      const response = await api.post('/etl/run');
      setStatus('success');
      setMessage(response.data.message || 'Datos actualizados correctamente');

      // Limpiar mensaje después de 5 segundos
      setTimeout(() => {
        setStatus('idle');
        setMessage('');
      }, 5000);
    } catch (error: unknown) {
      const detailMsg =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setStatus('error');
      setMessage(detailMsg || 'Error al actualizar datos');

      // Limpiar mensaje después de 5 segundos
      setTimeout(() => {
        setStatus('idle');
        setMessage('');
      }, 5000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col items-end gap-2">
      <button
        onClick={handleSync}
        disabled={isLoading}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
          ${isLoading
            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
            : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg hover:shadow-xl'
          }
        `}
        title="Actualizar datos desde Google Calendar"
      >
        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        <span>{isLoading ? 'Actualizando...' : 'Sincronizar'}</span>
      </button>

      {/* Status Message */}
      {message && (
        <div
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg text-sm shadow-lg animate-in slide-in-from-top
            ${status === 'success'
              ? 'bg-green-500/20 border border-green-500/30 text-green-300'
              : 'bg-red-500/20 border border-red-500/30 text-red-300'
            }
          `}
        >
          {status === 'success' ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <span>{message}</span>
        </div>
      )}

      {/* Info tooltip - Solo visible cuando no está cargando */}
      {!isLoading && status === 'idle' && (
        <div className="text-xs text-slate-500 bg-slate-800/80 px-3 py-1 rounded-md">
          Función temporal de desarrollo
        </div>
      )}
    </div>
  );
}
