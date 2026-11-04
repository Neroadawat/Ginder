const fs = require('fs');
const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const projectRoot = fs.realpathSync(__dirname);
const localModules = path.join(projectRoot, 'node_modules');
const realModules = fs.realpathSync(localModules);
const config =
  realModules === localModules
    ? {}
    : {
        watchFolders: [realModules],
        resolver: {nodeModulesPaths: [realModules]},
      };

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
