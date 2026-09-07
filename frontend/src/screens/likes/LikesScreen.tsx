/**
 * Likes Screen — Shows solo likes or session real-time likes depending on context.
 *
 * - Not in session → solo mode personal likes history
 * - In active session → real-time likes from all participants
 */

import React from 'react';
import {View, Text, StyleSheet, FlatList, ActivityIndicator} from 'react-native';

import RestaurantListItem from '@/components/RestaurantListItem';
import {useSessionStore} from '@/stores/sessionStore';
import {useSoloLikes, useSessionLikes} from '@/hooks/useVotes';

const LikesScreen = () => {
  const activeSessionId = useSessionStore(state => state.activeSessionId);

  if (activeSessionId) {
    return <SessionLikesView sessionId={activeSessionId} />;
  }
  return <SoloLikesView />;
};

const SoloLikesView = () => {
  const {data: likes, isLoading} = useSoloLikes();

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B6B" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>❤️ Likes</Text>
        <Text style={styles.subtitle}>Your liked restaurants</Text>
      </View>

      <FlatList
        data={likes}
        renderItem={({item}) => (
          <View style={styles.likeItem}>
            <Text style={styles.likeName}>{item.restaurant_name}</Text>
          </View>
        )}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>💭</Text>
            <Text style={styles.emptyText}>No likes yet. Start swiping!</Text>
          </View>
        }
      />
    </View>
  );
};

const SessionLikesView = ({sessionId}: {sessionId: string}) => {
  const {data: likesData, isLoading} = useSessionLikes(sessionId);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B6B" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>❤️ Session Likes</Text>
        <Text style={styles.subtitle}>Real-time likes from your group</Text>
      </View>

      <FlatList
        data={likesData?.likes ?? []}
        renderItem={({item}) => (
          <View style={styles.likeItem}>
            <Text style={styles.likeUser}>{item.display_name}</Text>
            <Text style={styles.likeArrow}> liked </Text>
            <Text style={styles.likeName}>{item.restaurant_name}</Text>
          </View>
        )}
        keyExtractor={(item, index) => `${item.user_id}-${item.restaurant_id}-${index}`}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No likes yet from the group</Text>
          </View>
        }
      />
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
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  list: {
    padding: 16,
  },
  likeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  likeUser: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  likeArrow: {
    fontSize: 14,
    color: '#999',
  },
  likeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    padding: 40,
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});

export default LikesScreen;
