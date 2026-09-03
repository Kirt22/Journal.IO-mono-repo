/**
 * Shared claim rule for swipe-left-to-reveal rows.
 *
 * Every row that reveals a tray (entry cards, goals, widgets, Jade sessions)
 * sits inside a vertical ScrollView, so its PanResponder and that ScrollView are
 * competing for the same touch. The row used to claim after 8px of horizontal
 * movement with `dx` only needing to beat `dy` by 1.2x — below the slop a finger
 * produces at the start of a vertical flick. On the first move event `dx` can be
 * 9 while `dy` is still 6, which passed both tests: the row took the responder
 * and the list stopped scrolling.
 *
 * The numbers below are deliberately asymmetric. `dy` must stay under 9px at the
 * moment `dx` reaches 18px, which a sideways drag clears easily and the opening
 * of a vertical scroll does not.
 *
 * This lived in four copies and had already drifted (1.2x in three places, 1.3x
 * in GoalRow). One definition means the next tuning pass is one edit — and
 * ROW_SWIPE_CLAIM_DISTANCE is the knob to turn first if a deliberate swipe ever
 * starts to feel stiff.
 */
export const ROW_SWIPE_CLAIM_DISTANCE = 18;
export const ROW_SWIPE_DOMINANCE_RATIO = 2;

export type RowSwipeGesture = {
  dx: number;
  dy: number;
};

export const shouldClaimRowSwipe = (gesture: RowSwipeGesture): boolean =>
  Math.abs(gesture.dx) > ROW_SWIPE_CLAIM_DISTANCE &&
  Math.abs(gesture.dx) > Math.abs(gesture.dy) * ROW_SWIPE_DOMINANCE_RATIO;
