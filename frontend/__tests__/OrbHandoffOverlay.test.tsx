/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import OrbHandoffOverlay from '../src/components/OrbHandoffOverlay';
import { resetAppStore, useAppStore } from '../src/store/appStore';
import { ThemeProvider } from '../src/theme/provider';

const PAYWALL_ORB = { x: -97, y: -39, size: 585 };
const HOME_ORB = { x: 43, y: 214, size: 304 };

const renderOverlay = () =>
  ReactTestRenderer.create(
    <ThemeProvider modeOverride="dark">
      <OrbHandoffOverlay />
    </ThemeProvider>,
  );

describe('OrbHandoffOverlay', () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

  beforeEach(() => {
    jest.useFakeTimers();
    ReactTestRenderer.act(() => {
      resetAppStore();
      renderer = renderOverlay();
    });
  });

  afterEach(() => {
    ReactTestRenderer.act(() => {
      renderer?.unmount();
      renderer = null;
      resetAppStore();
    });
    jest.useRealTimers();
  });

  const travellingOrbs = () =>
    renderer!.root.findAllByProps({ testID: 'orb-handoff' });

  const beginHandoff = () => {
    ReactTestRenderer.act(() => {
      useAppStore.getState().beginOrbHandoff(PAYWALL_ORB);
    });
  };

  it('stays out of the way until a hand-off starts', () => {
    expect(travellingOrbs()).toHaveLength(0);
  });

  it('mounts an orb at the paywall frame while it waits for Home', () => {
    beginHandoff();

    const orbs = travellingOrbs();
    expect(orbs.length).toBeGreaterThan(0);
    expect(orbs[0].props.size).toBe(PAYWALL_ORB.size);
    // Still travelling — Home has not reported where it landed.
    expect(useAppStore.getState().orbHandoff?.to).toBeNull();
  });

  it('releases the orb back to Home once it reports a target', () => {
    beginHandoff();

    ReactTestRenderer.act(() => {
      useAppStore.getState().reportOrbHandoffTarget(HOME_ORB);
    });

    // Landing clears the store entry so Home can reveal its own orb; the
    // overlay's copy fades out on top of it.
    expect(useAppStore.getState().orbHandoff).toBeNull();
  });

  it('ignores a second target so a re-layout cannot restart the travel', () => {
    beginHandoff();

    ReactTestRenderer.act(() => {
      useAppStore.getState().reportOrbHandoffTarget(HOME_ORB);
      useAppStore.getState().reportOrbHandoffTarget({ ...HOME_ORB, y: 999 });
    });

    expect(useAppStore.getState().orbHandoff).toBeNull();
  });

  it('gives up rather than covering the app when no target ever arrives', () => {
    beginHandoff();
    expect(travellingOrbs().length).toBeGreaterThan(0);

    ReactTestRenderer.act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(useAppStore.getState().orbHandoff).toBeNull();
    expect(travellingOrbs()).toHaveLength(0);
  });

  it('adopts a second hand-off while the first is still settling', () => {
    beginHandoff();
    ReactTestRenderer.act(() => {
      useAppStore.getState().reportOrbHandoffTarget(HOME_ORB);
    });
    expect(useAppStore.getState().orbHandoff).toBeNull();

    // Sign out -> onboarding -> paywall -> dismiss, all inside the first
    // hand-off's settle fade. The overlay used to skip its reset in this window
    // and then refuse to travel, stranding Home's reveal blocks at opacity 0.
    const secondPaywallOrb = { ...PAYWALL_ORB, size: 420 };
    ReactTestRenderer.act(() => {
      useAppStore.getState().beginOrbHandoff(secondPaywallOrb);
    });

    const orbs = travellingOrbs();
    expect(orbs.length).toBeGreaterThan(0);
    expect(orbs[0].props.size).toBe(secondPaywallOrb.size);

    ReactTestRenderer.act(() => {
      useAppStore.getState().reportOrbHandoffTarget(HOME_ORB);
    });

    expect(useAppStore.getState().orbHandoff).toBeNull();
  });

  it('releases on its own deadline even if nothing else ever lands', () => {
    beginHandoff();
    // Report a target, which disarms the no-target rescue timer, then wedge the
    // store so only the absolute deadline can clear it.
    ReactTestRenderer.act(() => {
      useAppStore.getState().reportOrbHandoffTarget(HOME_ORB);
      useAppStore.getState().beginOrbHandoff(PAYWALL_ORB);
      useAppStore.getState().reportOrbHandoffTarget(HOME_ORB);
    });

    ReactTestRenderer.act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(useAppStore.getState().orbHandoff).toBeNull();
    expect(travellingOrbs()).toHaveLength(0);
  });

  it('tears down when the hand-off is cleared from elsewhere', () => {
    beginHandoff();

    // A sign-out or restart wipes the store mid-flight.
    ReactTestRenderer.act(() => {
      useAppStore.getState().completeOrbHandoff();
    });

    expect(travellingOrbs()).toHaveLength(0);
  });
});
