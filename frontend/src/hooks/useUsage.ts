import {useQuery} from '@tanstack/react-query';

import {usageApi} from '@/services/api/usageApi';

export const useGoogleUsage = () =>
  useQuery({
    queryKey: ['usage', 'google'],
    queryFn: usageApi.getGoogleUsage,
    staleTime: 30_000,
  });
