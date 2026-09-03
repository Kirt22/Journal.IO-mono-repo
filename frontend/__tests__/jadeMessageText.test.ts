/**
 * @format
 */

import { jadeMessageToPlainText } from '../src/utils/jadeMessageText';

test('falls back to the message text when there are no blocks', () => {
  expect(
    jadeMessageToPlainText({ text: 'Your evenings look calmer lately.' }),
  ).toBe('Your evenings look calmer lately.');
});

test('copies the prose and the rendered blocks in the order they appear', () => {
  const copied = jadeMessageToPlainText({
    text: 'ignored fallback',
    blocks: [
      { type: 'text', text: 'Three things keep showing up.' },
      {
        type: 'list',
        style: 'numbered',
        items: ['Late nights', 'Skipped lunches'],
      },
      {
        type: 'stats',
        title: 'Last 30 days',
        dataState: 'ready',
        updatedAt: null,
        items: [{ label: 'Entries', value: '18' }],
      },
    ],
  });

  expect(copied).toBe(
    [
      'Three things keep showing up.',
      '',
      '1. Late nights',
      '2. Skipped lunches',
      '',
      'Last 30 days',
      'Entries: 18',
    ].join('\n'),
  );
});

test('flattens charts to their labelled values', () => {
  const copied = jadeMessageToPlainText({
    text: 'Here is the shape of your week.',
    blocks: [
      { type: 'text', text: 'Here is the shape of your week.' },
      {
        type: 'mood_trend',
        title: 'Mood, last 7 days',
        dataState: 'ready',
        updatedAt: null,
        rangeDays: 7,
        points: [
          { dateKey: '2026-08-01', label: 'Mon', mood: 'good', score: 4 },
          { dateKey: '2026-08-02', label: 'Tue', mood: null, score: null },
        ],
      },
      {
        type: 'activity',
        title: 'Entries this week',
        dataState: 'ready',
        updatedAt: null,
        rangeDays: 7,
        points: [{ dateKey: '2026-08-01', label: 'Monday', count: 2 }],
      },
    ],
  });

  expect(copied).toBe(
    [
      'Here is the shape of your week.',
      '',
      'Mood, last 7 days',
      'Mon: good',
      '',
      'Entries this week',
      'Monday: 2 entries',
    ].join('\n'),
  );
});

test('leaves out blocks with no data rather than copying a bare title', () => {
  const copied = jadeMessageToPlainText({
    text: 'Not enough to go on yet.',
    blocks: [
      { type: 'text', text: 'Not enough to go on yet.' },
      {
        type: 'mood_distribution',
        title: 'Mood mix',
        dataState: 'empty',
        updatedAt: null,
        range: '30d',
        segments: [],
      },
    ],
  });

  expect(copied).toBe('Not enough to go on yet.');
});
