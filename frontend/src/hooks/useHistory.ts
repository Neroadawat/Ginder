/**
 * History hooks — fetch match history.
 */

import {useQuery} from '@tanstack/react-query';

import {historyApi} from '@/services/api/historyApi';

export const useHistory = () => {
  return useQuery({
    queryKey: ['history'],
    queryFn: () => historyApi.getHistory(),
  });
};
