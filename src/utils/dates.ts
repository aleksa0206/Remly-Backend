// All dates are calendar days stored as UTC midnight.

const DAY_MS = 24 * 60 * 60 * 1000;

export function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** The calendar day a point in time falls on (UTC). */
export function startOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * When the user should see a contact again: `everyDays` after the last meeting, or after the
 * contact was added if they have never met. Null when the contact has no catch-up interval.
 */
export function catchUpDueDate(
  everyDays: number | null,
  lastMetOn: Date | null,
  createdAt: Date
): Date | null {
  if (everyDays === null) {
    return null;
  }
  return addDays(lastMetOn ?? startOfDayUtc(createdAt), everyDays);
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Whether day/month exist in `year`, or in any year (Feb 29) when the year is unknown. */
export function isValidDayOfMonth(day: number, month: number, year: number | null): boolean {
  const daysInMonth = new Date(Date.UTC(year ?? 2000, month, 0)).getUTCDate();
  return day >= 1 && day <= daysInMonth;
}

/** The next birthday on or after `from`; Feb 29 falls on Feb 28 in common years. */
export function nextBirthday(day: number, month: number, from: Date): Date {
  const occurrence = (year: number) =>
    new Date(Date.UTC(year, month - 1, month === 2 && day === 29 && !isLeapYear(year) ? 28 : day));
  const thisYear = occurrence(from.getUTCFullYear());
  return thisYear >= from ? thisYear : occurrence(from.getUTCFullYear() + 1);
}
