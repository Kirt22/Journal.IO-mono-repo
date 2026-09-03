import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertAuthoredScenario,
  assertScratchCaptureEnvironment,
  normalizeCapturedDates,
} from './demo-fixture-utils.mjs';

const validScenario = () => ({
  id: 'test-scenario',
  fictional: true,
  entries: Array.from({ length: 30 }, (_, index) => ({
    dayOffset: index - 29,
    timeOfDay: '20:15',
    mood: 3,
    answers: ['one', 'two', 'three'],
  })),
  askJadeQuestions: ['one?', 'two?', 'three?'],
  askJadeFallbackQuestion: 'What stands out?',
  filmingEntryDayOffset: 0,
  goalSourceDayOffset: -12,
});

test('capture environment accepts only a dedicated non-production database', () => {
  const uri = 'mongodb://localhost:27017/journal_io_demo_capture_test';
  assert.equal(
    assertScratchCaptureEnvironment({ env: { NODE_ENV: 'development' }, uri }),
    'journal_io_demo_capture_test',
  );
  assert.throws(() =>
    assertScratchCaptureEnvironment({ env: { NODE_ENV: 'production' }, uri }),
  );
  assert.throws(() =>
    assertScratchCaptureEnvironment({
      env: { NODE_ENV: 'development' },
      uri: 'mongodb://localhost:27017/journal_io',
    }),
  );
});

test('scenario validation requires every offset and fictional content', () => {
  assert.doesNotThrow(() => assertAuthoredScenario(validScenario()));
  const missingDay = validScenario();
  missingDay.entries.pop();
  assert.throws(() => assertAuthoredScenario(missingDay));
  const notFictional = validScenario();
  notFictional.fictional = false;
  assert.throws(() => assertAuthoredScenario(notFictional));
});

test('captured dates become relative fixture tokens', () => {
  const anchor = new Date(2026, 7, 24, 12, 0, 0);
  const normalized = normalizeCapturedDates(
    {
      dateKey: '2026-08-23',
      timestamp: new Date(2026, 7, 22, 21, 30, 0),
    },
    anchor,
  );
  assert.equal(normalized.dateKey.$demoDate.dayOffset, -1);
  assert.equal(normalized.dateKey.$demoDate.format, 'dateKey');
  assert.equal(normalized.timestamp.$demoDate.dayOffset, -2);
  assert.equal(normalized.timestamp.$demoDate.timeOfDay, '21:30');
});
