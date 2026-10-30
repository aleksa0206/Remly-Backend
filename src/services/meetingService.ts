import { MeetingStatus, MeetingType } from '@prisma/client';
import * as meetingRepository from '../repositories/meetingRepository';
import * as contactRepository from '../repositories/contactRepository';
import { NotFoundError } from '../errors/NotFoundError';
import { ForbiddenError } from '../errors/ForbiddenError';
import { ConflictError } from '../errors/ConflictError';
import { ValidationError } from '../errors/ValidationError';
import { addDays, todayUtc } from '../utils/dates';
import { compact } from '../utils/queryParams';

export type MeetingInput = {
  contactIds?: number[] | undefined;
  date?: Date | undefined;
  time?: string | null | undefined;
  status?: MeetingStatus | undefined;
  type?: MeetingType | undefined;
  title?: string | null | undefined;
  location?: string | null | undefined;
  notes?: string | null | undefined;
};

export async function getAllMeetings(
  userId: number,
  filters: meetingRepository.MeetingFilters,
  order: 'asc' | 'desc',
  pagination: { skip: number; take: number }
) {
  return await meetingRepository.findAllMeetings(userId, filters, order, pagination);
}

export async function getMeetingById(meetingId: number, userId: number) {
  const meeting = await meetingRepository.findMeetingById(meetingId);
  if (!meeting) {
    throw new NotFoundError('Meeting');
  }
  if (meeting.userId !== userId) {
    throw new ForbiddenError();
  }
  return meeting;
}

async function assertOwnContacts(contactIds: number[], userId: number): Promise<number[]> {
  const unique = [...new Set(contactIds)];
  if ((await contactRepository.countOwnContacts(userId, unique)) !== unique.length) {
    throw new ForbiddenError('Meetings can only include your own contacts');
  }
  return unique;
}

// The server's "today" is UTC; one day of slack keeps users east of Greenwich from being
// rejected when they log a meeting from earlier today.
function assertNotDoneInFuture(status: MeetingStatus, date: Date) {
  if (status === 'Done' && date > addDays(todayUtc(), 1)) {
    throw new ValidationError('date: a meeting that has not happened yet cannot be done', [
      { path: 'date', message: 'a meeting that has not happened yet cannot be done' },
    ]);
  }
}

export async function createMeeting(
  input: MeetingInput & { contactIds: number[]; date: Date },
  userId: number
) {
  const contactIds = await assertOwnContacts(input.contactIds, userId);
  const status = input.status ?? 'Done';
  assertNotDoneInFuture(status, input.date);

  return await meetingRepository.createMeeting(
    userId,
    {
      status,
      type: input.type ?? 'InPerson',
      date: input.date,
      time: input.time ?? null,
      title: input.title ?? null,
      location: input.location ?? null,
      notes: input.notes ?? null,
    },
    contactIds
  );
}

export async function updateMeeting(meetingId: number, input: MeetingInput, userId: number) {
  const meeting = await getMeetingById(meetingId, userId);
  const contactIds = input.contactIds
    ? await assertOwnContacts(input.contactIds, userId)
    : undefined;
  assertNotDoneInFuture(input.status ?? meeting.status, input.date ?? meeting.date);

  const { contactIds: _ignored, ...fields } = input;
  return await meetingRepository.updateMeeting(meetingId, compact(fields), contactIds);
}

/** Planned → Done. Defaults to the planned day, or today if that is still ahead. */
export async function completeMeeting(
  meetingId: number,
  input: { date?: Date | undefined; notes?: string | null | undefined },
  userId: number
) {
  const meeting = await getMeetingById(meetingId, userId);
  if (meeting.status !== 'Planned') {
    throw new ConflictError('Only a planned meeting can be completed');
  }
  const today = todayUtc();
  const date = input.date ?? (meeting.date > today ? today : meeting.date);
  assertNotDoneInFuture('Done', date);

  const completed = await meetingRepository.completeMeeting(meetingId, {
    date,
    ...compact({ notes: input.notes }),
  });
  if (!completed) {
    throw new ConflictError('Only a planned meeting can be completed');
  }
  return completed;
}

export async function deleteMeeting(meetingId: number, userId: number) {
  await getMeetingById(meetingId, userId);
  return await meetingRepository.removeMeeting(meetingId);
}
