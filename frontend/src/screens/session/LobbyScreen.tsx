/**
 * Lobby Screen — Waiting room before session starts.
 * Host can kick players, start session, and share invite link.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Share,
  ActivityIndicator,
} from 'react-native';
import {useRoute, RouteProp} from '@react-navigation/native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';

import LobbyPlayerItem from '@/components/LobbyPlayerItem';
import {useSession, useStartSession, useKickParticipant} from '@/hooks/useSessions';
import {useAuthStore} from '@/stores/authStore';
import {SessionStackParamList} from '@/navigation/types';

type RouteProps = RouteProp<SessionStackParamList, 'Lobby'>;
type NavigationProp = NativeStackNavigationProp<SessionStackParamList, 'Lobby'>;

const LobbyScreen = () => {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProp>();
  const userId = useAuthStore(state => state.userId);
  const {data: lobby, isLoading} = useSession(route.params.sessionId);
  const startMutation = useStartSession();
  const kickMutation = useKickParticipant();

  const isHost = lobby?.session.host_id === userId;

  const handleShare = async () => {
    if (!lobby) return;
    try {
      await Share.share({
        message: `Join my Ginder session! 🍽️\nginder://session/join?code=${lobby.session.invite_code}`,
      });
    } catch {
      // User cancelled
    }
  };

  const handleStart = () => {
    startMutation.mutate(route.params.sessionId, {
      onSuccess: () => {
        navigation.replace('SessionSwipe', {sessionId: route.params.sessionId});
      },
    });
  };

  const handleKick = (kickUserId: string) => {
    kickMutation.mutate({
      sessionId: route.params.sessionId,
      userId: kickUserId,
    });
  };

  if (isLoading || !lobby) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B6B" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🏠 Lobby</Text>
        <Text style={styles.info}>
          Radius: {lobby.session.radius_km} km • Timer: {lobby.session.duration_seconds / 60} min
        </Text>
      </View>

      <View style={styles.inviteSection}>
        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleShare}
          accessibilityRole="button"
          accessibilityLabel="Share invite link">
          <Text style={styles.shareText}>📤 Share Invite Link</Text>
        </TouchableOpacity>
        <Text style={styles.inviteCode}>Code: {lobby.session.invite_code}</Text>
      </View>

      <Text style={styles.participantsTitle}>
        Participants ({lobby.participants.length})
      </Text>

      <FlatList
        data={lobby.participants}
        renderItem={({item}) => (
          <LobbyPlayerItem
            participant={item}
            isHost={isHost}
            isCurrentUser={item.user_id === userId}
            onKick={() => handleKick(item.user_id)}
          />
        )}
        keyExtractor={item => item.user_id}
        contentContainerStyle={styles.list}
      />

      {isHost && (
        <TouchableOpacity
          style={styles.startButton}
          onPress={handleStart}
          disabled={startMutation.isPending}
          accessibilityRole="button"
          accessibilityLabel="Start session">
          {startMutation.isPending ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.startText}>🚀 Start Session</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#FFF',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
  },
  info: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  inviteSection: {
    backgroundColor: '#FFF',
    padding: 16,
    margin: 16,
    borderRadius: 16,
    alignItems: 'center',
    gap: 8,
  },
  shareButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  shareText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  inviteCode: {
    fontSize: 12,
    color: '#999',
  },
  participantsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  list: {
    paddingHorizontal: 16,
  },
  startButton: {
    backgroundColor: '#38A169',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    margin: 16,
  },
  startText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default LobbyScreen;
