/**
 * Likes Screen — context-aware (requirement 11).
 *
 * In an active session it shows everyone's likes in real time; otherwise it
 * shows the user's own solo-mode likes. Either way, tapping a row opens
 * navigation to that restaurant (requirement 11.3).
 */

import React from 'react';
import {ActivityIndicator, FlatList, StyleSheet, Text, View} from 'react-native';

import RestaurantListItem from '@/components/RestaurantListItem';
import {useSessionLikes, useSoloLikes} from '@/hooks/useVotes';
import {useSessionStore} from '@/stores/sessionStore';

const LikesScreen = () => {
  const activeSessionId = useSessionStore(state => state.activeSessionId);

  return activeSessionId ? (
    <SessionLikesView sessionId={activeSessionId} />
  ) : (
    <SoloLikesView />
  );
};

const SoloLikesView = () => {
  const {data: likes, isLoading} = useSoloLikes();

  if (isLoading) {
    return <Loading />;
  }

  return (
    <View style={styles.container}>
      <Header title="❤️ Likes" subtitle="Restaurants you saved" />

      <FlatList
        data={likes ?? []}
        renderItem={({item}) => <RestaurantListItem restaurant={item.restaurant} />}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Empty emoji="💭" text="No likes yet. Start swiping!" />
        }
      />
    </View>
  );
};

const SessionLikesView = ({sessionId}: {sessionId: string}) => {
  const {data, isLoading} = useSessionLikes(sessionId);

  if (isLoading) {
    return <Loading />;
  }

  return (
    <View style={styles.container}>
      <Header title="❤️ Session Likes" subtitle="What your group is liking" />

      <FlatList
        data={data?.likes ?? []}
        renderItem={({item}) => (
          <View style={styles.entry}>
            <Text style={styles.byline}>
              <Text style={styles.bylineName}>{item.display_name}</Text> liked
            </Text>
            <RestaurantListItem restaurant={item.restaurant} />
          </View>
        )}
        keyExtractor={(item, index) =>
          `${item.user_id}-${item.restaurant.id}-${index}`
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Empty emoji="🤔" text="No likes from the group yet" />}
      />
    </View>
  );
};

const Header = ({title, subtitle}: {title: string; subtitle: string}) => (
  <View style={styles.header}>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.subtitle}>{subtitle}</Text>
  </View>
);

const Loading = () => (
  <View style={styles.centered}>
    <ActivityIndicator size="large" color="#FF6B6B" accessibilityLabel="Loading likes" />
  </View>
);

const Empty = ({emoji, text}: {emoji: string; text: string}) => (
  <View style={styles.empty}>
    <Text style={styles.emptyEmoji}>{emoji}</Text>
    <Text style={styles.emptyText}>{text}</Text>
  </View>
);

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
  entry: {
    marginBottom: 4,
  },
  byline: {
    fontSize: 13,
    color: '#999',
    marginBottom: 6,
    marginLeft: 4,
  },
  bylineName: {
    fontWeight: '600',
    color: '#FF6B6B',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
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
