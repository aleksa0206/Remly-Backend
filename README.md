# Remly — Backend

**People · Meetings · Keeping in touch**

REST API for Remly, a personal contacts app that keeps track of when you last saw someone, what is planned next and who you have not seen in a while. Every user's contacts and meetings are private to them.

- Live: [remly.space](https://remly.space)
- Frontend: [Remly-Frontend](https://github.com/aleksa0206/Remly-Frontend) (Angular)

## Features

- **Contacts** — name, nickname, phone, email, relationship (family, friend, partner, colleague, acquaintance, other), birthday (the year is optional), notes, favourite and archive flags.
- **Keep in touch** — an optional "see them every N days" interval per contact. The API keeps each contact's last meeting, next planned meeting and catch-up date up to date, so lists can be filtered and sorted by who is overdue.
- **Meetings** — log a meeting that happened or plan one ahead: date, optional time, type (in person, call, video call, message), title, location and notes, with one or more contacts. Completing a planned meeting is guarded, so a double click cannot complete it twice.
- **Dashboard** — one request for the overview screen: upcoming and overdue planned meetings, who to catch up with, birthdays in the next 30 days, recent meetings and a few totals, all relative to the user's own calendar day.

## Security

- Short-lived JWT access token (15 min) in the response body; opaque refresh token, stored hashed, rotated on every use and sent only as an `httpOnly`, `sameSite=strict` cookie.
- Optional TOTP two-factor authentication. The temporary 2FA token is rejected everywhere except the verification endpoint.
- Account lockout after 5 failed logins, timing-safe login (no account enumeration), hashed and expiring password-reset tokens.
- DB-backed rate limiting, so limits hold across instances.
- Every query is scoped to the caller; another user's contacts and meetings return 403/404.
- Environment variables are validated at startup.

## Tech stack

Node.js 24 · TypeScript · Express 5 · Prisma 7 (MariaDB adapter) on MySQL 8 · Zod · Pino · Jest + Supertest · Nodemailer · Docker · Prometheus metrics

Layered architecture: `routes → controllers → services → repositories → Prisma`. Business rules and authorization live in services; only repositories touch the database.

## Getting started

Requirements: Node.js 24 and MySQL 8 (local install or `docker-compose up -d`).

```bash
npm install
cp .env.example .env            # set JWT_SECRET (at least 32 characters) and the DB settings
npx prisma migrate deploy
npx prisma generate
npm run dev                     # http://localhost:4000
```

Then create an account with `POST /auth/register` (or through the frontend at `/register`).

### Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `PORT` | no | Default `4000` |
| `NODE_ENV` | no | `development` / `test` / `production` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | yes | Used by the app. On Windows use `127.0.0.1`, not `localhost` |
| `DATABASE_URL` | yes | Used only by the Prisma CLI (migrations) |
| `JWT_SECRET` | yes | At least 32 characters |
| `FRONTEND_URL` | in production | CORS origin and password-reset links |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | in production | Password-reset emails |
| `TRUST_PROXY` | no | Number of reverse proxies in front of the app (default `0`) |
| `METRICS_TOKEN` | no | Enables `GET /metrics` for Prometheus |

## API overview

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`, `GET /auth/me`, 2FA under `/auth/2fa/*` |
| Profile | `PUT /users/me` |
| Contacts | `GET /contacts?search&relationship&isFavorite&isArchived&dueBy&sort=name\|lastMet\|catchUp`, `POST`, `GET/PUT/DELETE /contacts/:id` |
| Meetings | `GET /meetings?status=Planned,Done&contactId&from&to&order=asc\|desc`, `POST`, `GET/PUT/DELETE /meetings/:id`, `POST /meetings/:id/complete` |
| Dashboard | `GET /dashboard?today=YYYY-MM-DD` |
| Health | `GET /health` |

Lists are paginated (`?page&limit`, max 100) and return `{ data, meta }`. Dates are `YYYY-MM-DD`; a birthday is sent as `{ day, month, year? }`. Archived contacts are left out of `/contacts` unless `isArchived=true`. Deleting a contact also deletes the meetings nobody else was in.

## Tests

Integration tests run against a real MySQL database configured in `.env.test` (same variables, separate database).

```bash
npm run test:migrate   # after every new migration
npm test
```

CI (GitHub Actions) runs formatting, type checking and the full test suite against MySQL 8, and builds the Docker image.

## Deployment

`docker-compose.prod.yaml` runs MySQL, a one-shot migration container, the API and the frontend (nginx, which also proxies `/api`) on a single host. The frontend repository is expected next to this one (`../Remly-Frontend`).

```bash
docker compose -p remly --env-file .env.production -f docker-compose.prod.yaml up -d --build
```

Keep `DB_USER`, `DB_PASSWORD` and `DB_NAME` alphanumeric: they are interpolated into a connection URL.
