import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/prismaClient';
import { cleanDatabase, disconnectDb } from './helpers/testDb';
import { bearer } from './helpers/testHelpers';
import { createTestContact, createTestUser } from './helpers/testFactory';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('Dashboard', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectDb();
  });

  it("shows upcoming meetings, who to catch up with and birthdays relative to the user's today", async () => {
    const { user } = await createTestUser();
    const auth = bearer(user);
    const marko = await createTestContact({ userId: user.id, firstName: 'Marko' });
    const ana = await createTestContact({
      userId: user.id,
      firstName: 'Ana',
      birthday: { day: 12, month: 11, year: 1990 },
    });
    const bojan = await createTestContact({ userId: user.id, firstName: 'Bojan' });
    await createTestContact({
      userId: user.id,
      firstName: 'Archived',
      birthday: { day: 6, month: 11 },
      isArchived: true,
    });
    await prisma.contact.update({
      where: { id: bojan.id },
      data: { catchUpDueOn: day('2026-10-01') },
    });

    await request(app)
      .post('/meetings')
      .set('Authorization', auth)
      .send({ contactIds: [marko.id], date: '2026-11-08', status: 'Planned' });
    await request(app)
      .post('/meetings')
      .set('Authorization', auth)
      .send({ contactIds: [marko.id], date: '2026-12-31', status: 'Planned' });
    await request(app)
      .post('/meetings')
      .set('Authorization', auth)
      .send({ contactIds: [ana.id], date: '2026-10-20' });

    const res = await request(app).get('/dashboard?today=2026-11-05').set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.upcoming.map((m: { date: string }) => m.date.slice(0, 10))).toEqual([
      '2026-11-08',
    ]);
    expect(res.body.catchUp.map((c: { firstName: string }) => c.firstName)).toEqual(['Bojan']);
    expect(res.body.birthdays).toEqual([
      expect.objectContaining({
        date: '2026-11-12T00:00:00.000Z',
        turns: 36,
        contact: expect.objectContaining({ firstName: 'Ana' }),
      }),
    ]);
    expect(res.body.recent).toHaveLength(1);
    expect(res.body.stats).toEqual({ contacts: 3, plannedTotal: 1, metLast30Days: 1 });
  });
});
