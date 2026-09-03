/**
 * Drives each *captured* scenario through the real demo adapter and asserts the
 * data contract behind every screen on the filming path. This is not a substitute
 * for looking at the device, but it catches the failures that would waste a shoot:
 * a gap in the streak, a Mind Map that never reached "ready", an Ask Jade question
 * that silently resolves to the fallback, a scenario switch that bleeds data.
 *
 * Draft scenarios are skipped, so this stays green before a capture has been run.
 */
const mockDemoState: { scenario: unknown } = { scenario: null };

jest.mock('../src/demo/DemoMode', () => ({
  DemoMode: {
    ready: Promise.resolve(),
    get activeScenario() {
      return mockDemoState.scenario;
    },
  },
}));

import {
  demoRequestAdapter,
  resetDemoOverlayForTests,
} from '../src/demo/demoApiAdapter';
import { findNearestQuestionIndex } from '../src/demo/fuzzyMatch';
import emotionalEating from '../src/demo/scenarios/emotional-eating.json';
import restIsGuilt from '../src/demo/scenarios/rest-is-guilt.json';
import sheLeft from '../src/demo/scenarios/she-left.json';

type AnyRecord = Record<string, unknown>;

const request = async (path: string, method = 'GET', body?: object) =>
  demoRequestAdapter({
    path,
    method,
    options: { method, ...(body ? { body: JSON.stringify(body) } : {}) },
    behavior: {},
  });

const activate = (scenario: unknown) => {
  mockDemoState.scenario = scenario;
  resetDemoOverlayForTests();
};

const dateKey = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
};

const scenarios = [emotionalEating, restIsGuilt, sheLeft] as unknown as {
  id: string;
  status: string;
  entries: { dayOffset: number; answers: string[] }[];
  askJadeQuestions: string[];
  filmingEntryDayOffset: number;
  captured: AnyRecord | null;
}[];

const captured = scenarios.filter(s => s.status === 'captured' && s.captured);

