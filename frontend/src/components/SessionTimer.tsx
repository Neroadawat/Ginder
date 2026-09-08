/**
 * SessionTimer — Countdown timer displayed during active session swiping.
 */

import React, {useEffect, useState} from 'react';
import {View, Text, StyleSheet} from 'react-native';

import {useSession} from '@/hooks/useSessions';

interface Props {
  sessionId: string;
}

const SessionTimer = ({sessionId}: Props) => {
  const {data: lobby} = useSession(sessionId);
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    if (!lobby?.session.ends_at) {
      return;
    }

    const endsAt = new Date(lobby.session.ends_at).getTime();

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((endsAt - now) / 1000));
      setRemaining(diff);

      if (diff <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lobby?.session.ends_at]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const isLow = remaining <= 30;

  return (
    <View style={styles.container}>
      <Text style={[styles.timer, isLow && styles.timerLow]}>
        ⏱️ {minutes}:{seconds.toString().padStart(2, '0')}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 60,
    paddingBottom: 12,
    alignItems: 'center',
    backgroundColor: '#080808',
  },
  timer: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
  },
  timerLow: {
    color: '#E53E3E',
  },
});

export default SessionTimer;
