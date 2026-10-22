import {t, useTranslation} from '@/i18n';
/**
 * Reset Password Screen — Enter new password with reset token.
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
import {useRoute} from '@react-navigation/native';
import {RouteProp} from '@react-navigation/native';

import {useResetPassword} from '@/hooks/useAuth';
import {AuthStackParamList} from '@/navigation/types';

type ResetPasswordRouteProp = RouteProp<AuthStackParamList, 'ResetPassword'>;

const ResetPasswordScreen = () => {
  useTranslation();
  const route = useRoute<ResetPasswordRouteProp>();
  const resetMutation = useResetPassword();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState('');

  const handleReset = () => {
    if (newPassword.length < 8 || newPassword !== confirmPassword) {
      setValidationError(
        newPassword.length < 8
          ? t('ใช้รหัสผ่านอย่างน้อย 8 ตัวอักษร')
          : t('รหัสผ่านทั้งสองช่องไม่ตรงกัน'),
      );
      return;
    }
    setValidationError('');
    resetMutation.mutate({
      token: route.params.token,
      new_password: newPassword,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('ตั้งรหัสผ่านใหม่')}</Text>
      <Text style={styles.subtitle}>
        {t('กรอกรหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร')}
      </Text>

      <TextInput
        style={styles.input}
        placeholder={t('รหัสผ่านใหม่')}
        placeholderTextColor="#999"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        accessibilityLabel={t('New password input')}
      />
      <TextInput
        style={styles.input}
        placeholder={t('ยืนยันรหัสผ่าน')}
        placeholderTextColor="#999"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        accessibilityLabel={t('Confirm password input')}
      />

      {resetMutation.isSuccess && (
        <Text style={styles.successText}>
          {t('ตั้งรหัสผ่านสำเร็จ กลับไปเข้าสู่ระบบได้เลย')}
        </Text>
      )}
      {(validationError || resetMutation.isError) && (
        <Text style={styles.errorText} accessibilityRole="alert">
          {t(
            validationError ||
              'ตั้งรหัสผ่านไม่สำเร็จ กรุณาขอลิงก์ใหม่หรือลองอีกครั้ง',
          )}
        </Text>
      )}

      <TouchableOpacity
        style={styles.button}
        onPress={handleReset}
        disabled={resetMutation.isPending || resetMutation.isSuccess}
        accessibilityRole="button">
        {resetMutation.isPending ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.buttonText}>{t('บันทึกรหัสผ่านใหม่')}</Text>
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

export default ResetPasswordScreen;
