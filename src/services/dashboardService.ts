import * as contactRepository from '../repositories/contactRepository';
import * as meetingRepository from '../repositories/meetingRepository';
import * as contactService from './contactService';
import { addDays } from '../utils/dates';

const UPCOMING_DAYS = 14;
const CATCH_UP_DAYS = 7;
const BIRTHDAY_DAYS = 30;
const LIST_SIZE = 10;

/**
 * Everything the overview screen needs in one request. `today` is the user's calendar day,
 * which can differ from the server's UTC day.
 */
export async function getDashboard(userId: number, today: Date) {
  const [upcoming, catchUp, birthdays, recent, contactCount, metLast30Days] = await Promise.all([
    // Includes planned meetings whose day has passed without being marked done.
    meetingRepository.findAllMeetings(
      userId,
      { status: ['Planned'], to: addDays(today, UPCOMING_DAYS) },
      'asc',
      { skip: 0, take: LIST_SIZE * 2 }
    ),
    contactRepository.findContactsToCatchUp(userId, addDays(today, CATCH_UP_DAYS), LIST_SIZE),
    contactService.getUpcomingBirthdays(userId, today, BIRTHDAY_DAYS),
    meetingRepository.findAllMeetings(userId, { status: ['Done'] }, 'desc', {
      skip: 0,
      take: 5,
    }),
    contactRepository.countActiveContacts(userId),
    meetingRepository.countMeetings(userId, 'Done', addDays(today, -30), today),
  ]);

  return {
    upcoming: upcoming.data,
    catchUp,
    birthdays: birthdays.slice(0, LIST_SIZE),
    recent: recent.data,
    stats: { contacts: contactCount, plannedTotal: upcoming.total, metLast30Days },
  };
}
