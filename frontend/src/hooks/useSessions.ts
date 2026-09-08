/**
 * Session hooks — create, join, start, kick, get session.
 */

import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';

import {sessionApi} from '@/services/api/sessionApi';
import {useSessionStore} from '@/stores/sessionStore';
import {CreateSessionRequest} from '@/types/api';

export const useCreateSession = () => {
  const setActiveSession = useSessionStore(state => state.setActiveSession);

  return useMutation({
    mutationFn: (data: CreateSessionRequest) => sessionApi.create(data),
    onSuccess: (session) => {
      setActiveSession(session.id);
    },
  });
};

export const useJoinSession = () => {
  const setActiveSession = useSessionStore(state => state.setActiveSession);

  return useMutation({
    mutationFn: (inviteCode: string) => sessionApi.join(inviteCode),
    onSuccess: (lobby) => {
      setActiveSession(lobby.session.id);
    },
  });
};

export const useSession = (sessionId: string) => {
  return useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => sessionApi.getSession(sessionId),
    refetchInterval: 5000, // Poll every 5 seconds for lobby updates
  });
};

export const useStartSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => sessionApi.start(sessionId),
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({queryKey: ['session', sessionId]});
    },
  });
};

export const useKickParticipant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({sessionId, userId}: {sessionId: string; userId: string}) =>
      sessionApi.kick(sessionId, userId),
    onSuccess: (_, {sessionId}) => {
      queryClient.invalidateQueries({queryKey: ['session', sessionId]});
    },
  });
};

/**
 * Tell the server this client has swiped its whole deck.
 *
 * The response says whether that was the last participant, in which case the
 * session has already resolved (requirement 9.2).
 */
export const useReportDeckFinished = () => {
  return useMutation({
    mutationFn: (sessionId: string) => sessionApi.reportDeckFinished(sessionId),
  });
};

export const useSessionResult = (sessionId: string, enabled = true) => {
  return useQuery({
    queryKey: ['session', sessionId, 'result'],
    queryFn: () => sessionApi.getResult(sessionId),
    enabled: enabled && !!sessionId,
    // A finished result never changes.
    staleTime: Infinity,
    retry: 1,
  });
};
