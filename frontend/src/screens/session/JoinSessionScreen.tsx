import React, {useEffect, useState} from 'react';
import {ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View} from 'react-native';
import {RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {COLORS} from '@/constants/theme';
import {useJoinSession} from '@/hooks/useSessions';
import {SessionStackParamList} from '@/navigation/types';

type Route = RouteProp<SessionStackParamList, 'JoinSession'>;
type Navigation = NativeStackNavigationProp<SessionStackParamList, 'JoinSession'>;

const JoinSessionScreen = () => {
  const {params} = useRoute<Route>();
  const navigation = useNavigation<Navigation>();
  const join = useJoinSession();
  const [code, setCode] = useState(params?.code?.trim() ?? '');

  useEffect(() => {
    if (params?.code) {
      setCode(params.code.trim());
    }
  }, [params?.code]);

  const submit = () => {
    const cleanCode = code.trim();
    if (!cleanCode || join.isPending) {
      return;
    }
    join.mutate(cleanCode, {
      onSuccess: lobby => navigation.replace('Lobby', {sessionId: lobby.session.id}),
    });
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
        <Text style={styles.backText}>‹</Text>
      </TouchableOpacity>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>PLAY TOGETHER</Text>
        <Text style={styles.title}>Join a session</Text>
        <Text style={styles.message}>Paste the invite code a friend sent you. Opening their Ginder link fills it automatically.</Text>
        <TextInput
          value={code}
          onChangeText={value => {
            setCode(value.toUpperCase().replace(/\s/g, ''));
            if (join.isError) {
              join.reset();
            }
          }}
          style={styles.input}
          placeholder="INVITE CODE"
          placeholderTextColor="#6F6969"
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={submit}
          accessibilityLabel="Session invite code"
        />
        {join.isError && <Text style={styles.error}>{join.error.message}</Text>}
        <TouchableOpacity
          style={[styles.button, (!code.trim() || join.isPending) && styles.disabled]}
          disabled={!code.trim() || join.isPending}
          onPress={submit}>
          {join.isPending ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Join session</Text>}
        </TouchableOpacity>
        <Text style={styles.hint}>Joining automatically adds the host to your friends list.</Text>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  back: {position: 'absolute', top: 48, left: 18, zIndex: 2, padding: 8},
  backText: {fontSize: 42, lineHeight: 42, color: COLORS.text},
  content: {flex: 1, justifyContent: 'center', paddingHorizontal: 28},
  eyebrow: {color: COLORS.accent, fontSize: 12, fontWeight: '800', letterSpacing: 2},
  title: {fontSize: 34, color: COLORS.text, fontWeight: '900', marginTop: 8},
  message: {fontSize: 15, lineHeight: 22, color: COLORS.textMuted, marginTop: 12},
  input: {height: 58, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, color: COLORS.text, fontSize: 20, fontWeight: '800', letterSpacing: 3, textAlign: 'center', marginTop: 28},
  error: {color: '#FF7777', fontSize: 13, lineHeight: 18, marginTop: 10},
  button: {height: 54, borderRadius: 16, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center', marginTop: 16},
  disabled: {opacity: 0.45},
  buttonText: {fontSize: 16, color: '#FFF', fontWeight: '800'},
  hint: {fontSize: 12, color: '#777', textAlign: 'center', marginTop: 16},
});

export default JoinSessionScreen;
