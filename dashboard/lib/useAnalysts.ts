'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';

export interface Analyst {
  email: string;
  name: string;
  is_active: boolean;
}

const fetcher = (url: string) => api.get(url).then(res => res.data);

/**
 * Hook único de analistas — reemplaza los hardcodeos repartidos por el frontend.
 *
 * - `all`: todas (activas e inactivas) → para resolver nombres en vistas históricas
 * - `active`: solo activas → para los dropdowns de filtro
 * - `nameByEmail(email)`: nombre legible (cae al usuario del email si no se encuentra)
 */
export function useAnalysts() {
  const { data, error, isLoading, mutate } = useSWR<Analyst[]>(
    '/analysts',
    fetcher,
    { refreshInterval: 60000 }
  );

  const all = data ?? [];
  const active = all.filter(a => a.is_active);

  // useCallback con dep [data] → identidad estable entre renders (SWR mantiene
  // la referencia de data); evita warnings de exhaustive-deps en los consumidores.
  const nameByEmail = useCallback(
    (email: string): string => {
      const found = (data ?? []).find(a => a.email === email);
      return found?.name ?? email.split('@')[0];
    },
    [data]
  );

  return { all, active, nameByEmail, error, isLoading, mutate };
}
