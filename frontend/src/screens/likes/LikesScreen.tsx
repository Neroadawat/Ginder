import React, {useMemo} from 'react';
import {
  ActivityIndicator,
  FlatList,
  ImageBackground,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {useSessionLikes, useSoloLikes} from '@/hooks/useVotes';
import {useSessionStore} from '@/stores/sessionStore';
import {RestaurantCard} from '@/types/restaurant';
import {getRestaurantImageUri} from '@/constants/restaurantImages';
import {COLORS} from '@/constants/theme';

interface GridEntry {
  key: string;
  restaurant: RestaurantCard;
  people: string[];
}

const LikesScreen = () => {
  const activeSessionId = useSessionStore(state => state.activeSessionId);
  return activeSessionId ? (
    <SessionGrid sessionId={activeSessionId} />
  ) : (
    <SoloGrid />
  );
};

const SoloGrid = () => {
  const {data, isLoading} = useSoloLikes();
  const entries = (data ?? []).map(item => ({
    key: item.id,
    restaurant: item.restaurant,
    people: [],
  }));
  return <LikesGrid entries={entries} isLoading={isLoading} session={false} />;
};

const SessionGrid = ({sessionId}: {sessionId: string}) => {
  const {data, isLoading} = useSessionLikes(sessionId);
  const entries = useMemo(() => {
    const grouped = new Map<string, GridEntry>();
    for (const like of data?.likes ?? []) {
      const existing = grouped.get(like.restaurant.id);
      if (existing) {
        if (!existing.people.includes(like.display_name)) {
          existing.people.push(like.display_name);
        }
      } else {
        grouped.set(like.restaurant.id, {
          key: like.restaurant.id,
          restaurant: like.restaurant,
          people: [like.display_name],
        });
      }
    }
    return [...grouped.values()];
  }, [data]);
  return <LikesGrid entries={entries} isLoading={isLoading} session />;
};

const LikesGrid = ({
  entries,
  isLoading,
  session,
}: {
  entries: GridEntry[];
  isLoading: boolean;
  session: boolean;
}) => {
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Likes</Text>
        <Text style={styles.subtitle}>
          {session
            ? 'Find restaurant that your friends want to eat'
            : 'Restaurants you want to try again'}
        </Text>
      </View>
      <FlatList
        data={entries}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        keyExtractor={item => item.key}
        renderItem={({item}) => <LikeTile entry={item} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.emptyText}>
              Swipe right on a restaurant to save it.
            </Text>
          </View>
        }
      />
    </View>
  );
};

const LikeTile = ({entry}: {entry: GridEntry}) => {
  const restaurant = entry.restaurant;
  const image =
    getRestaurantImageUri(restaurant);
  const open = () =>
    restaurant.google_maps_url && Linking.openURL(restaurant.google_maps_url);
  return (
    <TouchableOpacity
      style={styles.tile}
      onPress={open}
      disabled={!restaurant.google_maps_url}>
      <ImageBackground
        source={{uri: image}}
        style={styles.image}
        imageStyle={styles.imageRadius}>
        {entry.people.length > 0 && (
          <View style={styles.avatars}>
            {entry.people.slice(0, 4).map((name, index) => (
              <View
                key={`${name}-${index}`}
                style={[styles.avatar, index > 0 && styles.avatarOverlap]}>
                <Text style={styles.avatarText}>
                  {name.slice(0, 1).toUpperCase()}
                </Text>
              </View>
            ))}
          </View>
        )}
        <View style={styles.tileScrim} />
        <View style={styles.tileInfo}>
          <Text style={styles.name} numberOfLines={1}>
            {restaurant.name}
          </Text>
          <Text style={styles.price}>
            {restaurant.price_symbol ?? restaurant.primary_category}
          </Text>
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  header: {paddingHorizontal: 11, paddingTop: 60, paddingBottom: 14},
  title: {fontSize: 26, fontWeight: '800', color: COLORS.text},
  subtitle: {fontSize: 13, color: '#EEE', marginTop: 12},
  list: {paddingHorizontal: 6, paddingBottom: 92},
  row: {justifyContent: 'space-between'},
  tile: {flex: 1, height: 226, margin: 6, borderRadius: 17, overflow: 'hidden'},
  image: {flex: 1, justifyContent: 'flex-end'},
  imageRadius: {borderRadius: 17},
  tileScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 68,
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  tileInfo: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {flex: 1, color: '#FFF', fontSize: 13, fontWeight: '700'},
  price: {color: '#FFF', fontSize: 11},
  avatars: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 3,
    flexDirection: 'row',
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFF',
    backgroundColor: '#7A0015',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOverlap: {marginLeft: -6},
  avatarText: {fontSize: 10, fontWeight: '800', color: '#FFF'},
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  empty: {paddingTop: 100, alignItems: 'center'},
  emptyTitle: {fontSize: 20, fontWeight: '700', color: COLORS.text},
  emptyText: {fontSize: 14, color: COLORS.textMuted, marginTop: 8},
});

export default LikesScreen;
