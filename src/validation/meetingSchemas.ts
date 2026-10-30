import { z } from 'zod';
import { calendarDate, optionalText } from './common';

export const MEETING_TYPES = ['InPerson', 'Call', 'VideoCall', 'Message'] as const;
export const MEETING_STATUSES = ['Planned', 'Done', 'Cancelled'] as const;

const contactIds = z.array(z.number().int().positive()).min(1).max(50);
// Local time of day, "HH:MM".
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be a time in HH:MM format')
  .nullable()
  .optional();

const meetingFields = {
  contactIds,
  date: calendarDate,
  time,
  status: z.enum(MEETING_STATUSES).optional(),
  type: z.enum(MEETING_TYPES).optional(),
  title: optionalText(191),
  location: optionalText(191),
  notes: optionalText(5000),
};

export const createMeetingSchema = z.object(meetingFields);

export const updateMeetingSchema = z.object({
  ...meetingFields,
  contactIds: contactIds.optional(),
  date: calendarDate.optional(),
});

export const completeMeetingSchema = z.object({
  date: calendarDate.optional(),
  notes: optionalText(5000),
});
