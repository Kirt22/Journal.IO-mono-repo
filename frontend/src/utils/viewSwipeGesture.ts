/**
 * Shared detection for the full-width horizontal swipes that switch a screen's
 * view (Insights: Overview <-> AI Analysis, Calendar: calendar <-> list).
 *
 * Both screens previously measured the gesture with `locationX` / `locationY`,
 * which are relative to the node that received the touch — and start and end
 * routinely land on different children, while a scrolling ScrollView also moves
 * the content under the finger. The two readings therefore came from different
 * coordinate spaces, so the delta was not a distance at all and the `> 40`
 * guard protected nothing. `pageX` / `pageY` are absolute screen coordinates,
 * which is the actual fix; the thresholds below are hardening on top of it.
 *
 * The swipe zone is a plain View inside a vertical ScrollView, and touch events
 * fire there even while that ScrollView is panning — so a caller must also pass
 * `scrolled` when the page moved during the gesture. Distance and direction
 * alone cannot tell a deliberate sideways swipe from a slightly diagonal flick.
 */
export const VIEW_SWIPE_MIN_DISTANCE = 64;
export const VIEW_SWIPE_DOMINANCE_RATIO = 2;
export const VIEW_SWIPE_MAX_DURATION_MS = 700;

export type ViewSwipePoint = {
  x: number;
  y: number;
  at: number;
};

export type ViewSwipeTouchEvent = {
  nativeEvent: {
    pageX: number;
    pageY: number;
  };
};

export const readViewSwipePoint = (
  event: ViewSwipeTouchEvent,
  at: number,
): ViewSwipePoint => ({
  x: event.nativeEvent.pageX,
  y: event.nativeEvent.pageY,
  at,
});

/**
 * `left` means the finger travelled leftwards (advance to the next view).
 * Returns null for anything that is not unambiguously a horizontal swipe.
 */
export const resolveViewSwipe = ({
  start,
  end,
  scrolled,
}: {
  start: ViewSwipePoint | null;
  end: ViewSwipePoint;
  scrolled: boolean;
}): 'left' | 'right' | null => {
  if (!start || scrolled) {
    return null;
  }

  if (end.at - start.at > VIEW_SWIPE_MAX_DURATION_MS) {
    return null;
  }

  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (Math.abs(dx) < VIEW_SWIPE_MIN_DISTANCE) {
    return null;
  }

  if (Math.abs(dx) < Math.abs(dy) * VIEW_SWIPE_DOMINANCE_RATIO) {
    return null;
  }

  return dx < 0 ? 'left' : 'right';
};
