import { Relationship } from '@prisma/client';
import * as contactRepository from '../repositories/contactRepository';
import { NotFoundError } from '../errors/NotFoundError';
import { ForbiddenError } from '../errors/ForbiddenError';
import { addDays, nextBirthday } from '../utils/dates';
import { compact } from '../utils/queryParams';

type BirthdayInput = { day: number; month: number; year?: number | null | undefined } | null;

export type ContactInput = {
  firstName?: string | undefined;
  lastName?: string | null | undefined;
  nickname?: string | null | undefined;
  email?: string | null | undefined;
  phone?: string | null | undefined;
  relationship?: Relationship | undefined;
  birthday?: BirthdayInput | undefined;
  notes?: string | null | undefined;
  catchUpEveryDays?: number | null | undefined;
  isFavorite?: boolean | undefined;
  isArchived?: boolean | undefined;
};

export async function getAllContacts(
  userId: number,
  filters: contactRepository.ContactFilters,
  sort: contactRepository.ContactSort,
  pagination: { skip: number; take: number }
) {
  return await contactRepository.findAllContacts(userId, filters, sort, pagination);
}

export async function getContactById(contactId: number, userId: number) {
  const contact = await contactRepository.findContactById(contactId);
  if (!contact) {
    throw new NotFoundError('Contact');
  }
  if (contact.userId !== userId) {
    throw new ForbiddenError();
  }
  return contact;
}

function birthdayColumns(birthday: BirthdayInput) {
  return {
    birthdayDay: birthday?.day ?? null,
    birthdayMonth: birthday?.month ?? null,
    birthdayYear: birthday?.year ?? null,
  };
}

export async function createContact(input: ContactInput & { firstName: string }, userId: number) {
  return await contactRepository.createContact(userId, {
    firstName: input.firstName,
    lastName: input.lastName ?? null,
    nickname: input.nickname ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    relationship: input.relationship ?? 'Friend',
    ...birthdayColumns(input.birthday ?? null),
    notes: input.notes ?? null,
    catchUpEveryDays: input.catchUpEveryDays ?? null,
    isFavorite: input.isFavorite ?? false,
  });
}

export async function updateContact(contactId: number, input: ContactInput, userId: number) {
  await getContactById(contactId, userId);
  const { birthday, ...fields } = input;
  return await contactRepository.updateContact(contactId, {
    ...compact(fields),
    ...(birthday !== undefined ? birthdayColumns(birthday) : {}),
  });
}

export async function deleteContact(contactId: number, userId: number) {
  await getContactById(contactId, userId);
  return await contactRepository.removeContactWithMeetings(contactId);
}

/** Birthdays from `today` up to `days` ahead, soonest first, with the age they turn if known. */
export async function getUpcomingBirthdays(userId: number, today: Date, days: number) {
  const until = addDays(today, days);
  const contacts = await contactRepository.findContactsWithBirthday(userId);
  return contacts
    .map((contact) => {
      const date = nextBirthday(contact.birthdayDay!, contact.birthdayMonth!, today);
      const turns = contact.birthdayYear ? date.getUTCFullYear() - contact.birthdayYear : null;
      return { contact, date, turns };
    })
    .filter((birthday) => birthday.date <= until)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}
