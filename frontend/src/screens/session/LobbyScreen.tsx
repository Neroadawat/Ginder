import React, {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Alert, FlatList, Modal, Share, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';

import LobbyPlayerItem from '@/components/LobbyPlayerItem';
import {COLORS} from '@/constants/theme';
import {useFriends} from '@/hooks/useFriends';
import {useInviteFriend, useKickParticipant, useLeaveSession, useSession, useStartSession} from '@/hooks/useSessions';
import {useSessionWebSocket} from '@/hooks/useWebSocket';
import {SessionStackParamList} from '@/navigation/types';
import {useAuthStore} from '@/stores/authStore';
import {useSessionStore} from '@/stores/sessionStore';

type RouteProps = RouteProp<SessionStackParamList, 'Lobby'>;
type NavigationProp = NativeStackNavigationProp<SessionStackParamList, 'Lobby'>;

const LobbyScreen = () => {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProp>();
  const userId = useAuthStore(state => state.userId);
  const clearSession = useSessionStore(state => state.clearSession);
  const {data: lobby, isLoading, isError, error, refetch} = useSession(route.params.sessionId);
  const {data: friendData, isLoading: friendsLoading} = useFriends();
  const startMutation = useStartSession();
  const kickMutation = useKickParticipant();
  const inviteMutation = useInviteFriend();
  const leaveMutation = useLeaveSession();
  const {lastEvent, isConnected} = useSessionWebSocket(route.params.sessionId);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitedIds, setInvitedIds] = useState<string[]>([]);

  const isHost = lobby?.session.host_id === userId;
  const participantIds = useMemo(() => new Set(lobby?.participants.map(item => item.user_id) ?? []), [lobby?.participants]);
  const availableFriends = (friendData?.friends ?? []).filter(friend => !participantIds.has(friend.id));

  useEffect(() => {
    if (
      lastEvent?.event === 'user_left' &&
      (lastEvent.data.session_cancelled || lastEvent.data.user_id === userId)
    ) {
      clearSession();
      Alert.alert(
        lastEvent.data.session_cancelled ? 'Session cancelled' : 'You left the lobby',
        lastEvent.data.session_cancelled ? 'The host closed this session.' : 'You are no longer in this session.',
      );
      navigation.getParent()?.goBack();
      return;
    }
    if (lastEvent?.event === 'user_joined' || lastEvent?.event === 'user_left') {
      refetch();
    }
    if (lobby?.session.status === 'active' || lastEvent?.event === 'session_started') {
      navigation.replace('SessionSwipe', {
        sessionId: route.params.sessionId,
        endsAt:
          (lastEvent?.data.ends_at as string | undefined) ??
          lobby?.session.ends_at ??
          undefined,
      });
    }
  }, [clearSession, lastEvent, lobby?.session.status, navigation, refetch, route.params.sessionId, userId]);

  const shareInvite = async () => {
    if (!lobby) {
      return;
    }
    try {
      await Share.share({title: 'Join my Ginder session', message: `Join my Ginder session. Code: ${lobby.session.invite_code}\nginder://session/join?code=${lobby.session.invite_code}`});
    } catch {
      Alert.alert('Could not share', 'Please try again, or send the invite code shown above.');
    }
  };

  const invite = (friendId: string, name: string) => {
    inviteMutation.mutate(
      {sessionId: route.params.sessionId, friendId},
      {
        onSuccess: response => {
          setInvitedIds(ids => [...new Set([...ids, friendId])]);
          Alert.alert('Invite sent', `${name} can accept it from Invitations.\n\n${response.message}`);
        },
        onError: inviteError => Alert.alert('Could not invite', inviteError.message),
      },
    );
  };

  const start = () => {
    startMutation.mutate(route.params.sessionId, {
      onSuccess: response =>
        navigation.replace('SessionSwipe', {
          sessionId: route.params.sessionId,
          endsAt: response.ends_at,
        }),
      onError: startError => Alert.alert('Could not start', startError.message),
    });
  };

  const kick = (kickUserId: string, name: string) => {
    Alert.alert('Remove participant?', `${name} will leave this lobby.`, [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Remove', style: 'destructive', onPress: () => kickMutation.mutate({sessionId: route.params.sessionId, userId: kickUserId}, {onError: kickError => Alert.alert('Could not remove', kickError.message)})},
    ]);
  };

  const leave = () => {
    const title = isHost ? 'Cancel this session?' : 'Leave this lobby?';
    const message = isHost ? 'The lobby will close for everyone.' : 'You can rejoin later while the lobby is still open.';
    Alert.alert(title, message, [
      {text: 'Stay', style: 'cancel'},
      {text: isHost ? 'Cancel session' : 'Leave', style: 'destructive', onPress: () => leaveMutation.mutate(route.params.sessionId, {onSuccess: () => navigation.getParent()?.goBack(), onError: leaveError => Alert.alert('Could not leave', leaveError.message)})},
    ]);
  };

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.accent} /></View>;
  }
  if (isError || !lobby) {
    return <View style={styles.centered}><Text style={styles.errorTitle}>Lobby unavailable</Text><Text style={styles.muted}>{error?.message ?? 'This session no longer exists.'}</Text><TouchableOpacity style={styles.secondaryButton} onPress={() => refetch()}><Text style={styles.secondaryText}>Try again</Text></TouchableOpacity></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View><Text style={styles.eyebrow}>{isHost ? 'YOUR PARTY' : 'FRIEND PARTY'}</Text><Text style={styles.title}>Lobby</Text></View>
        <View style={[styles.connection, isConnected && styles.connected]}><Text style={styles.connectionText}>{isConnected ? 'Live' : 'Reconnecting'}</Text></View>
      </View>
      <View style={styles.codeCard}>
        <Text style={styles.codeLabel}>INVITE CODE</Text>
        <Text selectable style={styles.code}>{lobby.session.invite_code}</Text>
        <Text style={styles.settings}>{lobby.session.radius_km} km  ·  {lobby.session.duration_seconds / 60} min</Text>
        <View style={styles.inviteActions}>
          <TouchableOpacity style={styles.inviteButton} onPress={() => setInviteOpen(true)}><Text style={styles.inviteButtonText}>Invite friends</Text></TouchableOpacity>
          <TouchableOpacity style={styles.shareButton} onPress={shareInvite}><Text style={styles.shareButtonText}>Share link</Text></TouchableOpacity>
        </View>
      </View>
      <Text style={styles.participantsTitle}>In the lobby · {lobby.participants.length}</Text>
      <FlatList data={lobby.participants} renderItem={({item}) => <LobbyPlayerItem participant={item} isHost={isHost} isCurrentUser={item.user_id === userId} onKick={() => kick(item.user_id, item.display_name)} />} keyExtractor={item => item.user_id} contentContainerStyle={styles.list} />
      {isHost ? <TouchableOpacity style={styles.startButton} onPress={start} disabled={startMutation.isPending}>{startMutation.isPending ? <ActivityIndicator color="#FFF" /> : <Text style={styles.startText}>Start session</Text>}</TouchableOpacity> : <Text style={styles.waiting}>Waiting for the host to start…</Text>}
      <TouchableOpacity style={styles.leaveButton} onPress={leave} disabled={leaveMutation.isPending}><Text style={styles.leaveText}>{isHost ? 'Cancel session' : 'Leave lobby'}</Text></TouchableOpacity>

      <Modal visible={inviteOpen} transparent animationType="slide" onRequestClose={() => setInviteOpen(false)}>
        <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={() => setInviteOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} /><Text style={styles.sheetTitle}>Invite friends</Text>
          <Text style={styles.sheetSubtitle}>They receive an in-app invitation and can accept with one tap.</Text>
          {friendsLoading ? <ActivityIndicator style={styles.sheetLoader} color={COLORS.accent} /> : (
            <FlatList data={availableFriends} keyExtractor={item => item.id} style={styles.friendList} renderItem={({item}) => {
              const sent = invitedIds.includes(item.id);
              return <View style={styles.friendRow}><View style={styles.avatar}><Text style={styles.avatarText}>{item.display_name.slice(0, 1).toUpperCase()}</Text></View><View style={styles.friendCopy}><Text style={styles.friendName}>{item.display_name}</Text><Text style={styles.friendEmail}>{item.email}</Text></View><TouchableOpacity style={[styles.sendButton, sent && styles.sentButton]} disabled={sent || inviteMutation.isPending} onPress={() => invite(item.id, item.display_name)}><Text style={styles.sendText}>{sent ? 'Sent' : 'Invite'}</Text></TouchableOpacity></View>;
            }} ListEmptyComponent={<Text style={styles.emptyFriends}>No friends available yet. Share the link instead—joining will add each other as friends.</Text>} />
          )}
          <TouchableOpacity style={styles.doneButton} onPress={() => setInviteOpen(false)}><Text style={styles.doneText}>Done</Text></TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background, paddingTop: 54},
  header: {paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  eyebrow: {fontSize: 11, letterSpacing: 1.8, fontWeight: '800', color: COLORS.accent},
  title: {fontSize: 32, fontWeight: '900', color: COLORS.text, marginTop: 2},
  connection: {borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#3A2424'},
  connected: {backgroundColor: '#173726'}, connectionText: {fontSize: 11, color: '#FFF', fontWeight: '700'},
  codeCard: {margin: 18, padding: 20, borderRadius: 22, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center'},
  codeLabel: {fontSize: 10, letterSpacing: 2, color: COLORS.textMuted, fontWeight: '700'},
  code: {fontSize: 30, letterSpacing: 3, color: COLORS.text, fontWeight: '900', marginTop: 6},
  settings: {fontSize: 12, color: COLORS.textMuted, marginTop: 7},
  inviteActions: {flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 18},
  inviteButton: {flex: 1, borderRadius: 14, backgroundColor: COLORS.accent, paddingVertical: 12, alignItems: 'center'}, inviteButtonText: {color: '#FFF', fontWeight: '800'},
  shareButton: {flex: 1, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 12, alignItems: 'center'}, shareButtonText: {color: COLORS.text, fontWeight: '700'},
  participantsTitle: {fontSize: 15, color: COLORS.text, fontWeight: '800', paddingHorizontal: 20, marginBottom: 10}, list: {paddingHorizontal: 18, paddingBottom: 16},
  startButton: {backgroundColor: COLORS.accent, borderRadius: 18, height: 56, alignItems: 'center', justifyContent: 'center', margin: 18}, startText: {color: '#FFF', fontSize: 17, fontWeight: '900'}, waiting: {color: COLORS.textMuted, textAlign: 'center', padding: 28},
  leaveButton: {alignItems: 'center', paddingVertical: 10, marginTop: -14, marginBottom: 8}, leaveText: {color: '#A59F9F', fontSize: 13, fontWeight: '700'},
  centered: {flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', padding: 30}, errorTitle: {fontSize: 24, color: COLORS.text, fontWeight: '800', marginBottom: 8}, muted: {fontSize: 14, lineHeight: 20, textAlign: 'center', color: COLORS.textMuted}, secondaryButton: {borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 14, marginTop: 22}, secondaryText: {color: COLORS.text, fontWeight: '700'},
  scrim: {flex: 1, backgroundColor: 'rgba(0,0,0,0.68)'}, sheet: {maxHeight: '72%', backgroundColor: COLORS.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 30}, sheetHandle: {width: 42, height: 4, borderRadius: 2, backgroundColor: '#625B5B', alignSelf: 'center', marginBottom: 18}, sheetTitle: {fontSize: 24, color: COLORS.text, fontWeight: '900'}, sheetSubtitle: {fontSize: 13, lineHeight: 19, color: COLORS.textMuted, marginTop: 5, marginBottom: 14}, sheetLoader: {marginVertical: 35}, friendList: {maxHeight: 310},
  friendRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border}, avatar: {width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.accentDark, alignItems: 'center', justifyContent: 'center', marginRight: 11}, avatarText: {color: '#FFF', fontWeight: '900'}, friendCopy: {flex: 1}, friendName: {color: COLORS.text, fontWeight: '800', fontSize: 14}, friendEmail: {color: COLORS.textMuted, fontSize: 11, marginTop: 2}, sendButton: {backgroundColor: COLORS.accent, borderRadius: 12, paddingHorizontal: 15, paddingVertical: 9}, sentButton: {backgroundColor: '#28583A'}, sendText: {color: '#FFF', fontWeight: '800', fontSize: 12}, emptyFriends: {color: COLORS.textMuted, lineHeight: 20, textAlign: 'center', paddingVertical: 30}, doneButton: {height: 48, borderRadius: 14, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', marginTop: 16}, doneText: {color: '#111', fontWeight: '900'},
});

export default LobbyScreen;
