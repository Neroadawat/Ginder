import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import {setupBackgroundMessageHandler} from './src/services/fcm';

setupBackgroundMessageHandler();
AppRegistry.registerComponent(appName, () => App);
