/**
 * @format
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Keychain from 'react-native-keychain';
import {
  authenticateBiometricLock,
  disableBiometricLock,
  enableBiometricLock,
  getBiometricLockAvailability,
} from '../src/services/biometricLockService';

const testPlatform = Platform as typeof Platform & { OS: string };
const originalOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(testPlatform, 'OS', {
    configurable: true,
    value: 'ios',
  });

  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  (Keychain.getSupportedBiometryType as jest.Mock).mockResolvedValue(
    Keychain.BIOMETRY_TYPE.FACE_ID,
  );
  (Keychain.canImplyAuthentication as jest.Mock).mockResolvedValue(true);
  (Keychain.hasGenericPassword as jest.Mock).mockResolvedValue(true);
  (Keychain.getGenericPassword as jest.Mock).mockResolvedValue({
    username: 'journalio-biometric-lock',
    password: 'enabled',
    service: 'journalio.biometric.lock',
    storage: 'mock',
  });
  (Keychain.setGenericPassword as jest.Mock).mockResolvedValue(true);
  (Keychain.resetGenericPassword as jest.Mock).mockResolvedValue(true);
});

afterEach(() => {
  Object.defineProperty(testPlatform, 'OS', {
    configurable: true,
    value: originalOS,
  });
});

test('reports Face ID availability on supported iPhones', async () => {
  const availability = await getBiometricLockAvailability();

  expect(availability.isSupported).toBe(true);
  expect(availability.isAvailable).toBe(true);
  expect(availability.biometryType).toBe('face_id');
  expect(availability.label).toBe('Face ID lock');
});

test('enables the biometric lock after one successful device authentication', async () => {
  const result = await enableBiometricLock({ isPremium: true });

  expect(result.status).toBe('enabled');
  expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
    'journalio-biometric-lock',
    'enabled',
    expect.objectContaining({
      service: 'journalio.biometric.lock',
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
    }),
  );
  expect(Keychain.getGenericPassword).toHaveBeenCalledWith(
    expect.objectContaining({
      service: 'journalio.biometric.lock',
      authenticationPrompt: expect.objectContaining({
        title: 'Enable Face ID lock',
      }),
    }),
  );
  expect(AsyncStorage.setItem).toHaveBeenCalledWith(
    'journalio.biometricLockEnabled',
    'true',
  );
});

test('keeps the lock disabled when authentication is cancelled during setup', async () => {
  (Keychain.getGenericPassword as jest.Mock).mockRejectedValue(
    new Error('User canceled the operation.'),
  );

  const result = await enableBiometricLock({ isPremium: true });

  expect(result.status).toBe('cancelled');
  expect(Keychain.resetGenericPassword).toHaveBeenCalledWith({
    service: 'journalio.biometric.lock',
  });
  expect(AsyncStorage.setItem).toHaveBeenCalledWith(
    'journalio.biometricLockEnabled',
    'false',
  );
});

test('rejects free enable attempts without changing secure storage', async () => {
  const result = await enableBiometricLock({ isPremium: false });

  expect(result.status).toBe('premium_required');
  expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
  expect(Keychain.getGenericPassword).not.toHaveBeenCalled();
  expect(Keychain.resetGenericPassword).not.toHaveBeenCalled();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

test('authenticates an existing lock marker with the system prompt', async () => {
  const result = await authenticateBiometricLock();

  expect(result.status).toBe('success');
  expect(Keychain.hasGenericPassword).toHaveBeenCalledWith({
    service: 'journalio.biometric.lock',
  });
  expect(Keychain.getGenericPassword).toHaveBeenCalledWith(
    expect.objectContaining({
      service: 'journalio.biometric.lock',
      authenticationPrompt: expect.objectContaining({
        title: 'Unlock Journal.IO',
      }),
    }),
  );
});

test('surfaces unavailable-device recovery when Face ID is no longer available', async () => {
  (Keychain.canImplyAuthentication as jest.Mock).mockResolvedValue(false);

  const result = await authenticateBiometricLock();

  expect(result.status).toBe('unavailable');
  expect(result.message).toContain('Face ID is not available right now');
});

test('disables the biometric lock without touching auth-token storage', async () => {
  const result = await disableBiometricLock();

  expect(result.status).toBe('disabled');
  expect(Keychain.resetGenericPassword).toHaveBeenCalledWith({
    service: 'journalio.biometric.lock',
  });
  expect(AsyncStorage.setItem).toHaveBeenCalledWith(
    'journalio.biometricLockEnabled',
    'false',
  );
});
