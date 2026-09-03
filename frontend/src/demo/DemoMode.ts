import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCachedAuthUser } from '../utils/authSessionCache';
import { getDemoScenario, isCapturedScenario } from './scenarioRegistry';

const ACTIVE_SCENARIO_KEY = '@journalio/demo/active-scenario';
const FILM_MODE_KEY = '@journalio/demo/film-mode';

class DemoModeController {
  activeScenarioId: string | null = null;
  filmMode = false;
  /**
   * The signed-in account's display name, read once before any request is
   * served. Every captured fixture was recorded under a scratch account called
   * "Demo Journaler", so without this the greeting flips from the real name to
   * "Demo" the moment a scenario is selected — a visible cut mid-take. The name
   * is substituted into the served profile at runtime; the captured fixture on
   * disk is never touched.
   */
  realUserName: string | null = null;
  readonly ready: Promise<void>;

  constructor() {
    this.ready = this.hydrate();
  }

  private async hydrate() {
    const [activeScenarioId, filmMode, cachedUser] = await Promise.all([
      AsyncStorage.getItem(ACTIVE_SCENARIO_KEY),
      AsyncStorage.getItem(FILM_MODE_KEY),
      getCachedAuthUser().catch(() => null),
    ]);
    const scenario = getDemoScenario(activeScenarioId);

    this.realUserName = cachedUser?.name?.trim() || null;

    this.activeScenarioId = isCapturedScenario(scenario)
      ? scenario.id
      : null;
    this.filmMode = this.activeScenarioId ? filmMode === 'true' : false;
  }

  get activeScenario() {
    const scenario = getDemoScenario(this.activeScenarioId);
    return isCapturedScenario(scenario) ? scenario : null;
  }

  async activate(scenarioId: string) {
    const scenario = getDemoScenario(scenarioId);
    if (!isCapturedScenario(scenario)) {
      throw new Error('Capture this scenario before activating it.');
    }

    await AsyncStorage.setItem(ACTIVE_SCENARIO_KEY, scenario.id);
    this.activeScenarioId = scenario.id;
  }

  async reset() {
    await Promise.all([
      AsyncStorage.removeItem(ACTIVE_SCENARIO_KEY),
      AsyncStorage.removeItem(FILM_MODE_KEY),
    ]);
    this.activeScenarioId = null;
    this.filmMode = false;
  }

  async setFilmMode(enabled: boolean) {
    if (enabled && !this.activeScenarioId) {
      throw new Error('Select a captured scenario before enabling Film Mode.');
    }

    await AsyncStorage.setItem(FILM_MODE_KEY, String(enabled));
    this.filmMode = enabled;
  }
}

export const DemoMode = new DemoModeController();
