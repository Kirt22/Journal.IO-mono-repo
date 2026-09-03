import {
  ROW_SWIPE_CLAIM_DISTANCE,
  shouldClaimRowSwipe,
} from '../src/utils/rowSwipeGesture';

test('does not claim the jitter at the start of a vertical flick', () => {
  // The reported bug: 9px sideways with 6px vertical cleared the old 8px/1.2x
  // rule on the first move event, so the row took the responder and the list
  // stopped scrolling.
  expect(shouldClaimRowSwipe({ dx: 9, dy: 6 })).toBe(false);
  expect(shouldClaimRowSwipe({ dx: -9, dy: 6 })).toBe(false);
});

test('does not claim a diagonal drag', () => {
  expect(shouldClaimRowSwipe({ dx: 20, dy: 15 })).toBe(false);
  expect(shouldClaimRowSwipe({ dx: -30, dy: 20 })).toBe(false);
});

test('does not claim a straight vertical scroll', () => {
  expect(shouldClaimRowSwipe({ dx: 0, dy: 80 })).toBe(false);
  expect(shouldClaimRowSwipe({ dx: 3, dy: -120 })).toBe(false);
});

test('claims a committed horizontal swipe in either direction', () => {
  expect(shouldClaimRowSwipe({ dx: -25, dy: 5 })).toBe(true);
  expect(shouldClaimRowSwipe({ dx: 25, dy: 5 })).toBe(true);
  expect(shouldClaimRowSwipe({ dx: -60, dy: 20 })).toBe(true);
});

test('claims just past the distance threshold when travel is flat', () => {
  expect(shouldClaimRowSwipe({ dx: -ROW_SWIPE_CLAIM_DISTANCE, dy: 0 })).toBe(
    false,
  );
  expect(
    shouldClaimRowSwipe({ dx: -(ROW_SWIPE_CLAIM_DISTANCE + 1), dy: 0 }),
  ).toBe(true);
});
