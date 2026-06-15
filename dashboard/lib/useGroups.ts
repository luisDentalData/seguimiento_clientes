'use client';

import useSWR from 'swr';
import { api } from '@/lib/api';

export interface GroupMember {
  id: string;
  name: string;
}

export interface ClinicGroup {
  id: number;
  name: string;
  members: GroupMember[];
}

const fetcher = (url: string) => api.get(url).then(res => res.data);

export function useGroups() {
  const { data, error, isLoading, mutate } = useSWR<ClinicGroup[]>(
    '/groups',
    fetcher,
    { refreshInterval: 60000 }
  );
  return { groups: data ?? [], error, isLoading, mutate };
}
