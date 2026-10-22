const {formatDistance} = require('../distance');
const {useLanguageStore} = require('../../stores/languageStore');

describe('formatDistance', () => {
  it('uses metres below one kilometre', () => {
    expect(formatDistance(0.45)).toBe('450 m');
    expect(formatDistance(0.004)).toBe('4 m');
  });

  it('uses a compact kilometre value from one kilometre', () => {
    expect(formatDistance(1)).toBe('1 km');
    expect(formatDistance(1.38)).toBe('1.4 km');
  });
  it('uses Thai distance units when selected', () => {
    useLanguageStore.getState().setLanguage('th');
    expect(formatDistance(0.45)).toBe('450 ม.');
    expect(formatDistance(1.38)).toBe('1.4 กม.');
  });
});
