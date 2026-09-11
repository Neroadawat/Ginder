/**
 * SessionTimer — Countdown timer displayed during active session swiping.
 */

import React, {useEffect, useState} from 'react';
import {View, Text, StyleSheet} from 'react-native';

import {useSession} from '@/hooks/useSessions';

interface Props {
  sessionId: string;
  initialEndsAt?: string;
}

const secondsUntil = (value?: string | null) =>
  value ? Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 1000)) : null;

const SessionTimer = ({sessionId, initialEndsAt}: Props) => {
  const {data: lobby} = useSession(sessionId);
  const endsAt = initialEndsAt ?? lobby?.session.ends_at;
  const [remaining, setRemaining] = useState<number | null>(() =>
    secondsUntil(initialEndsAt),
  );

  useEffect(() => {
    if (!endsAt) {
      return;
    }

    const update = () => {
      const next = secondsUntil(endsAt) ?? 0;
      setRemaining(next);
      return next;
    };

    update();

    const interval = setInterval(() => {
      if (update() <= 0) {
        clearInterval(interval);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [endsAt]);

  if (remaining === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.timer}>⏱️ --:--</Text>
      </View>
    );
  }

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
