/**
 * Notification hooks — fetch notifications, mark as read.
 */

import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';

import {notificationApi} from '@/services/api/notificationApi';

export const useNotifications = () => {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationApi.getNotifications(),
    refetchInterval: 5000,
    refetchOnMount: 'always',
  });
};

export const useMarkAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => notificationApi.markAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['notifications']});
    },
  });
};
