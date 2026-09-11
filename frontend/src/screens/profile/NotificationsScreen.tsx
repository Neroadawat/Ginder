import React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';

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
      Alert.alert('Invite unavailable', 'This invitation does not contain a valid session code.');
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
      onError: joinError => {
        if (/started|not found|invalid invite/i.test(joinError.message)) {
          markRead.mutate(item.id);
        }
        Alert.alert('Could not join', joinError.message);
      },
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Go back">
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Invitations</Text>
        <Text style={styles.subtitle}>
          Accept a friend's invitation to enter their lobby.
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
                    style={styles.rejectAction}
                    onPress={() => dismiss(item.id)}
                    accessibilityLabel="Dismiss invitation">
                    <Text style={styles.rejectText}>Decline</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.acceptAction}
                    disabled={joinSession.isPending}
                    onPress={() => accept(item)}
                    accessibilityLabel="Accept invitation">
                    <Text style={styles.acceptText}>{joinSession.isPending ? 'Joining…' : 'Accept'}</Text>
                  </TouchableOpacity>
                </View>
              )}
              {item.is_read && <Text style={styles.closed}>Closed</Text>}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No invitations</Text>
              <Text style={styles.emptyText}>New party invites will appear here.</Text>
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
  back: {fontSize: 14, color: COLORS.textMuted, marginBottom: 18},
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
  actions: {gap: 7, marginLeft: 8},
  rejectAction: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rejectText: {fontSize: 11, color: COLORS.textMuted, fontWeight: '700'},
  acceptAction: {borderRadius: 10, backgroundColor: COLORS.accent, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7},
  acceptText: {fontSize: 11, color: '#FFF', fontWeight: '800'},
  closed: {fontSize: 10, color: '#696464', marginLeft: 8},
  centered: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  empty: {paddingTop: 100, alignItems: 'center'},
  emptyTitle: {color: COLORS.text, fontSize: 18, fontWeight: '800'},
  emptyText: {color: COLORS.textMuted, fontSize: 14, marginTop: 7},
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
