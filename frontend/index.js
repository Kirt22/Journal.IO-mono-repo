/**
 * @format
 */

import { AppRegistry } from 'react-native';
import { enableFreeze, enableScreens } from 'react-native-screens';
import App from './App';
import { name as appName } from './app.json';

if (!global.nativeFabricUIManager) {
  enableScreens();
}
enableFreeze(true);

AppRegistry.registerComponent(appName, () => App);
