const {createMMKV} = require('react-native-mmkv');
const {t, dateLocale} = require('../index');
const {useLanguageStore} = require('../../stores/languageStore');
const {categoryLabel} = require('../../utils/category');
const {
  formatRadius,
  PRICE_LEVELS,
  SESSION_DURATION_OPTIONS,
} = require('../../constants/filters');

test('new installations default to English, not the phone locale', () => {
  createMMKV({id: 'ginder.preferences'}).remove('language');
  useLanguageStore.getState().hydrate();
  expect(useLanguageStore.getState().language).toBe('en');
  expect(t('ตั้งค่า')).toBe('Settings');
  expect(t('คนเดียว')).toBe('Solo');
  expect(dateLocale()).toBe('en-GB');
});

test('language selection is saved and restored without depending on authentication', () => {
  useLanguageStore.getState().setLanguage('th');
  useLanguageStore.setState({language: 'en'});
  useLanguageStore.getState().hydrate();
  expect(useLanguageStore.getState().language).toBe('th');
  expect(t('ตั้งค่า')).toBe('ตั้งค่า');
  expect(dateLocale()).toBe('th-TH');
});

test('invalid saved languages safely fall back to English', () => {
  createMMKV({id: 'ginder.preferences'}).set('language', 'unknown');
  useLanguageStore.getState().hydrate();
  expect(useLanguageStore.getState().language).toBe('en');
});

test('interpolation never translates names or changes an invite URL', () => {
  const key =
    'เข้าห้อง Ginder กับฉัน. รหัส: {p0}\nginder://session/join?code={p1}';
  expect(t(key, {p0: 'AB123456', p1: 'AB123456'})).toBe(
    'Join my Ginder room. Code: AB123456\nginder://session/join?code=AB123456',
  );
  expect(t('ร้านสมชาย')).toBe('ร้านสมชาย');
  expect(t('ภาพประกอบร้าน {p0}', {p0: 'ร้านสมชาย'})).toBe(
    'Restaurant image: ร้านสมชาย',
  );
});

test('labels are translated at render time, without changing filter API values', () => {
  expect(categoryLabel('Thai')).toBe('Thai');
  expect(categoryLabel('ทั้งหมด')).toBe('All');
  expect(t(PRICE_LEVELS[0].label)).toBe('Any');
  expect(t(SESSION_DURATION_OPTIONS[1].label)).toBe('3 min');
  expect(formatRadius(1.5)).toBe('1.5 km');
  useLanguageStore.getState().setLanguage('th');
  expect(categoryLabel('Thai')).toBe('อาหารไทย');
  expect(t(PRICE_LEVELS[0].label)).toBe('ไม่จำกัด');
  expect(t(SESSION_DURATION_OPTIONS[1].label)).toBe('3 นาที');
  expect(formatRadius(1.5)).toBe('1.5 กม.');
  expect(SESSION_DURATION_OPTIONS[1].value).toBe(180);
});

test('changing language can translate an already-displayed validation message', () => {
  const previous = t('กรุณากรอกอีเมล');
  useLanguageStore.getState().setLanguage('th');
  expect(t(previous)).toBe('กรุณากรอกอีเมล');
});

test('unknown keys cannot resolve Object prototype properties', () => {
  expect(t('constructor')).toBe('constructor');
  expect(t('__proto__')).toBe('__proto__');
  expect(t('toString')).toBe('toString');
});
