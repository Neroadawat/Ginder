/**
 * Category Results Screen — Shows restaurants filtered by a specific category.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import {useRoute, useNavigation, RouteProp} from '@react-navigation/native';

import RestaurantListItem from '@/components/RestaurantListItem';
import {useSoloDeck} from '@/hooks/useRestaurants';
import {useFilterStore} from '@/stores/filterStore';
import {ExploreStackParamList} from '@/navigation/types';
import {COLORS} from '@/constants/theme';

type RouteProps = RouteProp<ExploreStackParamList, 'CategoryResults'>;

const CategoryResultsScreen = () => {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation();

  const priceLevel = useFilterStore(state => state.priceLevel);
  const minRating = useFilterStore(state => state.minRating);
  const radiusKm = useFilterStore(state => state.radiusKm);
  const openNow = useFilterStore(state => state.openNow);

  const {data: deck, isLoading} = useSoloDeck({
    category: route.params.category,
    priceLevel,
    minRating,
    radiusKm,
    openNow,
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button">
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{route.params.category}</Text>
        <Text style={styles.count}>{deck?.total ?? 0} restaurants</Text>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#FF6B6B" />
        </View>
      ) : (
        <FlatList
          data={deck?.restaurants ?? []}
          renderItem={({item}) => <RestaurantListItem restaurant={item} />}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                No restaurants found in this category
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: COLORS.background,
  },
  backText: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  count: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  list: {
    padding: 16,
    paddingBottom: 92,
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
  emptyText: {
    fontSize: 16,
    color: COLORS.textMuted,
  },
});

export default CategoryResultsScreen;
