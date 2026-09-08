/**
 * Sign Up Screen — Register with email, password, display name + terms consent.
 */

import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {useSignUp} from '@/hooks/useAuth';
import {useConsentStore} from '@/stores/consentStore';
import {AuthStackParamList} from '@/navigation/types';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'SignUp'>;

const SignUpScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const signUpMutation = useSignUp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [validationError, setValidationError] = useState('');

  // Terms were accepted on the consent screen, which gates this screen. The
  // flag is forwarded so the server has a record tied to the account
  // (requirement 2.4) rather than asking the same question twice.
  const hasConsented = useConsentStore(state => state.hasConsented);

  const handleSignUp = () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = displayName.trim();

    if (!normalizedName) {
      setValidationError('Please enter a display name.');
      return;
    }
    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setValidationError('Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setValidationError('Password must be at least 8 characters.');
      return;
    }
    if (password.length > 128) {
      setValidationError('Password must be no more than 128 characters.');
      return;
    }
    if (!hasConsented) {
      setValidationError(
        'You must accept the Terms of Service and Privacy Policy.',
      );
      return;
    }

    setValidationError('');
    signUpMutation.mutate({
      email: normalizedEmail,
      password,
      display_name: normalizedName,
      accepted_terms: hasConsented,
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Register</Text>
          <Text style={styles.subtitle}>Join Ginder and find great food</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Display Name"
            placeholderTextColor="#999"
            value={displayName}
            onChangeText={setDisplayName}
            accessibilityLabel="Display name input"
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Email input"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            accessibilityLabel="Password input"
          />

          <View style={styles.requirements}>
            <Text style={styles.requirementsTitle}>
              Registration requirements
            </Text>
            <Text style={styles.requirement}>• Display name is required</Text>
            <Text style={styles.requirement}>• Use a valid email address</Text>
            <Text style={styles.requirement}>
              • Password must be 8–128 characters
            </Text>
            <Text style={styles.requirement}>
              • Accept the Terms of Service and Privacy Policy
            </Text>
          </View>

          {(validationError || signUpMutation.isError) && (
            <Text style={styles.errorText}>
              {validationError ||
                signUpMutation.error?.message ||
                'Registration failed'}
            </Text>
          )}

          <TouchableOpacity
            style={styles.button}
            onPress={handleSignUp}
            disabled={signUpMutation.isPending}
            accessibilityRole="button"
            accessibilityLabel="Register">
            {signUpMutation.isPending ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>Register</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            accessibilityRole="button">
            <Text style={styles.footerLink}>Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  form: {
    gap: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#F9F9F9',
  },
  button: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  requirements: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FFF4F4',
    borderWidth: 1,
    borderColor: '#FFD4D4',
    gap: 5,
  },
  requirementsTitle: {
    color: '#333',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  requirement: {
    color: '#666',
    fontSize: 13,
    lineHeight: 18,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: {
    color: '#E53E3E',
    fontSize: 14,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  footerText: {
    color: '#666',
    fontSize: 14,
  },
  footerLink: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SignUpScreen;
