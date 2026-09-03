import emotionalEating from './scenarios/emotional-eating.json';
import restIsGuilt from './scenarios/rest-is-guilt.json';
import sheLeft from './scenarios/she-left.json';
import replyDependency from './scenarios/reply-dependency.json';
import sundayCollapse from './scenarios/sunday-collapse.json';
import avoidanceLoop from './scenarios/avoidance-loop.json';
import type { DemoScenarioFixture } from './demoTypes';

const scenarios = [
  emotionalEating,
  restIsGuilt,
  sheLeft,
  replyDependency,
  sundayCollapse,
  avoidanceLoop,
] as unknown as DemoScenarioFixture[];

const scenarioById = new Map(scenarios.map(scenario => [scenario.id, scenario]));

export const getDemoScenarios = () => scenarios;

export const getDemoScenario = (scenarioId: string | null) =>
  scenarioId ? scenarioById.get(scenarioId) || null : null;

export const isCapturedScenario = (
  scenario: DemoScenarioFixture | null,
): scenario is DemoScenarioFixture & { status: 'captured'; captured: NonNullable<DemoScenarioFixture['captured']> } =>
  Boolean(
    scenario &&
      scenario.status === 'captured' &&
      scenario.fictional === true &&
      scenario.entries.length === 30 &&
      scenario.captured,
  );
