/**
 * Friends hooks — list, search, unfriend.
 */

import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';

import {friendApi} from '@/services/api/friendApi';

export const useFriends = () => {
  return useQuery({
    queryKey: ['friends'],
    queryFn: () => friendApi.listFriends(),
  });
};

export const useSearchFriends = (query: string) => {
  return useQuery({
    queryKey: ['friends', 'search', query],
    queryFn: () => friendApi.searchFriends(query),
    enabled: query.length > 0,
  });
};

export const useUnfriend = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (friendId: string) => friendApi.unfriend(friendId),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['friends']});
    },
  });
};
