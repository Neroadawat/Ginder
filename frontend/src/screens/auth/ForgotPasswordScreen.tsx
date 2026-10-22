import {t, useTranslation} from '@/i18n';
/**
 * Forgot Password Screen — Enter email to receive reset link.
 */

import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';

import {useForgotPassword} from '@/hooks/useAuth';

const ForgotPasswordScreen = () => {
  useTranslation();
  const navigation = useNavigation();
  const forgotMutation = useForgotPassword();

  const [email, setEmail] = useState('');

  const handleSubmit = () => {
    forgotMutation.mutate({email: email.trim()});
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backButton}
        accessibilityRole="button"
        accessibilityLabel={t('Go back')}>
        <Text style={styles.backText}>{t('← กลับ')}</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{t('ลืมรหัสผ่าน')}</Text>
      <Text style={styles.subtitle}>
        {t('กรอกอีเมลของบัญชีเพื่อรับลิงก์ตั้งรหัสผ่านใหม่')}
      </Text>

      <TextInput
        style={styles.input}
        placeholder={t('อีเมล')}
        placeholderTextColor="#999"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        accessibilityLabel={t('Email input')}
      />

      {forgotMutation.isSuccess && (
        <Text style={styles.successText}>
          {t(
            'หากมีบัญชีนี้ เราจะส่งลิงก์ให้ทางอีเมล กรุณาตรวจกล่องจดหมายและจดหมายขยะ',
          )}
        </Text>
      )}
      {forgotMutation.isError && (
        <Text style={styles.errorText} accessibilityRole="alert">
          {t('ส่งคำขอไม่สำเร็จ กรุณาตรวจอีเมลและการเชื่อมต่อแล้วลองอีกครั้ง')}
        </Text>
      )}

      <TouchableOpacity
        style={styles.button}
        onPress={handleSubmit}
        disabled={forgotMutation.isPending || !email.trim()}
        accessibilityRole="button">
        {forgotMutation.isPending ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.buttonText}>{t('ส่งลิงก์ตั้งรหัสผ่าน')}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
    padding: 24,
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 24,
  },
  backText: {
    fontSize: 16,
    color: '#FF6B6B',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#F9F9F9',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: {color: '#B42318', marginBottom: 16},
  successText: {
    color: '#38A169',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
});

export default ForgotPasswordScreen;
