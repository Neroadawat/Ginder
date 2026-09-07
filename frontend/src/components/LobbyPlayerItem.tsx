/**
 * LobbyPlayerItem — Shows a participant in the session lobby.
 * Host can kick players before session starts.
 */

import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';

import {ParticipantResponse} from '@/types/api';

interface Props {
  participant: ParticipantResponse;
  isHost: boolean;
  isCurrentUser: boolean;
  onKick: () => void;
}

const LobbyPlayerItem = ({participant, isHost, isCurrentUser, onKick}: Props) => {
  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {participant.display_name.charAt(0).toUpperCase()}
        </Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.name}>
          {participant.display_name}
          {isCurrentUser && <Text style={styles.youTag}> (You)</Text>}
        </Text>
        <Text style={styles.status}>{participant.status}</Text>
      </View>

      {isHost && !isCurrentUser && (
        <TouchableOpacity
          style={styles.kickButton}
          onPress={onKick}
          accessibilityRole="button"
          accessibilityLabel={`Kick ${participant.display_name}`}>
          <Text style={styles.kickText}>Kick</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  youTag: {
    fontSize: 14,
    color: '#999',
    fontWeight: '400',
  },
  status: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  kickButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E53E3E',
  },
  kickText: {
    fontSize: 14,
    color: '#E53E3E',
    fontWeight: '600',
  },
});

export default LobbyPlayerItem;
