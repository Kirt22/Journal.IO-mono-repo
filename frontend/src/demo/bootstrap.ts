import { Alert, DevSettings, LogBox } from 'react-native';
import {
  cancelFreeTrialEndingReminder,
  cancelReminderNotifications,
  cancelWeeklyInsightNotifications,
  setRuntimeNotificationsSuppressed,
} from '../services/reminderNotificationsService';
import { setRuntimeOnlineOverride } from '../services/connectivityService';
import {
  cancelAllGoalReminders,
  setRuntimeGoalNotificationsSuppressed,
} from '../services/goalRemindersService';
import { setRuntimeHapticsSuppressed } from '../services/hapticsService';
import { registerRequestAdapter } from '../utils/apiClient';
import { demoRequestAdapter } from './demoApiAdapter';
import { DemoMode } from './DemoMode';
import { getDemoScenarios, isCapturedScenario } from './scenarioRegistry';

const DEMO_BOOTSTRAP_MARKER = 'JOURNAL_IO_DEMO_MODE_BOOTSTRAP_V1';

const reload = () => DevSettings.reload();

const showError = (error: unknown) => {
  Alert.alert(
    'Demo Mode',
    error instanceof Error ? error.message : 'The demo action could not be completed.',
  );
};

const applyRuntimePolicies = async () => {
  const active = Boolean(DemoMode.activeScenarioId);
  const filmMode = active && DemoMode.filmMode;

  setRuntimeOnlineOverride(active);
  setRuntimeHapticsSuppressed(filmMode);
  setRuntimeGoalNotificationsSuppressed(filmMode);
  setRuntimeNotificationsSuppressed(filmMode);
  LogBox.ignoreAllLogs(filmMode);

  if (filmMode) {
    await Promise.all([
      cancelReminderNotifications(),
      cancelWeeklyInsightNotifications(),
      cancelFreeTrialEndingReminder(),
      cancelAllGoalReminders(),
    ]).catch(() => undefined);
  }
};

const registerDevMenu = () => {
  const current = DemoMode.activeScenarioId;

  getDemoScenarios().forEach(scenario => {
    const captured = isCapturedScenario(scenario);
    const prefix = current === scenario.id ? '✓ ' : '';
    const suffix = captured ? '' : ' (capture required)';

    DevSettings.addMenuItem(
      `${prefix}Demo: ${scenario.label}${suffix}`,
      () => {
        DemoMode.activate(scenario.id)
          .then(reload)
          .catch(showError);
      },
    );
  });

  DevSettings.addMenuItem(
    `Demo Film Mode: ${DemoMode.filmMode ? 'On' : 'Off'}`,
    () => {
      DemoMode.setFilmMode(!DemoMode.filmMode)
        .then(reload)
        .catch(showError);
    },
  );

  DevSettings.addMenuItem('Demo: Reset to normal', () => {
    DemoMode.reset().then(reload).catch(showError);
  });
};

/**
 * Installing the adapter is deliberately synchronous and separate from the rest
 * of the bootstrap. The native side calls runApplication as soon as the bundle
 * finishes executing, so the entry point cannot await anything before it
 * registers the app — but nor can a single request be allowed to escape to the
 * real backend while Demo Mode is still hydrating. The adapter itself awaits
 * `DemoMode.ready` on every call, so claiming the seam up front is enough:
 * requests queue behind hydration instead of bypassing it.
 */
const installDemoRequestAdapter = () => {
  if (!__DEV__) {
    throw new Error('Demo Mode can run only in a development bundle.');
  }

  registerRequestAdapter(demoRequestAdapter);
};

const bootstrapDemoMode = async () => {
  if (!__DEV__) {
    throw new Error('Demo Mode can run only in a development bundle.');
  }

  await DemoMode.ready;
  registerRequestAdapter(demoRequestAdapter);
  await applyRuntimePolicies();
  registerDevMenu();
  console.info(`[DemoMode] ${DEMO_BOOTSTRAP_MARKER} ready`, {
    activeScenarioId: DemoMode.activeScenarioId,
    filmMode: DemoMode.filmMode,
  });
};

export { bootstrapDemoMode, installDemoRequestAdapter };
