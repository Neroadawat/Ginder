import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';

import AppIcon from '@/components/AppIcon';
import {COLORS} from '@/constants/theme';
import {useNotifications, useMarkAsRead} from '@/hooks/useNotifications';
import {useJoinSession} from '@/hooks/useSessions';
import {NotificationItem} from '@/types/api';

const NotificationsScreen = () => {
  const navigation = useNavigation<any>();
  const {data, isLoading} = useNotifications();
  const markRead = useMarkAsRead();
  const joinSession = useJoinSession();

  const dismiss = (id: string) => markRead.mutate(id);
  const accept = (item: NotificationItem) => {
    let inviteCode: string | undefined;
    try {
      inviteCode = item.data ? JSON.parse(item.data).invite_code : undefined;
    } catch {
      inviteCode = undefined;
    }
    if (!inviteCode) {
      return;
    }
    joinSession.mutate(inviteCode, {
      onSuccess: lobby => {
        markRead.mutate(item.id);
        navigation.navigate('Session', {
          screen: 'Lobby',
          params: {sessionId: lobby.session.id},
        });
      },
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Notice</Text>
        <Text style={styles.subtitle}>
          all your activities log will show here
        </Text>
      </View>
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      ) : (
        <FlatList
          data={data?.notifications ?? []}
          contentContainerStyle={styles.list}
          keyExtractor={item => item.id}
          renderItem={({item}) => (
            <View style={[styles.item, !item.is_read && styles.unread]}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.title.slice(0, 1)}</Text>
              </View>
              <View style={styles.copy}>
                <Text style={styles.itemTitle}>{item.body}</Text>
                <Text style={styles.date}>
                  {formatRelativeTime(item.created_at)}
                </Text>
              </View>
              {!item.is_read && (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.action}
                    onPress={() => dismiss(item.id)}
                    accessibilityLabel="Dismiss invitation">
                    <AppIcon name="close" size={18} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.action}
                    onPress={() => accept(item)}
                    accessibilityLabel="Accept invitation">
                    <Text style={styles.check}>✓</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No activities yet</Text>
            </View>
          }
        />
      )}
      {data && data.unread_count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{data.unread_count}</Text>
        </View>
      )}
    </View>
  );
};

function formatRelativeTime(value: string): string {
  const minutes = Math.max(
    1,
    Math.floor((Date.now() - new Date(value).getTime()) / 60000),
  );
  if (minutes < 60) {
    return `${minutes} minutes ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hours ago`;
  }
  return new Date(value).toLocaleDateString();
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  header: {paddingHorizontal: 13, paddingTop: 60, paddingBottom: 10},
  title: {fontSize: 26, fontWeight: '800', color: COLORS.text},
  subtitle: {fontSize: 13, color: '#EEE', marginTop: 14},
  list: {
    backgroundColor: '#121111',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 14,
    paddingTop: 34,
    paddingBottom: 100,
    minHeight: '100%',
  },
  item: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    paddingVertical: 12,
  },
  unread: {backgroundColor: 'rgba(255,255,255,0.015)'},
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#393333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {color: '#FFF', fontSize: 17, fontWeight: '800'},
  copy: {flex: 1},
  itemTitle: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  date: {color: '#8E8989', fontSize: 12, marginTop: 8},
  actions: {flexDirection: 'row', gap: 8, marginLeft: 8},
  action: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {fontSize: 17, color: '#FFF'},
  centered: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  empty: {paddingTop: 100, alignItems: 'center'},
  emptyText: {color: COLORS.textMuted, fontSize: 15},
  badge: {
    position: 'absolute',
    right: 102,
    bottom: 62,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E31C25',
  },
  badgeText: {fontSize: 0},
});

export default NotificationsScreen;
