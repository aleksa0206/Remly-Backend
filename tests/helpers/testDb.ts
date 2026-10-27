import { prisma } from '../../src/config/prismaClient';

export async function cleanDatabase() {
  await prisma.rateLimitEntry.deleteMany();
  await prisma.meetingContact.deleteMany();
  await prisma.meeting.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

export async function disconnectDb() {
  await prisma.$disconnect();
}
