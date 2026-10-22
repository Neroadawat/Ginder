const React = require('react');
const {Text, TextInput} = require('react-native');
const {act, create} = require('react-test-renderer');
const {useLanguageStore} = require('../../stores/languageStore');
const {t, useTranslation} = require('../../i18n');
const LanguageSwitcher = require('../LanguageSwitcher').default;

const Screen = () => {
  useTranslation();
  const [name, setName] = React.useState('My name');
  return (
    <>
      <Text testID="heading">{t('ตั้งค่า')}</Text>
      <TextInput testID="name" value={name} onChangeText={setName} />
      <LanguageSwitcher />
    </>
  );
};

test('English is selected initially; changing language updates labels without remounting the form', () => {
  let tree;
  act(() => {
    tree = create(<Screen />);
  });
  expect(tree.root.findByProps({testID: 'heading'}).props.children).toBe(
    'Settings',
  );
  expect(
    tree.root.findByProps({testID: 'language-en'}).props.accessibilityState
      .selected,
  ).toBe(true);
  act(() =>
    tree.root.findByProps({testID: 'name'}).props.onChangeText('ชื่อของฉัน'),
  );
  act(() => tree.root.findByProps({testID: 'language-th'}).props.onPress());
  expect(useLanguageStore.getState().language).toBe('th');
  expect(tree.root.findByProps({testID: 'heading'}).props.children).toBe(
    'ตั้งค่า',
  );
  expect(tree.root.findByProps({testID: 'name'}).props.value).toBe(
    'ชื่อของฉัน',
  );
  expect(
    tree.root.findByProps({testID: 'language-th'}).props.accessibilityState
      .selected,
  ).toBe(true);
  act(() => tree.root.findByProps({testID: 'language-en'}).props.onPress());
  expect(tree.root.findByProps({testID: 'heading'}).props.children).toBe(
    'Settings',
  );
  act(() => tree.unmount());
});
