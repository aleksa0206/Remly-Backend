# Remly Backend

[![CI](https://github.com/aleksa0206/Remly-Backend/actions/workflows/ci.yml/badge.svg)](https://github.com/aleksa0206/Remly-Backend/actions/workflows/ci.yml)

API for Remly, an app for keeping track of people: when you last saw someone, what's planned next and who you haven't seen in a while.

Live: [remly.space](https://remly.space) | Frontend: [Remly-Frontend](https://github.com/aleksa0206/Remly-Frontend)

## What it does

- Contacts with birthday, relationship, notes, favourite/archive flags
- "Keep in touch" interval per contact (e.g. every 30 days), contacts can be sorted by who is overdue
- Meetings, past or planned, with one or more contacts
- Dashboard endpoint with upcoming meetings, overdue catch-ups and birthdays in the next 30 days

## Stack

Node.js 24, TypeScript, Express 5, Prisma 7, MySQL 8, Zod, Jest + Supertest, Docker.

Code is split into routes, controllers, services and repositories. Auth is JWT + refresh token in an httpOnly cookie, with optional TOTP 2FA.

## Running locally

Needs Node.js 24 and MySQL 8 (or `docker-compose up -d`).

```bash
npm install
cp .env.example .env    # set JWT_SECRET and DB settings
npx prisma migrate deploy
npx prisma generate
npm run dev             # http://localhost:4000
```

### Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `PORT` | no | default `4000` |
| `NODE_ENV` | no | `development` / `test` / `production` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | yes | on Windows use `127.0.0.1`, not `localhost` |
| `DATABASE_URL` | yes | only for Prisma CLI (migrations) |
| `JWT_SECRET` | yes | at least 32 characters |
| `FRONTEND_URL` | in production | CORS and reset links |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | in production | password reset emails |
| `TRUST_PROXY` | no | number of proxies in front of the app |
| `METRICS_TOKEN` | no | enables `GET /metrics` |

## API

| Area | Endpoints |
| --- | --- |
| Auth | `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/me`, `/auth/2fa/*` |
| Profile | `PUT /users/me` |
| Contacts | `GET/POST /contacts`, `GET/PUT/DELETE /contacts/:id` |
| Meetings | `GET/POST /meetings`, `GET/PUT/DELETE /meetings/:id`, `POST /meetings/:id/complete` |
| Dashboard | `GET /dashboard?today=YYYY-MM-DD` |
| Health | `GET /health` |

Lists are paginated with `?page&limit` and return `{ data, meta }`.

## Tests

Integration tests run against a real MySQL database from `.env.test`.

```bash
npm run test:migrate
npm test
```

## Deployment

`docker-compose.prod.yaml` runs MySQL, migrations, the API and the frontend (nginx) on one server. It expects `../Remly-Frontend` next to this repo.

```bash
docker compose -p remly --env-file .env.production -f docker-compose.prod.yaml up -d --build
```

Keep `DB_USER`, `DB_PASSWORD` and `DB_NAME` alphanumeric, they go into a connection URL.
