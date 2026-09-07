/**
 * Notifications Screen — Session invites and other notifications.
 */

import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator} from 'react-native';
import {useNavigation} from '@react-navigation/native';

import {useNotifications, useMarkAsRead} from '@/hooks/useNotifications';

const NotificationsScreen = () => {
  const navigation = useNavigation();
  const {data, isLoading} = useNotifications();
  const markReadMutation = useMarkAsRead();

  const handlePress = (notificationId: string) => {
    markReadMutation.mutate(notificationId);
    // TODO: Navigate to session if it's a session invite
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button">
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🔔 Notifications</Text>
        {data && data.unread_count > 0 && (
          <Text style={styles.unreadBadge}>{data.unread_count} unread</Text>
        )}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#FF6B6B" />
        </View>
      ) : (
        <FlatList
          data={data?.notifications ?? []}
          renderItem={({item}) => (
            <TouchableOpacity
              style={[styles.notifItem, !item.is_read && styles.notifUnread]}
              onPress={() => handlePress(item.id)}
              accessibilityRole="button">
              <Text style={styles.notifTitle}>{item.title}</Text>
              <Text style={styles.notifBody}>{item.body}</Text>
              <Text style={styles.notifDate}>
                {new Date(item.created_at).toLocaleString()}
              </Text>
            </TouchableOpacity>
          )}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No notifications</Text>
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
    backgroundColor: '#F5F5F5',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#FFF',
  },
  backText: {
    fontSize: 16,
    color: '#FF6B6B',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  unreadBadge: {
    fontSize: 14,
    color: '#FF6B6B',
    fontWeight: '600',
    marginTop: 4,
  },
  list: {
    padding: 16,
  },
  notifItem: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  notifUnread: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B6B',
  },
  notifTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  notifBody: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  notifDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
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
    color: '#999',
  },
});

export default NotificationsScreen;
