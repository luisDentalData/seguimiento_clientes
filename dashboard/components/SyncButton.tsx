'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/dd/components';

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
      setTimeout(() => { setStatus('idle'); setMessage(''); }, 5000);
    } catch (error: unknown) {
      const detailMsg =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setStatus('error');
      setMessage(detailMsg || 'Error al actualizar datos');
      setTimeout(() => { setStatus('idle'); setMessage(''); }, 5000);
    } finally {
      setIsLoading(false);
    }
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
        {isLoading ? 'Actualizando...' : 'Sincronizar'}
      </Button>

      {message && (
        <div
          className={[
            'flex items-center gap-2 px-3 py-2 text-sm border',
            status === 'success'
              ? 'bg-success/10 border-success/30 text-success'
              : 'bg-danger-tint border-danger-fg/30 text-danger-fg',
          ].join(' ')}
        >
          <span className="material-symbols-outlined text-[16px] leading-none" aria-hidden="true">
            {status === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{message}</span>
        </div>
      )}
    </div>
  );
}
