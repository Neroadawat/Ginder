/**
 * User hooks — profile, update, delete account.
 */

import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';

import {userApi} from '@/services/api/userApi';

export const useProfile = () => {
  return useQuery({
    queryKey: ['profile'],
    queryFn: () => userApi.getProfile(),
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {display_name?: string}) => userApi.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['profile']});
    },
  });
};

export const useDeleteAccount = () => {
  return useMutation({
    mutationFn: () => userApi.deleteAccount(),
  });
};
