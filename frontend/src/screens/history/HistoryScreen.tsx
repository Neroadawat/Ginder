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
import {COLORS} from '@/constants/theme';

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
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <Text style={styles.subtitle}>Restaurants from your past matches</Text>
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
                {RESOLUTION_LABELS_SHORT[item.resolution_type] ??
                  item.resolution_type}
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
            <Text style={styles.emptyText}>No history yet</Text>
            <Text style={styles.emptyHint}>
              Your matched restaurants will appear here.
            </Text>
          </View>
        }
      />
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
    paddingTop: 64,
    paddingBottom: 14,
    backgroundColor: COLORS.background,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 8,
  },
  list: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 90,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  restaurantName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  resolution: {
    fontSize: 12,
    color: COLORS.accent,
    fontWeight: '500',
  },
  date: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  mapsButton: {
    marginTop: 12,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  mapsText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
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
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  emptyHint: {
    marginTop: 10,
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});

export default HistoryScreen;
