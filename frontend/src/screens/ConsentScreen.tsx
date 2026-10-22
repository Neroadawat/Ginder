import {t, useTranslation} from '@/i18n';
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
  Linking,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {useConsentStore} from '@/stores/consentStore';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import {PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL} from '@/services/config';

const DATA_POINTS = [
  {
    title: 'ตำแหน่งของคุณ',
    body: 'ใช้ค้นหาร้านใกล้คุณและเป็นจุดอ้างอิงของห้อง ไม่ติดตามตำแหน่งในเบื้องหลัง',
  },
  {
    title: 'อีเมลและชื่อที่แสดง',
    body: 'ใช้เข้าสู่ระบบ รับอีเมลตั้งรหัสผ่าน และแสดงชื่อให้เพื่อนในห้อง',
  },
  {
    title: 'การปัดและประวัติร้านที่เลือก',
    body: 'เก็บเพื่อให้กลับมาดูร้านที่ถูกใจและผลห้องที่ผ่านมาได้',
  },
];

const ConsentScreen = () => {
  useTranslation();
  const accept = useConsentStore(state => state.accept);
  const [agreed, setAgreed] = useState(false);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.logo}>Ginder</Text>
        <LanguageSwitcher />
        <Text style={styles.title}>{t('ก่อนเริ่มใช้งาน')}</Text>
        <Text style={styles.intro}>
          {t(
            'Ginder ใช้ข้อมูลต่อไปนี้เพื่อให้บริการ คุณลบบัญชีและ ข้อมูลส่วนบุคคลได้จากการตั้งค่า',
          )}
        </Text>

        {DATA_POINTS.map(point => (
          <View key={point.title} style={styles.point}>
            <View style={styles.pointText}>
              <Text style={styles.pointTitle}>{t(point.title)}</Text>
              <Text style={styles.pointBody}>{t(point.body)}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.legal}>{t('อ่านรายละเอียดก่อนดำเนินการต่อ:')}</Text>
        <View style={styles.legalLinks}>
          <TouchableOpacity
            onPress={() => Linking.openURL(TERMS_OF_SERVICE_URL)}
            accessibilityRole="link">
            <Text style={styles.legalLink}>{t('ข้อกำหนดการใช้งาน')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
            accessibilityRole="link">
            <Text style={styles.legalLink}>{t('ความเป็นส่วนตัว')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.agreeRow}>
          <Switch
            value={agreed}
            onValueChange={setAgreed}
            trackColor={{false: '#DDD', true: '#FF6B6B'}}
            thumbColor="#FFF"
            accessibilityLabel={t(
              'Agree to the Terms of Service and Privacy Policy',
            )}
          />
          <Text style={styles.agreeText}>
            {t('ฉันยอมรับข้อกำหนดและนโยบายความเป็นส่วนตัว')}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, !agreed && styles.buttonDisabled]}
          onPress={accept}
          disabled={!agreed}
          accessibilityRole="button"
          accessibilityLabel={t('Continue')}
          accessibilityState={{disabled: !agreed}}>
          <Text style={styles.buttonText}>{t('ดำเนินการต่อ')}</Text>
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
  legalLinks: {
    flexDirection: 'row',
    gap: 18,
    marginTop: 8,
  },
  legalLink: {
    color: '#D94747',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
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
