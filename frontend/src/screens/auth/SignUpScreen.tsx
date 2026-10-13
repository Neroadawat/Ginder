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
      setValidationError('กรุณากรอกชื่อที่แสดง');
      return;
    }
    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setValidationError('กรุณากรอกอีเมลให้ถูกต้อง');
      return;
    }
    if (password.length < 8) {
      setValidationError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
      return;
    }
    if (password.length > 128) {
      setValidationError('รหัสผ่านต้องไม่เกิน 128 ตัวอักษร');
      return;
    }
    if (!hasConsented) {
      setValidationError(
        'กรุณายอมรับข้อกำหนดการใช้งานและนโยบายความเป็นส่วนตัว',
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
          <Text style={styles.title}>สมัครสมาชิก</Text>
          <Text style={styles.subtitle}>เริ่มหาร้านที่อยากกินกับ Ginder</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="ชื่อที่แสดง"
            placeholderTextColor="#999"
            value={displayName}
            onChangeText={setDisplayName}
            accessibilityLabel="ช่องกรอกชื่อที่แสดง"
          />
          <TextInput
            style={styles.input}
            placeholder="อีเมล"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="ช่องกรอกอีเมล"
          />
          <TextInput
            style={styles.input}
            placeholder="รหัสผ่าน"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            accessibilityLabel="ช่องกรอกรหัสผ่าน"
          />

          <View style={styles.requirements}>
            <Text style={styles.requirementsTitle}>
              ข้อมูลสำหรับสมัครสมาชิก
            </Text>
            <Text style={styles.requirement}>• กรอกชื่อที่แสดง</Text>
            <Text style={styles.requirement}>• ใช้อีเมลที่รับจดหมายได้</Text>
            <Text style={styles.requirement}>• รหัสผ่าน 8–128 ตัวอักษร</Text>
            <Text style={styles.requirement}>
              • ยอมรับข้อกำหนดและนโยบายความเป็นส่วนตัว
            </Text>
          </View>

          {(validationError || signUpMutation.isError) && (
            <Text style={styles.errorText}>
              {validationError ||
                signUpMutation.error?.message ||
                'สมัครสมาชิกไม่สำเร็จ'}
            </Text>
          )}

          <TouchableOpacity
            style={styles.button}
            onPress={handleSignUp}
            disabled={signUpMutation.isPending}
            accessibilityRole="button"
            accessibilityLabel="สมัครสมาชิก">
            {signUpMutation.isPending ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>สมัครสมาชิก</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>มีบัญชีแล้ว? </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            accessibilityRole="button">
            <Text style={styles.footerLink}>เข้าสู่ระบบ</Text>
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
