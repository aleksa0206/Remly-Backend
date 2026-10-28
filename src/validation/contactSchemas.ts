import { z } from 'zod';
import { optionalText } from './common';
import { isValidDayOfMonth } from '../utils/dates';

export const RELATIONSHIPS = [
  'Family',
  'Friend',
  'Partner',
  'Colleague',
  'Acquaintance',
  'Other',
] as const;

// Sent and replaced as a whole, so the day/month/year combination is always checked together.
const birthday = z
  .object({
    day: z.number().int().min(1).max(31),
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(1900).max(2100).nullable().optional(),
  })
  .refine((b) => isValidDayOfMonth(b.day, b.month, b.year ?? null), {
    message: 'is not a valid date',
    path: ['day'],
  });

const contactFields = {
  firstName: z.string().trim().min(1).max(100),
  lastName: optionalText(100),
  nickname: optionalText(100),
  email: z.email().max(191).nullable().optional(),
  phone: optionalText(50),
  relationship: z.enum(RELATIONSHIPS).optional(),
  birthday: birthday.nullable().optional(),
  notes: optionalText(5000),
  catchUpEveryDays: z.number().int().min(1).max(3650).nullable().optional(),
  isFavorite: z.boolean().optional(),
};

export const createContactSchema = z.object(contactFields);

export const updateContactSchema = z.object({
  ...contactFields,
  firstName: contactFields.firstName.optional(),
  isArchived: z.boolean().optional(),
});
