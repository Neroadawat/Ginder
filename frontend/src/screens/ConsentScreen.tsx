/**
 * Consent Screen — Terms of Service and Privacy Policy.
 *
 * Requirement 2: shown before any other screen on first launch, and the user
 * cannot reach Login, Sign Up or anything else until they accept. It comes
 * before the location prompt on purpose: the Privacy Policy is the document
 * that explains why the app needs their location, so asking first would be
 * backwards.
 */

import React, {useState} from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {useConsentStore} from '@/stores/consentStore';

const DATA_POINTS = [
  {
    icon: '📍',
    title: 'Your location',
    body: 'Used to find restaurants near you and to centre a group session. Never shared with other users as a precise position.',
  },
  {
    icon: '📧',
    title: 'Your email and display name',
    body: 'Used to sign you in and to show who you are to friends you invite.',
  },
  {
    icon: '❤️',
    title: 'Your swipes and match history',
    body: 'Stored so you can revisit places you liked and past group results.',
  },
];

const ConsentScreen = () => {
  const accept = useConsentStore(state => state.accept);
  const [agreed, setAgreed] = useState(false);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.logo}>🍽️ Ginder</Text>
        <Text style={styles.title}>Before you start</Text>
        <Text style={styles.intro}>
          Here is what Ginder collects and why. You can delete your account and
          all of this data at any time from Settings.
        </Text>

        {DATA_POINTS.map(point => (
          <View key={point.title} style={styles.point}>
            <Text style={styles.pointIcon}>{point.icon}</Text>
            <View style={styles.pointText}>
              <Text style={styles.pointTitle}>{point.title}</Text>
              <Text style={styles.pointBody}>{point.body}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.legal}>
          By continuing you agree to the Terms of Service and acknowledge the
          Privacy Policy.
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.agreeRow}>
          <Switch
            value={agreed}
            onValueChange={setAgreed}
            trackColor={{false: '#DDD', true: '#FF6B6B'}}
            thumbColor="#FFF"
            accessibilityLabel="Agree to the Terms of Service and Privacy Policy"
          />
          <Text style={styles.agreeText}>
            I agree to the Terms of Service and Privacy Policy
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, !agreed && styles.buttonDisabled]}
          onPress={accept}
          disabled={!agreed}
          accessibilityRole="button"
          accessibilityLabel="Continue"
          accessibilityState={{disabled: !agreed}}>
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  content: {
    padding: 24,
    paddingTop: 72,
  },
  logo: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FF6B6B',
    textAlign: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginTop: 28,
  },
  intro: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 24,
  },
  point: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  pointIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  pointText: {
    flex: 1,
  },
  pointTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  pointBody: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  legal: {
    fontSize: 13,
    color: '#999',
    lineHeight: 19,
    marginTop: 8,
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    gap: 16,
  },
  agreeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  agreeText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  button: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#CCC',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '600',
  },
});

export default ConsentScreen;
