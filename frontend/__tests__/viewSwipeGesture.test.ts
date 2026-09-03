import {
  readViewSwipePoint,
  resolveViewSwipe,
  VIEW_SWIPE_MAX_DURATION_MS,
} from '../src/utils/viewSwipeGesture';

const point = (x: number, y: number, at: number) =>
  readViewSwipePoint({ nativeEvent: { pageX: x, pageY: y } }, at);

const swipe = ({
  from,
  to,
  duration = 200,
  scrolled = false,
}: {
  from: [number, number];
  to: [number, number];
  duration?: number;
  scrolled?: boolean;
}) =>
  resolveViewSwipe({
    start: point(from[0], from[1], 1000),
    end: point(to[0], to[1], 1000 + duration),
    scrolled,
  });

test('resolves a committed horizontal swipe in both directions', () => {
  expect(swipe({ from: [300, 400], to: [200, 410] })).toBe('left');
  expect(swipe({ from: [200, 400], to: [300, 410] })).toBe('right');
});

test('ignores a drag that is too short', () => {
  expect(swipe({ from: [300, 400], to: [260, 400] })).toBeNull();
});

test('ignores a diagonal drag', () => {
  // Passed the old rule, which only required |dx| > |dy|.
  expect(swipe({ from: [300, 400], to: [230, 450] })).toBeNull();
});

test('ignores a gesture during which the page scrolled', () => {
  expect(swipe({ from: [300, 400], to: [200, 410], scrolled: true })).toBeNull();
});

test('ignores a slow drag that is not a swipe', () => {
  expect(
    swipe({
      from: [300, 400],
      to: [200, 410],
      duration: VIEW_SWIPE_MAX_DURATION_MS + 1,
    }),
  ).toBeNull();
});

test('ignores an end event with no recorded start', () => {
  expect(
    resolveViewSwipe({
      start: null,
      end: point(200, 400, 1000),
      scrolled: false,
    }),
  ).toBeNull();
});