(captured.length ? describe : describe.skip)('captured demo scenarios', () => {
  describe.each(captured.map(s => [s.id, s] as const))('%s', (_id, scenario) => {
    beforeEach(() => activate(scenario));
    afterEach(() => activate(null));

    test('the user reads as Premium, so the gated screens populate', async () => {
      const response = await request('/users/profile');
      expect((response?.data as AnyRecord).isPremium).toBe(true);
    });

    test('30 day streak with no gaps, and an entry today', async () => {
      const current = (await request('/streaks/current'))?.data as AnyRecord;
      expect(current.currentStreak).toBe(30);
      expect(current.hasEntryToday).toBe(true);

      const history = (await request('/streaks/history?days=30'))?.data as {
        days: { dateKey: string; hasEntry: boolean }[];
      };
      expect(history.days).toHaveLength(30);
      const missing = history.days.filter(day => !day.hasEntry);
      expect(missing.map(day => day.dateKey)).toEqual([]);
    });

    test("today's entry is the filming entry and carries the authored answers", async () => {
      const page = (await request('/journal/get_journals?limit=10'))?.data as {
        entries: { _id: string; content: string; createdAt: string }[];
      };
      const today = page.entries.filter(e => e.createdAt.startsWith(dateKey(0)));
      expect(today).toHaveLength(1);

      const filming = scenario.entries.find(
        e => e.dayOffset === scenario.filmingEntryDayOffset,
      )!;
      for (const answer of filming.answers) {
        expect(today[0]!.content).toContain(answer);
      }

      // and its session analysis is served, not a fallback
      const analysis = (await request('/journal/session_analysis', 'POST', {
        journalId: today[0]!._id,
      }))?.data as AnyRecord;
      expect(analysis).toBeTruthy();
      expect(analysis.isFallback).not.toBe(true);
    });

    test('Suggest returns captured copy for all five actions, each distinct', async () => {
      const actions = [
        'gentle_prompt',
        'go_deeper',
        'another_perspective',
        'small_next_step',
        'summarize',
      ];
      const seen = new Set<string>();
      for (const suggestionAction of actions) {
        const response = await request(
          '/guided-reflection/go-deeper',
          'POST',
          { suggestionAction },
        );
        const value = JSON.stringify(response?.data);
        expect(value).toBeTruthy();
        seen.add(value);
      }
      expect(seen.size).toBe(actions.length);
    });

    test('Mind Map is ready with ranked, scored regions on every range', async () => {
      for (const range of ['latest_week', 'monthly', 'all_time']) {
        const map = (await request(`/insights/mind-map?range=${range}`))
          ?.data as AnyRecord;
        expect(map.status).toBe('ready');

        const regions = map.regions as { rank: number; signalScore: number }[];
        expect(regions.length).toBeGreaterThan(0);
        const ranks = regions.map(r => r.rank).sort((a, b) => a - b);
        expect(ranks).toEqual(ranks.map((_, i) => i + 1));
        for (const region of regions) {
          expect(typeof region.signalScore).toBe('number');
        }
        // every region the screen can drill into has a captured series
        for (const region of map.regions as { id: string }[]) {
          const series = await request(
            `/insights/mind-map/region/${region.id}/series?range=${range}`,
          );
          expect(series?.success).toBe(true);
        }
      }
    });

    test('Patterns Detected has real cards', async () => {
      const weekly = (await request('/insights/ai-analysis'))?.data as AnyRecord;
      expect(weekly.status).toBe('ready');

      const patterns = weekly.patterns as { label: string; insight: string }[];
      expect(patterns.length).toBeGreaterThan(0);
      for (const pattern of patterns) {
        expect(pattern.label.trim()).not.toBe('');
        expect(pattern.insight.trim()).not.toBe('');
      }
    });

    test('Auto Goals shows the generated goal', async () => {
      const goals = (await request(`/goals?today=${dateKey(0)}`))?.data as {
        goals: { title: string }[];
      };
      expect(goals.goals.length).toBeGreaterThan(0);
      for (const goal of goals.goals) {
        expect(goal.title.trim()).not.toBe('');
      }
    });

    test('every authored Ask Jade question returns its own captured answer', async () => {
      const replies = new Set<string>();
      for (const question of scenario.askJadeQuestions) {
        const response = (await request('/ask-jade/messages', 'POST', {
          text: question,
        }))?.data as { reply: { text: string; status: string } };
        expect(response.reply.status).not.toBe('fallback');
        replies.add(response.reply.text);
      }
      // distinct answers prove none of them collapsed onto the same match
      expect(replies.size).toBe(scenario.askJadeQuestions.length);

      const fallbackText = (
        (await request('/ask-jade/messages', 'POST', {
          text: 'what is the weather like tomorrow',
        }))?.data as { reply: { text: string } }
      ).reply.text;
      expect(replies.has(fallbackText)).toBe(false);
    });

    test('imperfect live typing still reaches the intended answer', async () => {
      // Drift the authored question the way a hand does on camera: lowercase it,
      // drop the punctuation, and add a trailing space.
      for (const [index, question] of scenario.askJadeQuestions.entries()) {
        const typed = `${question.toLowerCase().replace(/[?'’]/g, '')} `;
        expect(findNearestQuestionIndex(typed, scenario.askJadeQuestions)).toBe(
          index,
        );
      }
    });
  });
});

(captured.length >= 2 ? test : test.skip)(
  'switching scenarios replaces the data with no bleed-through',
  async () => {
    activate(captured[0]);
    const first = (await request('/journal/get_journals?limit=30'))?.data as {
      entries: { _id: string }[];
    };
    const firstWeekly = JSON.stringify(
      (await request('/insights/ai-analysis'))?.data,
    );

    activate(captured[1]);
    const second = (await request('/journal/get_journals?limit=30'))?.data as {
      entries: { _id: string }[];
    };
    const secondWeekly = JSON.stringify(
      (await request('/insights/ai-analysis'))?.data,
    );

    const firstIds = new Set(first.entries.map(e => e._id));
    const overlap = second.entries.filter(e => firstIds.has(e._id));
    expect(overlap).toEqual([]);
    expect(secondWeekly).not.toBe(firstWeekly);

    activate(null);
  },
);
