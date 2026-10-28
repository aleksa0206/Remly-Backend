import { Prisma, Relationship } from '@prisma/client';
import { prisma } from '../config/prismaClient';
import { catchUpDueDate } from '../utils/dates';
import { compact } from '../utils/queryParams';

export const CONTACT_SORTS = ['name', 'lastMet', 'catchUp'] as const;
export type ContactSort = (typeof CONTACT_SORTS)[number];

export type ContactFilters = {
  /** Matches first name, last name, nickname, email or phone. */
  search?: string | undefined;
  relationship?: Relationship | undefined;
  isFavorite?: boolean | undefined;
  isArchived?: boolean | undefined;
  /** Contacts whose catch-up date is on or before this day. */
  dueBy?: Date | undefined;
};

const ORDER_BY: Record<ContactSort, Prisma.ContactOrderByWithRelationInput[]> = {
  name: [{ firstName: 'asc' }, { lastName: 'asc' }, { id: 'asc' }],
  lastMet: [{ lastMetOn: { sort: 'desc', nulls: 'last' } }, { firstName: 'asc' }, { id: 'asc' }],
  catchUp: [{ catchUpDueOn: { sort: 'asc', nulls: 'last' } }, { firstName: 'asc' }, { id: 'asc' }],
};

export async function findAllContacts(
  userId: number,
  filters: ContactFilters,
  sort: ContactSort,
  pagination: { skip: number; take: number }
) {
  const where = compact({
    userId,
    relationship: filters.relationship,
    isFavorite: filters.isFavorite,
    isArchived: filters.isArchived,
    catchUpDueOn: filters.dueBy ? { lte: filters.dueBy } : undefined,
    OR: filters.search
      ? [
          { firstName: { contains: filters.search } },
          { lastName: { contains: filters.search } },
          { nickname: { contains: filters.search } },
          { email: { contains: filters.search } },
          { phone: { contains: filters.search } },
        ]
      : undefined,
  });
  const [data, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: ORDER_BY[sort],
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.contact.count({ where }),
  ]);
  return { data, total };
}

export async function findContactById(id: number) {
  return await prisma.contact.findUnique({ where: { id } });
}

/** How many of `ids` exist and belong to `userId`. */
export async function countOwnContacts(userId: number, ids: number[]) {
  return await prisma.contact.count({ where: { userId, id: { in: ids } } });
}

export async function countActiveContacts(userId: number) {
  return await prisma.contact.count({ where: { userId, isArchived: false } });
}

export async function findContactsWithBirthday(userId: number) {
  return await prisma.contact.findMany({
    where: { userId, isArchived: false, birthdayDay: { not: null }, birthdayMonth: { not: null } },
    orderBy: [{ birthdayMonth: 'asc' }, { birthdayDay: 'asc' }, { id: 'asc' }],
  });
}

/** Active contacts due for a catch-up by `dueBy` that have nothing planned yet, most overdue first. */
export async function findContactsToCatchUp(userId: number, dueBy: Date, take: number) {
  return await prisma.contact.findMany({
    where: { userId, isArchived: false, nextPlannedOn: null, catchUpDueOn: { lte: dueBy } },
    orderBy: [{ catchUpDueOn: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
    take,
  });
}

export type ContactData = {
  firstName: string;
  lastName: string | null;
  nickname: string | null;
  email: string | null;
  phone: string | null;
  relationship: Relationship;
  birthdayDay: number | null;
  birthdayMonth: number | null;
  birthdayYear: number | null;
  notes: string | null;
  catchUpEveryDays: number | null;
  isFavorite: boolean;
  isArchived: boolean;
};

export async function createContact(userId: number, data: Omit<ContactData, 'isArchived'>) {
  const createdAt = new Date();
  return await prisma.contact.create({
    data: {
      ...data,
      userId,
      createdAt,
      catchUpDueOn: catchUpDueDate(data.catchUpEveryDays, null, createdAt),
    },
  });
}

export async function updateContact(id: number, data: Partial<ContactData>) {
  return await prisma.$transaction(async (tx) => {
    const contact = await tx.contact.update({ where: { id }, data });
    if (data.catchUpEveryDays === undefined) {
      return contact;
    }
    return await tx.contact.update({
      where: { id },
      data: {
        catchUpDueOn: catchUpDueDate(
          contact.catchUpEveryDays,
          contact.lastMetOn,
          contact.createdAt
        ),
      },
    });
  });
}

/**
 * Deletes the contact and its place in every meeting; meetings left with nobody else in them
 * are deleted too, since a meeting without people means nothing.
 */
export async function removeContactWithMeetings(id: number) {
  return await prisma.$transaction(async (tx) => {
    const links = await tx.meetingContact.findMany({ where: { contactId: id } });
    await tx.meetingContact.deleteMany({ where: { contactId: id } });
    await tx.meeting.deleteMany({
      where: { id: { in: links.map((link) => link.meetingId) }, contacts: { none: {} } },
    });
    return await tx.contact.delete({ where: { id } });
  });
}

/**
 * Recomputes the meeting-derived dates of `contactIds` from their meetings. Must run in the same
 * transaction as any write that adds, removes, moves or changes the status of a meeting.
 */
export async function refreshMeetingDates(tx: Prisma.TransactionClient, contactIds: number[]) {
  for (const contactId of new Set(contactIds)) {
    const [lastDone, nextPlanned, contact] = await Promise.all([
      tx.meeting.findFirst({
        where: { status: 'Done', contacts: { some: { contactId } } },
        orderBy: { date: 'desc' },
        select: { date: true },
      }),
      tx.meeting.findFirst({
        where: { status: 'Planned', contacts: { some: { contactId } } },
        orderBy: { date: 'asc' },
        select: { date: true },
      }),
      tx.contact.findUniqueOrThrow({ where: { id: contactId } }),
    ]);
    const lastMetOn = lastDone?.date ?? null;
    await tx.contact.update({
      where: { id: contactId },
      data: {
        lastMetOn,
        nextPlannedOn: nextPlanned?.date ?? null,
        catchUpDueOn: catchUpDueDate(contact.catchUpEveryDays, lastMetOn, contact.createdAt),
      },
    });
  }
}
