import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/prismaClient';
import { cleanDatabase, disconnectDb } from './helpers/testDb';
import { bearer } from './helpers/testHelpers';
import { createTestContact, createTestUser } from './helpers/testFactory';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('Contacts', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectDb();
  });

  it('creates a contact with a birthday and a catch-up interval counted from today', async () => {
    const { user } = await createTestUser();

    const res = await request(app)
      .post('/contacts')
      .set('Authorization', bearer(user))
      .send({
        firstName: 'Jelena',
        lastName: '  ',
        relationship: 'Family',
        birthday: { day: 29, month: 2 },
        catchUpEveryDays: 14,
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      firstName: 'Jelena',
      lastName: null,
      relationship: 'Family',
      birthdayDay: 29,
      birthdayMonth: 2,
      birthdayYear: null,
      lastMetOn: null,
      userId: user.id,
    });
    const created = new Date(res.body.createdAt);
    const expected = Date.UTC(
      created.getUTCFullYear(),
      created.getUTCMonth(),
      created.getUTCDate() + 14
    );
    expect(new Date(res.body.catchUpDueOn).getTime()).toBe(expected);
  });

  it("another user's contact is forbidden", async () => {
    const { user } = await createTestUser();
    const { user: stranger } = await createTestUser();
    const contact = await createTestContact({ userId: user.id });

    const get = await request(app)
      .get(`/contacts/${contact.id}`)
      .set('Authorization', bearer(stranger));
    const del = await request(app)
      .delete(`/contacts/${contact.id}`)
      .set('Authorization', bearer(stranger));

    expect(get.status).toBe(403);
    expect(del.status).toBe(403);
  });

  it('lists only own, non-archived contacts and searches by name', async () => {
    const { user } = await createTestUser();
    const { user: stranger } = await createTestUser();
    await createTestContact({ userId: user.id, firstName: 'Ana' });
    await createTestContact({ userId: user.id, firstName: 'Anja' });
    await createTestContact({ userId: user.id, firstName: 'Bojan' });
    await createTestContact({ userId: user.id, firstName: 'Anastasija', isArchived: true });
    await createTestContact({ userId: stranger.id, firstName: 'Ana' });

    const all = await request(app).get('/contacts').set('Authorization', bearer(user));
    const search = await request(app).get('/contacts?search=an').set('Authorization', bearer(user));
    const archived = await request(app)
      .get('/contacts?isArchived=true')
      .set('Authorization', bearer(user));

    expect(all.body.meta.total).toBe(3);
    expect(search.body.data.map((c: { firstName: string }) => c.firstName)).toEqual([
      'Ana',
      'Anja',
      'Bojan',
    ]);
    expect(archived.body.data.map((c: { firstName: string }) => c.firstName)).toEqual([
      'Anastasija',
    ]);
  });

  it('changing the interval recomputes the catch-up date from the last meeting', async () => {
    const { user } = await createTestUser();
    const contact = await createTestContact({ userId: user.id });
    await prisma.contact.update({
      where: { id: contact.id },
      data: { lastMetOn: day('2026-10-01') },
    });

    const res = await request(app)
      .put(`/contacts/${contact.id}`)
      .set('Authorization', bearer(user))
      .send({ catchUpEveryDays: 30 });
    const cleared = await request(app)
      .put(`/contacts/${contact.id}`)
      .set('Authorization', bearer(user))
      .send({ catchUpEveryDays: null });

    expect(res.status).toBe(200);
    expect(res.body.catchUpDueOn).toBe('2026-10-31T00:00:00.000Z');
    expect(cleared.body.catchUpDueOn).toBeNull();
  });

  it('dueBy lists contacts to catch up with, most overdue first', async () => {
    const { user } = await createTestUser();
    const a = await createTestContact({ userId: user.id, firstName: 'A' });
    const b = await createTestContact({ userId: user.id, firstName: 'B' });
    await createTestContact({ userId: user.id, firstName: 'C' });
    await prisma.contact.update({ where: { id: a.id }, data: { catchUpDueOn: day('2026-10-20') } });
    await prisma.contact.update({ where: { id: b.id }, data: { catchUpDueOn: day('2026-09-01') } });

    const res = await request(app)
      .get('/contacts?dueBy=2026-11-05&sort=catchUp')
      .set('Authorization', bearer(user));

    expect(res.body.data.map((c: { firstName: string }) => c.firstName)).toEqual(['B', 'A']);
  });

  it('filters by when the contact was last met', async () => {
    const { user } = await createTestUser();
    const recent = await createTestContact({ userId: user.id, firstName: 'Recent' });
    const old = await createTestContact({ userId: user.id, firstName: 'Old' });
    await createTestContact({ userId: user.id, firstName: 'Never' });
    await prisma.contact.update({
      where: { id: recent.id },
      data: { lastMetOn: day('2026-11-01') },
    });
    await prisma.contact.update({ where: { id: old.id }, data: { lastMetOn: day('2026-05-01') } });
    const list = (query: string) =>
      request(app).get(`/contacts?${query}`).set('Authorization', bearer(user));
    const names = async (query: string) =>
      (await list(query)).body.data.map((c: { firstName: string }) => c.firstName);

    expect(await names('metSince=2026-11-01')).toEqual(['Recent']);
    expect(await names('notMetSince=2026-08-01')).toEqual(['Old']);
    expect(await names('neverMet=true')).toEqual(['Never']);
    expect(await names('neverMet=false')).toEqual(['Old', 'Recent']);
    expect((await list('neverMet=true&metSince=2026-01-01')).status).toBe(400);
  });

  it('deleting a contact deletes meetings only they were in, and keeps shared ones', async () => {
    const { user } = await createTestUser();
    const marko = await createTestContact({ userId: user.id, firstName: 'Marko' });
    const ana = await createTestContact({ userId: user.id, firstName: 'Ana' });
    const auth = bearer(user);
    const solo = await request(app)
      .post('/meetings')
      .set('Authorization', auth)
      .send({ contactIds: [marko.id], date: '2026-10-01' });
    const shared = await request(app)
      .post('/meetings')
      .set('Authorization', auth)
      .send({ contactIds: [marko.id, ana.id], date: '2026-10-10' });

    const res = await request(app).delete(`/contacts/${marko.id}`).set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(await prisma.meeting.findUnique({ where: { id: solo.body.id } })).toBeNull();
    const remaining = await request(app)
      .get(`/meetings/${shared.body.id}`)
      .set('Authorization', auth);
    expect(remaining.body.contacts).toEqual([
      { id: ana.id, firstName: 'Ana', lastName: null, nickname: null },
    ]);
  });
});
