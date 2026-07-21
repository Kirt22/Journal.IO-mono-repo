import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Keychain from 'react-native-keychain';
import type { AuthUser } from './authService';
import devLaunchConfig from '../utils/devLaunchConfig.json';

const BIOMETRIC_LOCK_PREFERENCE_KEY = 'journalio.biometricLockEnabled';
const BIOMETRIC_LOCK_KEYCHAIN_SERVICE = 'journalio.biometric.lock';
const BIOMETRIC_LOCK_KEYCHAIN_USERNAME = 'journalio-biometric-lock';
const BIOMETRIC_LOCK_KEYCHAIN_PASSWORD = 'enabled';

type BiometricLockType = 'face_id' | 'touch_id' | null;
type BiometricLockAvailabilityReason =
  | 'available'
  | 'not_ios'
  | 'not_supported'
  | 'temporarily_unavailable';
type BiometricLockAuthStatus =
  | 'success'
  | 'cancelled'
  | 'unavailable'
  | 'not_configured'
  | 'error';
type BiometricLockToggleStatus =
  | 'enabled'
  | 'disabled'
  | 'cancelled'
  | 'unavailable'
  | 'error';

type BiometricLockAvailability = {
  biometryType: BiometricLockType;
  isAvailable: boolean;
  isSupported: boolean;
  label: string;
  reason: BiometricLockAvailabilityReason;
  message: string;
};

type BiometricLockAuthResult = {
  availability: BiometricLockAvailability;
  message?: string;
  status: BiometricLockAuthStatus;
};

type BiometricLockToggleResult = {
  availability: BiometricLockAvailability;
  message?: string;
  status: BiometricLockToggleStatus;
};

const isBiometricLockTestingOverrideEnabled = () =>
  __DEV__ && devLaunchConfig.enableBiometricLockForTesting === true;

const canAccessBiometricLock = (
  user: Pick<AuthUser, 'isPremium'> | null | undefined,
) => Boolean(user?.isPremium) || isBiometricLockTestingOverrideEnabled();

const mapBiometryType = (
  biometryType: Keychain.BIOMETRY_TYPE | null,
): BiometricLockType => {
  if (biometryType === Keychain.BIOMETRY_TYPE.FACE_ID) {
    return 'face_id';
  }

  if (biometryType === Keychain.BIOMETRY_TYPE.TOUCH_ID) {
    return 'touch_id';
  }

  return null;
};

const getBiometricLockLabel = (biometryType: BiometricLockType) => {
  if (biometryType === 'face_id') {
    return 'Face ID lock';
  }

  if (biometryType === 'touch_id') {
    return 'Touch ID lock';
  }

  return 'Biometric lock';
};

const getBiometricMethodName = (biometryType: BiometricLockType) => {
  if (biometryType === 'face_id') {
    return 'Face ID';
  }

  if (biometryType === 'touch_id') {
    return 'Touch ID';
  }

  return 'biometric authentication';
};

const buildUnavailableMessage = (biometryType: BiometricLockType) => {
  const methodName = getBiometricMethodName(biometryType);

  if (!biometryType) {
    return 'This iPhone does not currently support Face ID or Touch ID for Journal.IO app lock.';
  }

  return `${methodName} is not available right now. Check that ${methodName} is set up and that your device passcode is enabled.`;
};

const getMarkerKeychainOptions = () => ({
  service: BIOMETRIC_LOCK_KEYCHAIN_SERVICE,
  accessible: Keychain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
  accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
});

const getMarkerReadOptions = (title: string) => ({
  service: BIOMETRIC_LOCK_KEYCHAIN_SERVICE,
  accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
  authenticationPrompt: {
    title,
    cancel: 'Cancel',
  },
});

const isCancellationError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false;
  }

  return /cancel|canceled|cancelled|user fallback/i.test(error.message);
};

const isUnavailableError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false;
  }

  return /biometry|face id|touch id|passcode|not available|not enrolled|authentication could not start/i.test(
    error.message,
  );
};

const readBiometricLockPreference = async () =>
  (await AsyncStorage.getItem(BIOMETRIC_LOCK_PREFERENCE_KEY)) === 'true';

const saveBiometricLockPreference = async (enabled: boolean) => {
  await AsyncStorage.setItem(
    BIOMETRIC_LOCK_PREFERENCE_KEY,
    enabled ? 'true' : 'false',
  );
};

