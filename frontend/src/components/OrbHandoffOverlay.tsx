import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';
import Orb from './orb';
import { getAmbientOrbOpacity, getOrbAccents } from '../constants/orbPalette';
import { useAppStore, type OrbHandoffState } from '../store/appStore';
import { useTheme } from '../theme/provider';

/**
 * Carries the root paywall's ambient orb across to the Home hero orb.
 *
 * Dismissing the post-onboarding paywall resets the navigation root, which
 * unmounts the paywall and mounts Home in the same frame — anything drawn
 * inside either screen would be cut in half by that swap. So the travelling orb
 * lives here instead, as a sibling of the navigator (the same place
 * `BiometricLockOverlay` sits), and stays on screen throughout. The paywall
 * hides its own orb before handing over and Home keeps its orb invisible until
 * this one lands, so exactly one orb is ever visible.
 *
 * Same idea as `OnboardingPulseOverlay` — a caller-owned overlay that has to
 * survive a route change — but driven by store state rather than a prop, since
 * the two ends of this transition are on different screens.
 */

const TRAVEL_DURATION_MS = 520;
const SETTLE_FADE_MS = 120;
/**
 * If Home never reports where its orb landed — it isn't the destination, or it
 * is mounting slowly — give up and hand back to it anyway. The overlay covers
 * the whole screen, so it must never be able to stick.
 */
const TARGET_TIMEOUT_MS = 800;
/**
 * Absolute deadline, armed the moment a hand-off is adopted and never disarmed.
 *
 * `TARGET_TIMEOUT_MS` only covers the "Home never reported" case and is dropped
 * as soon as a target arrives, which left the whole travel with no backstop: an
 * interrupted `Animated.timing` reports `finished: false`, so `land()` — the
 * only caller of `completeOrbHandoff` on that path — never ran, and Home stayed
 * gated at opacity 0 forever. This one fires regardless of phase or target.
 */
const HANDOFF_DEADLINE_MS = TARGET_TIMEOUT_MS + TRAVEL_DURATION_MS + SETTLE_FADE_MS;

type Phase = 'travelling' | 'settling';

const centerOf = (rect: { x: number; size: number }) => rect.x + rect.size / 2;

