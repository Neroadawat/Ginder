import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {t, useTranslation} from '@/i18n';
import {Language, useLanguageStore} from '@/stores/languageStore';

const OPTIONS: {value: Language; label: string}[] = [
  {value: 'en', label: 'English'},
  {value: 'th', label: 'ไทย'},
];

export default function LanguageSwitcher() {
  const {language} = useTranslation();
  const setLanguage = useLanguageStore(state => state.setLanguage);
  return (
    <View style={styles.container} accessibilityLabel={t('Language')}>
      {OPTIONS.map(option => (
        <TouchableOpacity
          key={option.value}
          testID={`language-${option.value}`}
          accessibilityRole="button"
          accessibilityLabel={option.label}
          accessibilityState={{selected: language === option.value}}
          onPress={() => setLanguage(option.value)}
          style={[styles.option, language === option.value && styles.selected]}>
          <Text
            style={[
              styles.label,
              language === option.value && styles.selectedLabel,
            ]}>
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: '#E7E3E3',
    borderRadius: 22,
    padding: 4,
    marginVertical: 12,
  },
  option: {
    paddingHorizontal: 18,
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 18,
  },
  selected: {backgroundColor: '#C92F3E'},
  label: {fontSize: 14, fontWeight: '600', color: '#333'},
  selectedLabel: {color: '#FFF'},
});
