import { MeetingStatus, MeetingType, Prisma } from '@prisma/client';
import { prisma } from '../config/prismaClient';
import { compact } from '../utils/queryParams';
import { refreshMeetingDates } from './contactRepository';

const meetingInclude = {
  contacts: {
    select: { contact: { select: { id: true, firstName: true, lastName: true, nickname: true } } },
    orderBy: { contactId: 'asc' },
  },
} as const;

type MeetingRow = Prisma.MeetingGetPayload<{ include: typeof meetingInclude }>;

// The join table is an implementation detail: clients get `contacts: [{ id, firstName, ... }]`.
function toMeeting(row: MeetingRow) {
  return { ...row, contacts: row.contacts.map((link) => link.contact) };
}

export type MeetingFilters = {
  status?: MeetingStatus[] | undefined;
  contactId?: number | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
};

/** `asc` lists what is coming up first; `desc` lists the most recent first. */
export async function findAllMeetings(
  userId: number,
  filters: MeetingFilters,
  order: 'asc' | 'desc',
  pagination: { skip: number; take: number }
) {
  const where = compact({
    userId,
    status: filters.status ? { in: filters.status } : undefined,
    contacts: filters.contactId ? { some: { contactId: filters.contactId } } : undefined,
    date: filters.from || filters.to ? compact({ gte: filters.from, lte: filters.to }) : undefined,
  });
  const [rows, total] = await Promise.all([
    prisma.meeting.findMany({
      where,
      include: meetingInclude,
      orderBy: [{ date: order }, { time: order }, { id: order }],
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.meeting.count({ where }),
  ]);
  return { data: rows.map(toMeeting), total };
}

export async function findMeetingById(id: number) {
  const row = await prisma.meeting.findUnique({ where: { id }, include: meetingInclude });
  return row ? toMeeting(row) : null;
}

export async function countMeetings(userId: number, status: MeetingStatus, from: Date, to: Date) {
  return await prisma.meeting.count({ where: { userId, status, date: { gte: from, lte: to } } });
}

export type MeetingData = {
  status: MeetingStatus;
  type: MeetingType;
  date: Date;
  time: string | null;
  title: string | null;
  location: string | null;
  notes: string | null;
};

export async function createMeeting(userId: number, data: MeetingData, contactIds: number[]) {
  return await prisma.$transaction(async (tx) => {
    const meeting = await tx.meeting.create({
      data: {
        ...data,
        userId,
        contacts: { create: contactIds.map((contactId) => ({ contactId })) },
      },
    });
    await refreshMeetingDates(tx, contactIds);
    return toMeeting(
      await tx.meeting.findUniqueOrThrow({ where: { id: meeting.id }, include: meetingInclude })
    );
  });
}

/** `contactIds`, when given, replaces the people in the meeting. */
export async function updateMeeting(
  id: number,
  data: Partial<MeetingData>,
  contactIds: number[] | undefined
) {
  return await prisma.$transaction(async (tx) => {
    const previous = await tx.meetingContact.findMany({ where: { meetingId: id } });
    if (contactIds) {
      await tx.meetingContact.deleteMany({ where: { meetingId: id } });
      await tx.meetingContact.createMany({
        data: contactIds.map((contactId) => ({ meetingId: id, contactId })),
      });
    }
    await tx.meeting.update({ where: { id }, data });
    await refreshMeetingDates(tx, [
      ...previous.map((link) => link.contactId),
      ...(contactIds ?? []),
    ]);
    return toMeeting(
      await tx.meeting.findUniqueOrThrow({ where: { id }, include: meetingInclude })
    );
  });
}

/**
 * Marks a planned meeting as done. Guarded on the row still being planned, so a double submit
 * cannot complete it twice; returns null when it no longer was.
 */
export async function completeMeeting(id: number, data: { date: Date; notes?: string | null }) {
  return await prisma.$transaction(async (tx) => {
    const result = await tx.meeting.updateMany({
      where: { id, status: 'Planned' },
      data: { ...data, status: 'Done' },
    });
    if (result.count !== 1) {
      return null;
    }
    const links = await tx.meetingContact.findMany({ where: { meetingId: id } });
    await refreshMeetingDates(
      tx,
      links.map((link) => link.contactId)
    );
    return toMeeting(
      await tx.meeting.findUniqueOrThrow({ where: { id }, include: meetingInclude })
    );
  });
}

export async function removeMeeting(id: number) {
  return await prisma.$transaction(async (tx) => {
    const links = await tx.meetingContact.findMany({ where: { meetingId: id } });
    await tx.meetingContact.deleteMany({ where: { meetingId: id } });
    const meeting = await tx.meeting.delete({ where: { id } });
    await refreshMeetingDates(
      tx,
      links.map((link) => link.contactId)
    );
    return meeting;
  });
}
