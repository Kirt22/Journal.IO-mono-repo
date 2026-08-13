/**
 * The preset reminder times offered across the app.
 *
 * Journal.IO never uses a native time picker — every time choice is a themed
 * dropdown of presets. Extracted from RemindersScreen so the goal sheet and the
 * daily-journal reminder screen can't drift apart.
 */
export const REMINDER_TIME_OPTIONS = [
  { label: '8:00 AM', value: '08:00' },
  { label: '9:00 AM', value: '09:00' },
  { label: '12:00 PM', value: '12:00' },
  { label: '6:00 PM', value: '18:00' },
  { label: '8:00 PM', value: '20:00' },
  { label: '9:00 PM', value: '21:00' },
] as const;

export const DEFAULT_REMINDER_TIME = '20:00';

/** Formats an "HH:mm" value for display, falling back to a 12-hour render. */
export const formatReminderTime = (time: string | null | undefined): string => {
  if (!time) {
    return '';
  }

  const preset = REMINDER_TIME_OPTIONS.find(option => option.value === time);

  if (preset) {
    return preset.label;
  }

  const [rawHour, rawMinute] = time.split(':');
  const hour = Number(rawHour);

  if (!Number.isFinite(hour)) {
    return time;
  }

  const period = hour >= 12 ? 'PM' : 'AM';

  return `${hour % 12 || 12}:${rawMinute ?? '00'} ${period}`;
};
