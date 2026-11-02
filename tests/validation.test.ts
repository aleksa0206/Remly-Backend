import request from 'supertest';
import app from '../src/app';
import { cleanDatabase, disconnectDb } from './helpers/testDb';
import { bearer } from './helpers/testHelpers';
import { createTestContact, createTestUser } from './helpers/testFactory';

describe('Zod validation - rejects bad input', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectDb();
  });

  it('rejects registering with an invalid email', async () => {
    const res = await request(app).post('/auth/register').send({
      firstName: 'Test',
      lastName: 'User',
      email: 'not-an-email',
      password: 'password123',
    });

    expect(res.status).toBe(400);
    expect(res.body.details[0].path).toBe('email');
  });

  it('rejects a contact without a first name and with an impossible birthday', async () => {
    const { user } = await createTestUser();

    const res = await request(app)
      .post('/contacts')
      .set('Authorization', bearer(user))
      .send({ birthday: { day: 29, month: 2, year: 2026 } });

    expect(res.status).toBe(400);
    expect(res.body.details.map((d: { path: string }) => d.path).sort()).toEqual([
      'birthday.day',
      'firstName',
    ]);
  });

  it('rejects a meeting without contacts, with a malformed date or time', async () => {
    const { user } = await createTestUser();

    const res = await request(app)
      .post('/meetings')
      .set('Authorization', bearer(user))
      .send({ contactIds: [], date: '10/01/2026', time: '25:00' });

    expect(res.status).toBe(400);
    expect(res.body.details.map((d: { path: string }) => d.path).sort()).toEqual([
      'contactIds',
      'date',
      'time',
    ]);
  });

  it('rejects an unknown list filter', async () => {
    const { user } = await createTestUser();
    await createTestContact({ userId: user.id });

    const res = await request(app).get('/meetings?status=Maybe').set('Authorization', bearer(user));

    expect(res.status).toBe(400);
  });
});
