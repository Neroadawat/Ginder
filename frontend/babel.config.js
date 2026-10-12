const fs = require('fs');
const path = require('path');

const projectRoot = fs.realpathSync(__dirname);

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    'react-native-worklets/plugin',
    [
      'module-resolver',
      {
        root: ['.'],
        extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
        alias: {
          '@': path.join(projectRoot, 'src'),
        },
      },
    ],
  ],
};
