import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/prismaClient';
import { cleanDatabase, disconnectDb } from './helpers/testDb';
import { bearer } from './helpers/testHelpers';
import { createTestContact, createTestUser } from './helpers/testFactory';

async function setup() {
  const { user } = await createTestUser();
  const marko = await createTestContact({
    userId: user.id,
    firstName: 'Marko',
    catchUpEveryDays: 30,
  });
  const ana = await createTestContact({ userId: user.id, firstName: 'Ana' });
  return { user, marko, ana, auth: bearer(user) };
}

async function contact(id: number) {
  return await prisma.contact.findUniqueOrThrow({ where: { id } });
}

const iso = (date: Date | null) => date?.toISOString().slice(0, 10) ?? null;

describe('Meetings', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectDb();
  });

  it('logging a meeting updates when you last met and when to catch up again', async () => {
    const { marko, ana, auth } = await setup();

    const res = await request(app)
      .post('/meetings')
      .set('Authorization', auth)
      .send({
        contactIds: [marko.id, ana.id, marko.id],
        date: '2026-10-01',
        type: 'InPerson',
        location: 'Kafana',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'Done', type: 'InPerson', location: 'Kafana' });
    expect(res.body.contacts.map((c: { id: number }) => c.id)).toEqual([marko.id, ana.id]);
    const updated = await contact(marko.id);
    expect(iso(updated.lastMetOn)).toBe('2026-10-01');
    expect(iso(updated.catchUpDueOn)).toBe('2026-10-31');
    expect((await contact(ana.id)).catchUpDueOn).toBeNull();
  });

  it('a planned meeting sets the next planned date and completing it moves it to last met', async () => {
    const { marko, auth } = await setup();
    const planned = await request(app)
      .post('/meetings')
      .set('Authorization', auth)
      .send({ contactIds: [marko.id], date: '2099-01-15', time: '19:30', status: 'Planned' });

    expect(planned.status).toBe(201);
    expect(iso((await contact(marko.id)).nextPlannedOn)).toBe('2099-01-15');

    const done = await request(app)
      .post(`/meetings/${planned.body.id}/complete`)
      .set('Authorization', auth)
      .send({ date: '2026-10-20', notes: 'Talked about the trip' });

    expect(done.status).toBe(200);
    expect(done.body).toMatchObject({ status: 'Done', notes: 'Talked about the trip' });
    const updated = await contact(marko.id);
    expect(updated.nextPlannedOn).toBeNull();
    expect(iso(updated.lastMetOn)).toBe('2026-10-20');
    expect(iso(updated.catchUpDueOn)).toBe('2026-11-19');
  });

  it('completing twice is a 409', async () => {
    const { marko, auth } = await setup();
    const planned = await request(app)
      .post('/meetings')
      .set('Authorization', auth)
      .send({ contactIds: [marko.id], date: '2026-10-01', status: 'Planned' });

    const first = await request(app)
      .post(`/meetings/${planned.body.id}/complete`)
      .set('Authorization', auth)
      .send({});
    const second = await request(app)
      .post(`/meetings/${planned.body.id}/complete`)
      .set('Authorization', auth)
      .send({});

    expect(first.status).toBe(200);
    expect(first.body.date).toBe('2026-10-01T00:00:00.000Z');
    expect(second.status).toBe(409);
  });

  it('a meeting far in the future cannot be logged as done', async () => {
    const { marko, auth } = await setup();

    const res = await request(app)
      .post('/meetings')
      .set('Authorization', auth)
      .send({ contactIds: [marko.id], date: '2099-01-01' });

    expect(res.status).toBe(400);
    expect(res.body.details[0].path).toBe('date');
  });

  it("cannot include another user's contact or touch their meetings", async () => {
    const { marko, auth } = await setup();
    const { user: stranger } = await createTestUser();
    const theirs = await createTestContact({ userId: stranger.id });

    const create = await request(app)
      .post('/meetings')
      .set('Authorization', auth)
      .send({ contactIds: [marko.id, theirs.id], date: '2026-10-01' });
    const own = await request(app)
      .post('/meetings')
      .set('Authorization', auth)
      .send({ contactIds: [marko.id], date: '2026-10-01' });
    const peek = await request(app)
      .get(`/meetings/${own.body.id}`)
      .set('Authorization', bearer(stranger));

    expect(create.status).toBe(403);
    expect(peek.status).toBe(403);
  });

  it('replacing the people in a meeting refreshes both the old and the new ones', async () => {
    const { marko, ana, auth } = await setup();
    const meeting = await request(app)
      .post('/meetings')
      .set('Authorization', auth)
      .send({ contactIds: [marko.id], date: '2026-10-01' });

    const res = await request(app)
      .put(`/meetings/${meeting.body.id}`)
      .set('Authorization', auth)
      .send({ contactIds: [ana.id] });

    expect(res.status).toBe(200);
    expect((await contact(marko.id)).lastMetOn).toBeNull();
    expect(iso((await contact(ana.id)).lastMetOn)).toBe('2026-10-01');
  });

  it('deleting the latest meeting falls back to the one before', async () => {
    const { marko, auth } = await setup();
    await request(app)
      .post('/meetings')
      .set('Authorization', auth)
      .send({ contactIds: [marko.id], date: '2026-09-01' });
    const latest = await request(app)
      .post('/meetings')
      .set('Authorization', auth)
      .send({ contactIds: [marko.id], date: '2026-10-01' });

    await request(app).delete(`/meetings/${latest.body.id}`).set('Authorization', auth);

    expect(iso((await contact(marko.id)).lastMetOn)).toBe('2026-09-01');
  });

  it('lists meetings of one contact, filtered by status', async () => {
    const { marko, ana, auth } = await setup();
    for (const [contactId, date, status] of [
      [marko.id, '2026-09-01', 'Done'],
      [marko.id, '2026-10-01', 'Done'],
      [marko.id, '2099-01-01', 'Planned'],
      [ana.id, '2026-10-05', 'Done'],
    ] as const) {
      await request(app)
        .post('/meetings')
        .set('Authorization', auth)
        .send({ contactIds: [contactId], date, status });
    }

    const res = await request(app)
      .get(`/meetings?contactId=${marko.id}&status=Done`)
      .set('Authorization', auth);

    expect(res.body.data.map((m: { date: string }) => m.date.slice(0, 10))).toEqual([
      '2026-10-01',
      '2026-09-01',
    ]);
  });
});
