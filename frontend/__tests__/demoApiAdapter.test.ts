jest.mock('../src/demo/DemoMode', () => ({
  DemoMode: {
    ready: Promise.resolve(),
    realUserName: null,
    activeScenario: {
      id: 'test-scenario',
      captured: {
        profile: { userId: 'demo-user', name: 'Demo', isPremium: true },
        journals: {
          entries: [
            {
              _id: 'entry-1',
              title: 'Today',
              content: 'Fictional entry',
              type: 'guided',
              entryKind: 'journal',
              aiPrompt: null,
              images: [],
              tags: [],
              detectedTopics: [],
              detectedMood: 'okay',
              isFavorite: false,
              createdAt: '2026-08-24T12:00:00.000Z',
              updatedAt: '2026-08-24T12:00:00.000Z',
            },
          ],
          quickAnalysisByJournalId: {},
          sessionAnalysisByJournalId: {},
          entryMindMapByJournalId: {},
        },
        moodCheckIns: [],
        insightsOverview: { stats: { totalEntries: 1 } },
        weeklyAnalysis: { status: 'ready' },
        mindMaps: { latest_week: {}, monthly: {}, all_time: { status: 'ready' } },
        regionSeries: {},
        goals: [],
        goalSuggestionsByJournalId: {},
        guidedFlow: {},
        askJade: [
          {
            question: "why do I keep eating when I'm not hungry?",
            reply: {
              id: 'captured-reply',
              seq: 2,
              role: 'assistant',
              text: 'A captured answer.',
              status: 'ok',
              blocks: [{ type: 'text', text: 'A captured answer.' }],
              createdAt: '2026-08-24T12:00:00.000Z',
            },
          },
        ],
        askJadeFallback: {
          question: 'What pattern stands out?',
          reply: {
            id: 'captured-fallback',
            seq: 2,
            role: 'assistant',
            text: 'A captured fallback.',
            status: 'ok',
            blocks: [{ type: 'text', text: 'A captured fallback.' }],
            createdAt: '2026-08-24T12:00:00.000Z',
          },
        },
      },
    },
  },
}));

import { DemoMode } from '../src/demo/DemoMode';
import {
  demoRequestAdapter,
  resetDemoOverlayForTests,
} from '../src/demo/demoApiAdapter';

const request = (path: string, method = 'GET', body?: object) =>
  demoRequestAdapter({
    path,
    method,
    options: {
      method,
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
    behavior: {},
  });

describe('demo API adapter', () => {
  beforeEach(resetDemoOverlayForTests);

  test('returns production-shaped journal pages without network access', async () => {
    const response = await request('/journal/get_journals?limit=10');
    expect(response?.success).toBe(true);
    expect((response?.data as { entries: unknown[] }).entries).toHaveLength(1);
  });

  test('fuzzy matches Jade questions and returns captured reply content', async () => {
    const response = await request('/ask-jade/messages', 'POST', {
      text: 'why do i keep eeting when im not hungry',
    });
    expect(
      (response?.data as { reply: { text: string } }).reply.text,
    ).toBe('A captured answer.');
  });

  test('blocks every unhandled mutation before transport fallback', async () => {
    await expect(request('/paywall/entitlement-sync', 'POST', {})).rejects.toThrow(
      'blocked a real POST request',
    );
  });

  // Filming continuity: every fixture was captured under a scratch account, so
  // without the substitution the greeting cuts from the real name to "Demo" the
  // moment a scenario is selected.
  test('serves the real account name over the captured one', async () => {
    DemoMode.realUserName = 'Sam Rivers';
    resetDemoOverlayForTests();

    const response = await request('/users/profile');

    expect((response?.data as { name: string }).name).toBe('Sam Rivers');
    // Only the name is borrowed; the rest of the profile stays fictional.
    expect((response?.data as { userId: string }).userId).toBe('demo-user');
  });

  test('falls back to the captured name when no account is cached', async () => {
    DemoMode.realUserName = null;
    resetDemoOverlayForTests();

    const response = await request('/users/profile');

    expect((response?.data as { name: string }).name).toBe('Demo');
  });
});
