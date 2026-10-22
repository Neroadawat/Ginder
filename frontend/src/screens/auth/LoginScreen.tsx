import {t, useTranslation} from '@/i18n';
/**
 * Login Screen — Email & Password authentication.
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

import {useLogin} from '@/hooks/useAuth';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import {AuthStackParamList} from '@/navigation/types';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

const LoginScreen = () => {
  useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const loginMutation = useLogin();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState('');

  const handleLogin = () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setValidationError(t('กรุณากรอกอีเมล'));
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setValidationError(t('กรุณากรอกอีเมลให้ถูกต้อง'));
      return;
    }
    if (!password) {
      setValidationError(t('กรุณากรอกรหัสผ่าน'));
      return;
    }

    setValidationError('');
    loginMutation.mutate({email: normalizedEmail, password});
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>Ginder</Text>
          <Text style={styles.subtitle}>{t('หาร้านมื้อต่อไปด้วยกัน')}</Text>
        </View>

        <LanguageSwitcher />
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder={t('อีเมล')}
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel={t('Email input')}
          />
          <TextInput
            style={styles.input}
            placeholder={t('รหัสผ่าน')}
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            accessibilityLabel={t('Password input')}
          />

          {(validationError || loginMutation.isError) && (
            <Text style={styles.errorText}>
              {t(
                validationError ||
                  loginMutation.error?.message ||
                  'เข้าสู่ระบบไม่สำเร็จ',
              )}
            </Text>
          )}

          <TouchableOpacity
            style={styles.button}
            onPress={handleLogin}
            disabled={loginMutation.isPending}
            accessibilityRole="button"
            accessibilityLabel={t('Login')}>
            {loginMutation.isPending ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>{t('เข้าสู่ระบบ')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('ForgotPassword')}
            accessibilityRole="button">
            <Text style={styles.linkText}>{t('ลืมรหัสผ่าน?')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('ยังไม่มีบัญชี? ')}</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('SignUp')}
            accessibilityRole="button">
            <Text style={styles.footerLink}>{t('สมัครสมาชิก')}</Text>
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
    marginBottom: 48,
  },
  logo: {
    fontSize: 40,
    fontWeight: '700',
    color: '#FF6B6B',
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
  buttonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  linkText: {
    color: '#FF6B6B',
    textAlign: 'center',
    fontSize: 14,
    marginTop: 8,
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

export default LoginScreen;
