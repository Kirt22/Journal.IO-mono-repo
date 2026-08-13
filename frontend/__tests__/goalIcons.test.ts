/**
 * Mirror of `backend/src/helpers/goalIcons.helpers.test.ts`. Keeps the duplicated
 * matcher honest and pins the emoji-safety constraint that `EmojiWithFallback`
 * exists to work around.
 */
import {
  DEFAULT_GOAL_ICON,
  GOAL_ICON_EMOJI,
  GOAL_ICON_KEYS,
  GOAL_ICON_PICKER_ORDER,
  getGoalIconEmoji,
  isGoalIconKey,
  resolveGoalIcon,
  resolveUniqueGoalIcon,
} from '../src/constants/goalIcons';

test('every key has an emoji and the picker subset is valid', () => {
  expect(new Set(GOAL_ICON_KEYS).size).toBe(GOAL_ICON_KEYS.length);
  expect(Object.keys(GOAL_ICON_EMOJI).sort()).toEqual([...GOAL_ICON_KEYS].sort());
  expect(GOAL_ICON_PICKER_ORDER.every(key => isGoalIconKey(key))).toBe(true);
  expect(new Set(GOAL_ICON_PICKER_ORDER).size).toBe(GOAL_ICON_PICKER_ORDER.length);
  expect(GOAL_ICON_PICKER_ORDER).not.toContain('target');
});

test('no emoji uses a ZWJ sequence or variation selector', () => {
  // These are the glyphs iOS 26.3-debug and iPad drop. A regression here means
  // goal rows silently render tofu on affected builds.
  for (const [key, emoji] of Object.entries(GOAL_ICON_EMOJI)) {
    expect(emoji).not.toContain('‍'); // ZWJ
    expect(emoji).not.toContain('️'); // VS16
    expect([...emoji]).toHaveLength(1);
    expect(key).toBeTruthy();
  }
});

test('getGoalIconEmoji falls back for unknown keys', () => {
  expect(getGoalIconEmoji('peach')).toBe('🍑');
  expect(getGoalIconEmoji('unicorn')).toBe(GOAL_ICON_EMOJI[DEFAULT_GOAL_ICON]);
  expect(getGoalIconEmoji(undefined)).toBe(GOAL_ICON_EMOJI[DEFAULT_GOAL_ICON]);
});

test('resolveGoalIcon matches plain subjects', () => {
  const cases: ReadonlyArray<[string, string]> = [
    ['Run three times a week', 'run'],
    ['Walk after dinner', 'walk'],
    ['Go to the gym on Tuesdays', 'gym'],
    ['Sleep before midnight', 'sleep'],
    ['Drink more water', 'water'],
    ['Code with brother weekly', 'code'],
    ['Read ten pages', 'read'],
    ['Call mum on Sunday', 'family'],
    ['Call the dentist back', 'call'],
    ['Meditate for five minutes', 'meditate'],
    ['Journal every evening', 'journal'],
  ];

  for (const [title, expected] of cases) {
    expect(resolveGoalIcon(title)).toBe(expected);
  }
});

test('resolveGoalIcon does not substring-match inside longer words', () => {
  expect(resolveGoalIcon('Host brunch for friends')).toBe('friends');

  for (const title of [
    'Fix the changer cable',
    'Already enough for today',
    'Start a new habit',
  ]) {
    const icon = resolveGoalIcon(title);
    expect(isGoalIconKey(icon)).toBe(true);
    expect(resolveGoalIcon(title)).toBe(icon);
  }
});

test('resolveGoalIcon prefers the more specific key', () => {
  expect(resolveGoalIcon('Less social media at night')).toBe('social_media');
  expect(resolveGoalIcon('Cut back on screen time')).toBe('phone');
  expect(resolveGoalIcon('Quit vaping')).toBe('smoking');
  expect(resolveGoalIcon('Track my spending')).toBe('spending');
  expect(resolveGoalIcon('Eat more vegetables')).toBe('veggie');
});

test('resolveGoalIcon ignores the direction of the intent', () => {
  expect(resolveGoalIcon('Cut down on coffee')).toBe('coffee');
  expect(resolveGoalIcon('More coffee mornings')).toBe('coffee');
});

test('resolveGoalIcon gives non-empty generic titles a stable varied icon', () => {
  expect(resolveGoalIcon('Zyzzyx qwertyuiop')).not.toBe(DEFAULT_GOAL_ICON);
  expect(resolveGoalIcon('Zyzzyx qwertyuiop')).toBe(
    resolveGoalIcon('Zyzzyx qwertyuiop'),
  );
  expect(resolveGoalIcon('')).toBe(DEFAULT_GOAL_ICON);
  expect(resolveGoalIcon('   ')).toBe(DEFAULT_GOAL_ICON);
  expect(resolveGoalIcon(undefined as never)).toBe(DEFAULT_GOAL_ICON);
});

test('resolveUniqueGoalIcon avoids an icon already in use', () => {
  expect(resolveUniqueGoalIcon('Journal at night', ['journal'])).not.toBe(
    'journal',
  );
});
