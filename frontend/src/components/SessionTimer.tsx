/**
 * SessionTimer — Countdown timer displayed during active session swiping.
 */

import React, {useEffect, useRef, useState} from 'react';
import {View, Text, StyleSheet} from 'react-native';

import {useSession} from '@/hooks/useSessions';
import {sessionSecondsRemaining} from '@/utils/sessionClock';

interface Props {
  sessionId: string;
  initialEndsAt?: string;
  onExpire?: () => void;
}

const SessionTimer = ({sessionId, initialEndsAt, onExpire}: Props) => {
  const expireCallback = useRef(onExpire);
  expireCallback.current = onExpire;
  const expiredSession = useRef<string | null>(null);
  const {data: lobby} = useSession(sessionId);
  const endsAt = initialEndsAt ?? lobby?.session.ends_at;
  const duration = lobby?.session.duration_seconds;
  const [remaining, setRemaining] = useState<number | null>(() =>
    endsAt && duration !== undefined
      ? sessionSecondsRemaining(endsAt, duration)
      : null,
  );

  useEffect(() => {
    if (!endsAt || duration === undefined) {
      return;
    }

    const update = () => {
      const next = sessionSecondsRemaining(endsAt, duration);
      setRemaining(next);
      if (next === 0 && expiredSession.current !== sessionId) {
        expiredSession.current = sessionId;
        expireCallback.current?.();
      }
      return next;
    };

    update();

    const interval = setInterval(() => {
      if (update() <= 0) {
        clearInterval(interval);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [endsAt, duration, sessionId]);

  if (remaining === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.timer}>--:--</Text>
      </View>
    );
  }

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const isLow = remaining <= 30;

  return (
    <View style={styles.container}>
      <Text style={[styles.timer, isLow && styles.timerLow]}>
        {minutes}:{seconds.toString().padStart(2, '0')}
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
