'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/dd/components';

export default function SyncButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setElapsedSeconds(0);
      return;
    }
    const interval = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleSync = async () => {
    setIsLoading(true);
    setStatus('idle');
    setMessage('');

    try {
      // ETL is synchronous — can take 2-4 minutes. Override global 60s timeout.
      const response = await api.post('/etl/run', {}, { timeout: 600_000 });
      setStatus('success');
      setMessage(response.data.message || 'Datos actualizados correctamente');
      setTimeout(() => { setStatus('idle'); setMessage(''); }, 8000);
    } catch (error: unknown) {
      const detailMsg =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setStatus('error');
      setMessage(detailMsg || 'Error al actualizar datos');
      setTimeout(() => { setStatus('idle'); setMessage(''); }, 8000);
    } finally {
      setIsLoading(false);
    }
  };

  const formatElapsed = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col items-end gap-2">
      <Button
        variant="primary"
        loading={isLoading}
        disabled={isLoading}
        onClick={handleSync}
        title="Actualizar datos desde Google Calendar"
      >
        {!isLoading && (
          <span className="material-symbols-outlined text-[16px] leading-none" aria-hidden="true">
            sync
          </span>
        )}
        {isLoading ? `Sincronizando... ${formatElapsed(elapsedSeconds)}` : 'Sincronizar'}
      </Button>

      {isLoading && (
        <div className="text-fg-muted text-xs text-right max-w-[220px]">
          Obteniendo eventos de Google Calendar y clasificando reuniones...
        </div>
      )}

      {message && (
        <div
          className={[
            'flex items-center gap-2 px-3 py-2 text-sm border max-w-[280px]',
            status === 'success'
              ? 'bg-success/10 border-success/30 text-success'
              : 'bg-danger-tint border-danger-fg/30 text-danger-fg',
          ].join(' ')}
        >
          <span className="material-symbols-outlined text-[16px] leading-none flex-shrink-0" aria-hidden="true">
            {status === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{message}</span>
        </div>
      )}
    </div>
  );
}