export default function OrbHandoffOverlay() {
  const theme = useTheme();
  const handoff = useAppStore(state => state.orbHandoff);
  const completeOrbHandoff = useAppStore(state => state.completeOrbHandoff);

  // Mirrors the store, but outlives it: the store entry is cleared the moment
  // the orb lands so Home can reveal its own, while this one stays mounted for
  // the cross-fade on top of it.
  const [rendered, setRendered] = useState<OrbHandoffState | null>(null);
  const [phase, setPhase] = useState<Phase>('travelling');
  const progress = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const phaseRef = useRef<Phase>('travelling');

  phaseRef.current = phase;

  const orbAccents = useMemo(() => getOrbAccents(theme.mode), [theme.mode]);
  const ambientOpacity = getAmbientOrbOpacity(theme.mode);

  // Identity of the hand-off we last reset our animation values for. A second
  // hand-off in the same session has to reset them again, even if a stranded
  // `rendered` from the first is still mounted — keying off `rendered` being
  // null (and mutating state inside a `useState` updater to do it) meant an
  // interrupted settle fade permanently wedged every later hand-off.
  const adoptedRef = useRef<OrbHandoffState | null>(null);

  // Adopt a new handoff, and pick up the target once Home reports it.
  useEffect(() => {
    if (handoff) {
      // `beginOrbHandoff` always publishes a fresh object, and
      // `reportOrbHandoffTarget` only ever fills in `to` on that same one, so
      // comparing `from` identifies the hand-off across both updates.
      if (adoptedRef.current?.from !== handoff.from) {
        adoptedRef.current = handoff;
        progress.setValue(0);
        fade.setValue(1);
        setPhase('travelling');
      }

      setRendered(handoff);
      return;
    }

    // Cleared by someone else (sign-out, restart) rather than by our own
    // landing — tear down rather than leaving a stranded orb on screen.
    if (phaseRef.current !== 'settling') {
      adoptedRef.current = null;
      setRendered(null);
    }
  }, [fade, handoff, progress]);

  const from = rendered?.from ?? null;
  const to = rendered?.to ?? null;

  // Travel, then hand back to Home and fade out over its now-visible orb.
  useEffect(() => {
    if (!from || !to || phase !== 'travelling') {
      return;
    }

    let isActive = true;
    let animation: Animated.CompositeAnimation | null = null;

    const land = () => {
      if (!isActive) {
        return;
      }
      // Home reveals its orb at exactly this position and size, so the fade
      // below crosses over an identical image instead of a gap.
      setPhase('settling');
      completeOrbHandoff();
      Animated.timing(fade, {
        toValue: 0,
        duration: SETTLE_FADE_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(() => {
        // Deliberately not gated on `finished`: a stopped fade must still tear
        // the overlay down, or it stays parked in `settling` and blocks the
        // next hand-off from ever resetting.
        if (isActive) {
          adoptedRef.current = null;
          setRendered(null);
        }
      });
    };

    const travel = () => {
      if (!isActive) {
        return;
      }
      animation = Animated.timing(progress, {
        toValue: 1,
        duration: TRAVEL_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      // Land on `finished: false` too. An interruption — a `setValue` from
      // anywhere, or this effect's own cleanup — is not a reason to strand the
      // hand-off; `completeOrbHandoff` is idempotent, and snapping the orb home
      // early beats never releasing Home's reveal blocks.
      animation.start(land);
    };

    if (typeof jest !== 'undefined') {
      progress.setValue(1);
      land();
      return () => {
        isActive = false;
      };
    }

    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (enabled) {
          // No travel, but the orb still has to end up where Home expects it.
          progress.setValue(1);
          land();
          return;
        }
        travel();
      })
      // Both paths re-check `isActive` themselves, so there is no early return
      // here: an orphaned pass that bailed silently was one more way to leave
      // the hand-off with neither `travel()` nor `land()` ever running.
      .catch(travel);

    return () => {
      isActive = false;
      animation?.stop();
    };
  }, [completeOrbHandoff, fade, from, phase, progress, to]);

  // Nothing to travel to — release the overlay rather than covering the app.
  useEffect(() => {
    if (!rendered || rendered.to) {
      return;
    }

    const timer = setTimeout(() => {
      completeOrbHandoff();
      adoptedRef.current = null;
      setRendered(null);
    }, TARGET_TIMEOUT_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [completeOrbHandoff, rendered]);

  // The backstop for everything else. Keyed on the hand-off itself rather than
  // on `rendered`, so re-renders and target reports cannot keep pushing it out.
  useEffect(() => {
    if (!from) {
      return;
    }

    const timer = setTimeout(() => {
      completeOrbHandoff();
      adoptedRef.current = null;
      setRendered(null);
    }, HANDOFF_DEADLINE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [completeOrbHandoff, from]);

  if (!from) {
    return null;
  }

  const target = to ?? from;
  const animatedStyle = {
    opacity: Animated.multiply(
      fade,
      progress.interpolate({
        inputRange: [0, 1],
        outputRange: [ambientOpacity, 1],
      }),
    ),
    transform: [
      {
        translateX: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, centerOf(target) - centerOf(from)],
        }),
      },
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [
            0,
            target.y + target.size / 2 - (from.y + from.size / 2),
          ],
        }),
      },
      {
        scale: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [1, target.size / from.size],
        }),
      },
    ],
  };

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.orbFrame,
          { left: from.x, top: from.y },
          animatedStyle,
        ]}
      >
        <Orb
          deepColor={orbAccents.deep}
          primaryColor={theme.colors.primary}
          secondaryColor={orbAccents.secondary}
          size={from.size}
          testID="orb-handoff"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  orbFrame: {
    position: 'absolute',
  },
});
