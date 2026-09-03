import type { DemoDateToken } from './demoTypes';

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const startOfLocalDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate());

const addLocalDays = (value: Date, amount: number) => {
  const next = new Date(value);
  next.setDate(next.getDate() + amount);
  return next;
};

const toDateKey = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const dateForOffset = (
  dayOffset: number,
  timeOfDay = '12:00',
  today = new Date(),
) => {
  const [hour, minute, second = '00'] = timeOfDay.split(':');
  const date = addLocalDays(startOfLocalDay(today), dayOffset);
  date.setHours(Number(hour), Number(minute), Number(second), 0);
  return date;
};

const materializeDateToken = (token: DemoDateToken, today: Date) => {
  const { dayOffset, format, timeOfDay } = token.$demoDate;
  const date = dateForOffset(dayOffset, timeOfDay, today);
  return format === 'dateKey' ? toDateKey(date) : date.toISOString();
};

const isDateToken = (value: unknown): value is DemoDateToken =>
  Boolean(
    value &&
      typeof value === 'object' &&
      '$demoDate' in value &&
      typeof (value as DemoDateToken).$demoDate?.dayOffset === 'number',
  );

const formatRangeLabel = (startDate: string, endDate: string) => {
  if (!DATE_KEY_PATTERN.test(startDate) || !DATE_KEY_PATTERN.test(endDate)) {
    return null;
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  const start = new Date(`${startDate}T12:00:00.000Z`);
  const end = new Date(`${endDate}T12:00:00.000Z`);
  return `${formatter.format(start)} - ${formatter.format(end)}`;
};

export const materializeRelativeDates = <T>(
  value: T,
  today = new Date(),
): T => {
  if (isDateToken(value)) {
    return materializeDateToken(value, today) as T;
  }

  if (Array.isArray(value)) {
    return value.map(item => materializeRelativeDates(item, today)) as T;
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const result = Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      materializeRelativeDates(item, today),
    ]),
  ) as Record<string, unknown>;

  if (
    typeof result.startDate === 'string' &&
    typeof result.endDate === 'string' &&
    typeof result.label === 'string'
  ) {
    result.label =
      formatRangeLabel(result.startDate, result.endDate) || result.label;
  }

  if (
    typeof result.dateKey === 'string' &&
    DATE_KEY_PATTERN.test(result.dateKey) &&
    typeof result.label === 'string'
  ) {
    result.label = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      timeZone: 'UTC',
    }).format(new Date(`${result.dateKey}T12:00:00.000Z`));
  }

  return result as T;
};

export const materializeDayOffset = (
  dayOffset: number,
  timeOfDay = '12:00',
  today = new Date(),
) => dateForOffset(dayOffset, timeOfDay, today).toISOString();

export const materializeDateKey = (dayOffset: number, today = new Date()) =>
  toDateKey(dateForOffset(dayOffset, '12:00', today));
