/**
 * @format
 */

import { Alert } from 'react-native';
import { bootstrapDemoMode, installDemoRequestAdapter } from './src/demo/bootstrap';

// Order matters. Native calls runApplication the moment this file finishes
// executing, so `./index` — which is what calls AppRegistry.registerComponent —
// has to be required synchronously; awaiting the bootstrap first left a race the
// app lost often enough to fail a launch with "JournalFrontend has not been
// registered". The request adapter is claimed first so no screen can reach the
// real backend in the gap, and the remaining setup (runtime policies, dev menu)
// finishes on the next tick.
try {
  installDemoRequestAdapter();
  require('./index');
} catch (error) {
  Alert.alert(
    'Demo Mode could not start',
    error instanceof Error ? error.message : 'Unknown bootstrap failure.',
  );
}

bootstrapDemoMode().catch(error => {
  Alert.alert(
    'Demo Mode could not start',
    error instanceof Error ? error.message : 'Unknown bootstrap failure.',
  );
});
