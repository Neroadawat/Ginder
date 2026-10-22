jest.mock('react-native-mmkv', () => {
  const stores = new Map();
  return {
    createMMKV: ({id = 'default'} = {}) => {
      if (!stores.has(id)) stores.set(id, new Map());
      const values = stores.get(id);
      return {
        set: (key, value) => values.set(key, value),
        getString: key => values.get(key),
        remove: key => values.delete(key),
      };
    },
  };
});

beforeEach(() => {
  require('./src/stores/languageStore')
    .useLanguageStore.getState()
    .setLanguage('en');
});
