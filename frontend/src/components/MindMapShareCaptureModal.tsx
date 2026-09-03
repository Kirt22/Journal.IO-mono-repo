import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  StyleSheet,
  View,
} from 'react-native';
import type { ViewShotRef } from 'react-native-view-shot';
import { Text } from '../infrastructure/reactNative';
import { captureMindMapCard } from '../services/mindMapCardCapture';
import { shareMindMapImage } from '../services/mindMapShareService';
import { useTheme } from '../theme/provider';
import ButtonLoadingContent from './ButtonLoadingContent';
import HapticPressable from './HapticPressable';
import MindMapShareCard, { type MindMapShareRegion } from './MindMapShareCard';

type Props = {
  onClose: () => void;
  region: MindMapShareRegion | null;
};

const PREPARE_TIMEOUT_MS = 10000;
// iOS needs a beat to finish tearing the RN modal down before it will present
// another view controller on top of the same window.
const MODAL_DISMISS_MS = 350;

export default function MindMapShareCaptureModal({ onClose, region }: Props) {
  const theme = useTheme();
  const captureRef = useRef<ViewShotRef>(null);
  const hasStartedRef = useRef(false);
  const [cardReady, setCardReady] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [isDismissing, setIsDismissing] = useState(false);

  useEffect(() => {
    hasStartedRef.current = false;
    setCardReady(false);
    setError(false);
    setIsDismissing(false);
  }, [attempt, region]);

  useEffect(() => {
    if (!region || cardReady || error) {
      return undefined;
    }

    const timer = setTimeout(() => setError(true), PREPARE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [cardReady, error, region]);

  useEffect(() => {
    if (!region || !cardReady || error || hasStartedRef.current) {
      return;
    }

    const capture = captureRef.current;
    if (!capture) {
      setError(true);
      return;
    }

    hasStartedRef.current = true;
    let cancelled = false;

    // Capture first, then take the modal down: `Share.open` presents from the
    // topmost view controller, which would be this modal — iOS silently refuses
    // to present the share sheet on top of it and nothing happens.
    captureMindMapCard(capture)
      .then(uri => {
        if (cancelled) {
          return undefined;
        }
        setIsDismissing(true);
        return new Promise<string>(resolve => {
          setTimeout(() => resolve(uri), MODAL_DISMISS_MS);
        }).then(shareMindMapImage);
      })
      .then(() => {
        if (!cancelled) {
          onClose();
        }
      })
      .catch((shareError: unknown) => {
        if (cancelled) {
          return;
        }
        if (__DEV__) {
          console.warn('[MindMapShare] capture or share failed', shareError);
        }
        hasStartedRef.current = false;
        setIsDismissing(false);
        setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [cardReady, error, onClose, region]);

  const handleRetry = useCallback(() => {
    setAttempt(value => value + 1);
  }, []);

  if (!region) {
    return null;
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={!isDismissing}
    >
      <View style={styles.root}>
        <MindMapShareCard
          key={`${region.regionId}-${attempt}`}
          onReadyChange={setCardReady}
          onRenderError={() => setError(true)}
          ref={captureRef}
          region={region}
          style={styles.captureCard}
        />
        <View
          style={[
            styles.overlay,
            { backgroundColor: theme.colors.background },
          ]}
        >
          {error ? (
            <>
              <Text style={[styles.title, { color: theme.colors.foreground }]}>
                Your card needs another moment
              </Text>
              <Text
                style={[styles.body, { color: theme.colors.mutedForeground }]}
              >
                We couldn&apos;t prepare it right now. Please try again.
              </Text>
              <HapticPressable
                accessibilityLabel="Try preparing Mind Map share card again"
                accessibilityRole="button"
                onPress={handleRetry}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: theme.colors.primary },
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.primaryButtonText,
                    { color: theme.colors.primaryForeground },
                  ]}
                >
                  Try again
                </Text>
              </HapticPressable>
              <HapticPressable
                accessibilityLabel="Close Mind Map sharing"
                accessibilityRole="button"
                onPress={onClose}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.secondaryButtonText,
                    { color: theme.colors.foreground },
                  ]}
                >
                  Not now
                </Text>
              </HapticPressable>
            </>
          ) : (
            <>
              <ButtonLoadingContent
                loaderColor={theme.colors.primary}
                loaderSize={34}
                loading
                style={styles.loader}
              >
                <View />
              </ButtonLoadingContent>
              <Text style={[styles.title, { color: theme.colors.foreground }]}>
                Preparing your card…
              </Text>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  captureCard: {
    alignSelf: 'center',
    position: 'absolute',
    top: 80,
    width: 360,
  },
  overlay: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  loader: {
    height: 48,
    width: 48,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    marginTop: 14,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 310,
    textAlign: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 18,
    justifyContent: 'center',
    marginTop: 22,
    minHeight: 52,
    paddingHorizontal: 30,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 46,
    paddingHorizontal: 24,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.985 }],
  },
});
