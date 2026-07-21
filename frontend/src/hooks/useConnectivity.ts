import { useSyncExternalStore } from 'react';
import {
  getConnectivitySnapshot,
  subscribeToConnectivity,
} from '../services/connectivityService';

const useConnectivity = () =>
  useSyncExternalStore(
    subscribeToConnectivity,
    getConnectivitySnapshot,
    getConnectivitySnapshot,
  );

export { useConnectivity };