const getBiometricLockAvailability =
  async (): Promise<BiometricLockAvailability> => {
    if (Platform.OS !== 'ios') {
      return {
        biometryType: null,
        isAvailable: false,
        isSupported: false,
        label: getBiometricLockLabel(null),
        reason: 'not_ios',
        message: 'App lock is currently available only on iPhone with Face ID or Touch ID.',
      };
    }

    const supportedBiometry = await Keychain.getSupportedBiometryType();
    const biometryType = mapBiometryType(supportedBiometry);

    if (!biometryType) {
      return {
        biometryType: null,
        isAvailable: false,
        isSupported: false,
        label: getBiometricLockLabel(null),
        reason: 'not_supported',
        message:
          'This iPhone does not currently support Face ID or Touch ID for Journal.IO app lock.',
      };
    }

    let canAuthenticate = false;

    try {
      canAuthenticate = await Keychain.canImplyAuthentication({
        authenticationType:
          Keychain.AUTHENTICATION_TYPE.DEVICE_PASSCODE_OR_BIOMETRICS,
      });
    } catch {
      canAuthenticate = false;
    }

    return {
      biometryType,
      isAvailable: canAuthenticate,
      isSupported: true,
      label: getBiometricLockLabel(biometryType),
      reason: canAuthenticate ? 'available' : 'temporarily_unavailable',
      message: canAuthenticate
        ? `${getBiometricMethodName(
            biometryType,
          )} can help keep Journal.IO private on this device.`
        : buildUnavailableMessage(biometryType),
    };
  };

const hasBiometricLockMarker = async () => {
  if (typeof Keychain.hasGenericPassword !== 'function') {
    return false;
  }

  return Keychain.hasGenericPassword({
    service: BIOMETRIC_LOCK_KEYCHAIN_SERVICE,
  });
};

const authenticateBiometricLock = async (
  title = 'Unlock Journal.IO',
): Promise<BiometricLockAuthResult> => {
  const availability = await getBiometricLockAvailability();

  if (!availability.isAvailable) {
    return {
      availability,
      message: availability.message,
      status: 'unavailable',
    };
  }

  const hasMarker = await hasBiometricLockMarker();

  if (!hasMarker) {
    return {
      availability,
      message:
        'This device lock is no longer available on this iPhone. Sign out and set it up again when Face ID or Touch ID is ready.',
      status: 'not_configured',
    };
  }

  try {
    const credentials = await Keychain.getGenericPassword(
      getMarkerReadOptions(title),
    );

    if (!credentials) {
      return {
        availability,
        message: `${getBiometricMethodName(
          availability.biometryType,
        )} was cancelled.`,
        status: 'cancelled',
      };
    }

    return {
      availability,
      status: 'success',
    };
  } catch (error) {
    if (isCancellationError(error)) {
      return {
        availability,
        message: `${getBiometricMethodName(
          availability.biometryType,
        )} was cancelled.`,
        status: 'cancelled',
      };
    }

    if (isUnavailableError(error)) {
      return {
        availability,
        message: buildUnavailableMessage(availability.biometryType),
        status: 'unavailable',
      };
    }

    return {
      availability,
      message:
        error instanceof Error
          ? error.message
          : 'Unable to verify this device lock right now.',
      status: 'error',
    };
  }
};

const enableBiometricLock = async (): Promise<BiometricLockToggleResult> => {
  const availability = await getBiometricLockAvailability();

  if (!availability.isAvailable) {
    await saveBiometricLockPreference(false);

    return {
      availability,
      message: availability.message,
      status: 'unavailable',
    };
  }

  try {
    await Keychain.setGenericPassword(
      BIOMETRIC_LOCK_KEYCHAIN_USERNAME,
      BIOMETRIC_LOCK_KEYCHAIN_PASSWORD,
      getMarkerKeychainOptions(),
    );

    const authResult = await authenticateBiometricLock(
      `Enable ${availability.label}`,
    );

    if (authResult.status === 'success') {
      await saveBiometricLockPreference(true);

      return {
        availability,
        status: 'enabled',
      };
    }

    await Keychain.resetGenericPassword({
      service: BIOMETRIC_LOCK_KEYCHAIN_SERVICE,
    }).catch(() => undefined);
    await saveBiometricLockPreference(false);

    return {
      availability,
      message: authResult.message,
      status:
        authResult.status === 'cancelled'
          ? 'cancelled'
          : authResult.status === 'error'
          ? 'error'
          : 'unavailable',
    };
  } catch (error) {
    await Keychain.resetGenericPassword({
      service: BIOMETRIC_LOCK_KEYCHAIN_SERVICE,
    }).catch(() => undefined);
    await saveBiometricLockPreference(false);

    return {
      availability,
      message:
        error instanceof Error
          ? error.message
          : 'Unable to enable the device lock right now.',
      status: 'error',
    };
  }
};

const disableBiometricLock = async (): Promise<BiometricLockToggleResult> => {
  const availability = await getBiometricLockAvailability();

  await Promise.all([
    saveBiometricLockPreference(false),
    Keychain.resetGenericPassword({
      service: BIOMETRIC_LOCK_KEYCHAIN_SERVICE,
    }).catch(() => undefined),
  ]);

  return {
    availability,
    status: 'disabled',
  };
};

export {
  authenticateBiometricLock,
  canAccessBiometricLock,
  disableBiometricLock,
  enableBiometricLock,
  getBiometricLockAvailability,
  getBiometricLockLabel,
  getBiometricMethodName,
  isBiometricLockTestingOverrideEnabled,
  readBiometricLockPreference,
};
export type {
  BiometricLockAuthResult,
  BiometricLockAvailability,
  BiometricLockAuthStatus,
  BiometricLockToggleResult,
  BiometricLockToggleStatus,
  BiometricLockType,
};
