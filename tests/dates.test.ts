import { catchUpDueDate, isValidDayOfMonth, nextBirthday } from '../src/utils/dates';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('date helpers', () => {
  it('catchUpDueDate counts from the last meeting, or from when the contact was added', () => {
    expect(catchUpDueDate(null, day('2026-10-01'), day('2026-01-01'))).toBeNull();
    expect(catchUpDueDate(30, day('2026-10-01'), day('2026-01-01'))).toEqual(day('2026-10-31'));
    expect(catchUpDueDate(7, null, new Date('2026-10-01T18:45:00.000Z'))).toEqual(
      day('2026-10-08')
    );
  });

  it('nextBirthday is this year if still ahead, otherwise next year', () => {
    expect(nextBirthday(10, 11, day('2026-11-05'))).toEqual(day('2026-11-10'));
    expect(nextBirthday(5, 11, day('2026-11-05'))).toEqual(day('2026-11-05'));
    expect(nextBirthday(1, 3, day('2026-11-05'))).toEqual(day('2027-03-01'));
  });

  it('nextBirthday moves Feb 29 to Feb 28 in common years', () => {
    expect(nextBirthday(29, 2, day('2026-11-05'))).toEqual(day('2027-02-28'));
    expect(nextBirthday(29, 2, day('2027-11-05'))).toEqual(day('2028-02-29'));
  });

  it('isValidDayOfMonth accepts Feb 29 only without a year or in a leap year', () => {
    expect(isValidDayOfMonth(29, 2, null)).toBe(true);
    expect(isValidDayOfMonth(29, 2, 2024)).toBe(true);
    expect(isValidDayOfMonth(29, 2, 2026)).toBe(false);
    expect(isValidDayOfMonth(31, 4, null)).toBe(false);
  });
});
