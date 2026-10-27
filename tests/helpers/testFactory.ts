import bcrypt from 'bcrypt';
import { prisma } from '../../src/config/prismaClient';

export async function createTestUser(
  params: { email?: string; password?: string; firstName?: string } = {}
) {
  const password = params.password ?? 'password123';
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      firstName: params.firstName ?? 'Test',
      lastName: 'User',
      email: params.email ?? `user${Date.now()}${Math.random()}@test.com`,
      passwordHash,
    },
  });

  return { user, rawPassword: password };
}

export async function createTestContact(params: {
  userId: number;
  firstName?: string;
  catchUpEveryDays?: number | null;
  birthday?: { day: number; month: number; year?: number };
  isArchived?: boolean;
  createdAt?: Date;
}) {
  return await prisma.contact.create({
    data: {
      userId: params.userId,
      firstName: params.firstName ?? 'Marko',
      catchUpEveryDays: params.catchUpEveryDays ?? null,
      birthdayDay: params.birthday?.day ?? null,
      birthdayMonth: params.birthday?.month ?? null,
      birthdayYear: params.birthday?.year ?? null,
      isArchived: params.isArchived ?? false,
      createdAt: params.createdAt ?? new Date(),
    },
  });
}
