import React, {useEffect} from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {COLORS} from '@/constants/theme';
import {useJoinSession} from '@/hooks/useSessions';
import {SessionStackParamList} from '@/navigation/types';

type Route = RouteProp<SessionStackParamList, 'JoinSession'>;
type Navigation = NativeStackNavigationProp<
  SessionStackParamList,
  'JoinSession'
>;

const JoinSessionScreen = () => {
  const {params} = useRoute<Route>();
  const navigation = useNavigation<Navigation>();
  const join = useJoinSession();

  useEffect(() => {
    if (!params.code || join.isPending || join.isSuccess) {
      return;
    }
    join.mutate(params.code, {
      onSuccess: lobby =>
        navigation.replace('Lobby', {sessionId: lobby.session.id}),
    });
  }, [join, navigation, params.code]);

  return (
    <View style={styles.container}>
      {join.isError ? (
        <>
          <Text style={styles.title}>Unable to join</Text>
          <Text style={styles.message}>{join.error.message}</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.getParent()?.goBack()}>
            <Text style={styles.buttonText}>Back to home</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.message}>Joining your friends…</Text>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  title: {fontSize: 26, color: COLORS.text, fontWeight: '800'},
  message: {
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 14,
  },
  button: {
    borderWidth: 1,
    borderColor: '#FFF',
    borderRadius: 22,
    paddingHorizontal: 28,
    paddingVertical: 11,
    marginTop: 26,
  },
  buttonText: {color: '#FFF', fontWeight: '700'},
});

export default JoinSessionScreen;
