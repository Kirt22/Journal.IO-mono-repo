import type { ThemeColors } from '../../theme/theme';

export type ScoreTier = {
  label: 'Low' | 'Balanced' | 'High' | 'Very High';
  color: string;
};

// Maps a 0-100 signal score to its tier tag + a theme-aware color. This is the
// user-facing per-region tag: derived purely from the displayed score with
// fixed ranges (Low 0-30, Balanced 31-50, High 51-75, Very High 76-100). It is
// intentionally separate from the backend's baseline-comparison `tier`, which
// still drives the overall reflective-style summary.
export function getScoreTier(score: number, colors: ThemeColors): ScoreTier {
  const value = Number.isFinite(score) ? score : 0;

  if (value <= 30) {
    return { label: 'Low', color: colors.mutedForeground };
  }
  if (value <= 50) {
    return { label: 'Balanced', color: colors.info };
  }
  if (value <= 75) {
    return { label: 'High', color: colors.primary };
  }
  return { label: 'Very High', color: colors.success };
}
