/**
 * History Screen — View past match results.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';

import {useHistory} from '@/hooks/useHistory';
import {RESOLUTION_LABELS_SHORT} from '@/constants/resolution';

const HistoryScreen = () => {
  const {data, isLoading} = useHistory();

  const openMaps = (url: string | null) => {
    if (url) {
      Linking.openURL(url);
    }
  };

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
        <Text style={styles.title}>📋 History</Text>
        <Text style={styles.subtitle}>{data?.total ?? 0} past sessions</Text>
      </View>

      <FlatList
        data={data?.history ?? []}
        renderItem={({item}) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.restaurantName} numberOfLines={1}>
                {item.restaurant_name}
              </Text>
              <Text style={styles.resolution}>
                {RESOLUTION_LABELS_SHORT[item.resolution_type] ?? item.resolution_type}
              </Text>
            </View>
            <Text style={styles.date}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
            {item.google_maps_url && (
              <TouchableOpacity
                style={styles.mapsButton}
                onPress={() => openMaps(item.google_maps_url)}
                accessibilityRole="button"
                accessibilityLabel={`Navigate to ${item.restaurant_name}`}>
                <Text style={styles.mapsText}>📍 Open in Maps</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        keyExtractor={item => item.session_id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyText}>No history yet</Text>
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
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  restaurantName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  resolution: {
    fontSize: 12,
    color: '#FF6B6B',
    fontWeight: '500',
  },
  date: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  mapsButton: {
    marginTop: 12,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  mapsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
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

export default HistoryScreen;
