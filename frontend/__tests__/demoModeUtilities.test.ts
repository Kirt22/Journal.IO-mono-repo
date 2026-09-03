import {
  materializeDateKey,
  materializeRelativeDates,
} from '../src/demo/dateMaterializer';
import {
  findNearestQuestionIndex,
  normalizeForMatch,
} from '../src/demo/fuzzyMatch';
import emotionalEating from '../src/demo/scenarios/emotional-eating.json';
import restIsGuilt from '../src/demo/scenarios/rest-is-guilt.json';
import sheLeft from '../src/demo/scenarios/she-left.json';

describe('Demo Mode utilities', () => {
  test('materializes relative dates across month boundaries', () => {
    const today = new Date(2026, 0, 2, 12, 0, 0);
    expect(materializeDateKey(-3, today)).toBe('2025-12-30');
    expect(
      materializeRelativeDates(
        {
          startDate: { $demoDate: { dayOffset: -3, format: 'dateKey' } },
          endDate: { $demoDate: { dayOffset: 0, format: 'dateKey' } },
          label: 'stale label',
        },
        today,
      ),
    ).toEqual({
      startDate: '2025-12-30',
      endDate: '2026-01-02',
      label: 'Dec 30 - Jan 2',
    });
  });

  test('normalizes punctuation and case before matching', () => {
    expect(normalizeForMatch("WHY do I keep eating—when I'm not hungry?!")).toBe(
      'why do i keep eating when i m not hungry',
    );
  });

  test('matches a typo and uses fallback for unrelated input', () => {
    const questions = [
      "why do I keep eating when I'm not hungry?",
      'what usually happens before I snack?',
    ];
    expect(findNearestQuestionIndex('why do i keep eeting when im not hungry', questions)).toBe(0);
    expect(findNearestQuestionIndex('tell me about the weather', questions)).toBe(-1);
  });

  // Filming guard. The question is typed live on camera, so a missed apostrophe
  // or a dropped word must not drop the take to the generic fallback answer.
  // Each case below is a real way a typed question drifts from the authored one.
  describe.each([
    ['emotional-eating', emotionalEating.askJadeQuestions],
    ['rest-is-guilt', restIsGuilt.askJadeQuestions],
    ['she-left', sheLeft.askJadeQuestions],
  ])('%s Ask Jade matching', (_scenarioId, questions: string[]) => {
    test('every authored question matches itself exactly', () => {
      questions.forEach((question, index) => {
        expect(findNearestQuestionIndex(question, questions)).toBe(index);
      });
    });

    test('case, spacing and punctuation drift still match', () => {
      questions.forEach((question, index) => {
        const shouted = question.toUpperCase();
        const stripped = question.replace(/[?'’.,!]/g, '');
        const padded = `  ${question.toLowerCase()}  `;

        expect(findNearestQuestionIndex(shouted, questions)).toBe(index);
        expect(findNearestQuestionIndex(stripped, questions)).toBe(index);
        expect(findNearestQuestionIndex(padded, questions)).toBe(index);
      });
    });
  });

  test.each([
    ['missing apostrophe', 'why do I keep eating when im not hungry', 0],
    ['capitalised', "Why do I keep eating when I'm not hungry?", 0],
    ['trailing space', "why do i keep eating when i'm not hungry ", 0],
    ['a typo', 'why do I keep eating when I\'m not hungy?', 0],
    ['shortened', 'what usually happens before a bad night', 1],
    ['dropped question mark', 'am I actually stressed or just tired', 2],
    ['no capitals at all', 'what set me off this month', 3],
    ['shortened again', 'what am I avoiding feeling', 4],
  ])(
    'live typing with %s reaches the captured answer',
    (_label, typed: string, expectedIndex: number) => {
      expect(
        findNearestQuestionIndex(typed, emotionalEating.askJadeQuestions),
      ).toBe(expectedIndex);
    },
  );

  test('an unrelated question still falls back rather than forcing a wrong answer', () => {
    // A forgiving matcher must stay honest: answering an off-script question
    // with a captured answer about eating would be worse on camera than the
    // generic fallback, which is written to work for anything.
    ['how do I export my data', 'what is the weather tomorrow', 'hello'].forEach(
      input => {
        expect(
          findNearestQuestionIndex(input, emotionalEating.askJadeQuestions),
        ).toBe(-1);
      },
    );
  });
});
