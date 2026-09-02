# Wedding Invitation Intake

A production-shaped rebuild of the single-file intake prototype, written end to end in
**TypeScript**. It has three parts:

- **Public form** — a React + TypeScript port of the original "Tell us about your day" form, same burgundy-and-gold design, autosaves a draft as the couple types, and **submits to an API** instead of copying text to the clipboard.
- **API + database** — an Express server that validates each submission and stores it in a **hosted PostgreSQL** database (via Prisma), including uploaded photos and audio.
- **Admin area** — a password-protected dashboard where the studio reviews submissions, filters by status, reads every answer, downloads the brief, opens uploaded media, and logs **follow-up notes**.

```
wedding-intake/
├── client/                      React + Vite app in TSX (public form + admin)
├── server/                      Express API in TS, Prisma schema, migrations, seed
├── docker-compose.local-db.yml  Optional local Postgres (not used by default)
└── package.json                 Dev orchestration scripts
```

## Quick start

Prerequisites: Node 18+ and a **hosted PostgreSQL database** you can reach
(Prisma Postgres, Neon, Supabase, RDS — anything that speaks Postgres).

```bash
# 1. Install everything (root, server, client)
npm run install:all

# 2. Configure the server
cp server/.env.example server/.env
#    Fill in DATABASE_URL + DIRECT_DATABASE_URL from your provider,
#    and set JWT_SECRET + SEED_ADMIN_* for real use.

# 3. Create tables on the live database and the first admin user
npm run setup:server                    # prisma generate + migrate deploy + seed

# 4. Configure the client (optional in dev — the proxy handles it)
cp client/.env.example client/.env

# 5. Run both apps
npm run dev
```

- Public form: http://localhost:5173
- Admin: http://localhost:5173/admin (sign in with the `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from `server/.env`)
- API: http://localhost:4000 — `GET /api/health` reports database reachability

The server runs straight from TypeScript in dev (`tsx watch`); no build step is
needed until you deploy.

> **Change `SEED_ADMIN_PASSWORD` and `JWT_SECRET` before deploying.** The defaults are for local use only.

> `server/.env` now holds live database credentials. It is gitignored — keep it
> that way, and rotate the credential if it ever leaves your machine.

## Working with the live database

The app connects through the **pooled** endpoint (`DATABASE_URL`); Prisma Migrate
uses the **direct** one (`DIRECT_DATABASE_URL`), because poolers do not support
the session-level statements migrations issue. Both point at the same database.

| Command | What it does |
|---------|--------------|
| `npm run db:status` | Which migrations the live database has, and which are pending |
| `npm run db:deploy` | Apply pending migrations (safe to re-run; this is the deploy step) |
| `npm run db:migrate:new` | Print the SQL needed to bring the database up to `schema.prisma` |
| `npm run db:studio` | Browse and edit rows in Prisma Studio |

### Changing the schema

`prisma migrate dev` is **not** used here: it wants a shadow database it can
create and drop, which hosted providers normally forbid. Instead:

```bash
# 1. Edit server/prisma/schema.prisma

# 2. Generate the SQL for the change and review it
npm run db:migrate:new > /tmp/next.sql

# 3. Save it as a migration
mkdir -p server/prisma/migrations/$(date +%Y%m%d%H%M%S)_describe_the_change
mv /tmp/next.sql server/prisma/migrations/*_describe_the_change/migration.sql

# 4. Apply it, then regenerate the client
npm run db:deploy
npm --prefix server run prisma:generate
```

Read the generated SQL before applying it — this runs against real data, and a
column rename can come back as a drop-and-add. `server/prisma/migrations/` is
committed on purpose: it is the record of what the live database has had done to it.

For throwaway experiments only, `npm --prefix server run prisma:push` syncs the
schema without writing a migration. Never point it at production.

## Developing against a local database instead

If you want to work offline, `docker-compose.local-db.yml` still spins up a
throwaway Postgres:

```bash
docker compose -f docker-compose.local-db.yml up -d
```

Then set both URLs in `server/.env` to
`postgresql://wedding:wedding@localhost:5432/wedding_intake?schema=public` and run
`npm run setup:server`. Switch the URLs back to your hosted database to return to
live data.

## How a submission flows

1. The couple fills in the form. Answers autosave to `localStorage` under `ei-intake-draft-v2`.
2. On submit, the client `POST`s the answers as JSON to `/api/submissions`. Files upload separately to `/api/submissions/:id/files`.
3. The server validates the payload (Zod), drops unknown fields, promotes key columns (contact, couple names, wedding date, guest count) for fast filtering, and stores the **complete answer set** in a JSON column so nothing is ever lost.
4. The studio signs in and works the queue: change status, read answers, download the text brief, open media, add notes.

## TypeScript

Both packages are TypeScript with `strict` on (plus `noUncheckedIndexedAccess`,
so indexing into a record or array yields `T | undefined` and has to be handled).

| Command | What it does |
|---------|--------------|
| `npm run typecheck` | Typecheck both packages without emitting |
| `npm run build` | Compile the server to `server/dist` and bundle the client to `client/dist` |
| `npm run build:server` / `npm run build:client` | Either half on its own |

**Server** — `tsx watch src/index.ts` in dev, `tsc` → `dist/` for production, run
with `npm --prefix server start`. It compiles under `module: NodeNext`, so
**import specifiers keep their `.js` suffix** (`./lib/prisma.js` resolves to
`lib/prisma.ts`). That is Node's ESM resolver, not a mistake — dropping the
suffix breaks the compiled output.

**Client** — Vite resolves imports, so client specifiers are extensionless.
`npm --prefix client run build` typechecks before bundling, so a type error
fails the build rather than shipping.

### Where the types live

- `src/lib/formSchema.ts` (in both packages) types the form itself. `FormField`
  is a **union discriminated on `type`**, so narrowing with `field.type === 'select'`
  is what reveals `field.options`. Narrow on `field.type`, not on a destructured
  `const { type } = field` — destructuring narrows the local, not the object.
- `client/src/lib/types.ts` describes what each API endpoint returns. It is
  handwritten and mirrors the server's selects; if you change what a route
  returns, change this too — nothing checks the two against each other.
- `server/src/types/express.d.ts` declares `req.admin`, set by `requireAdmin`.
- Prisma generates its own model types; run `npm --prefix server run prisma:generate`
  after editing `schema.prisma` or the types will lag behind the schema.

### Data model (Prisma)

| Model | Purpose |
|-------|---------|
| `Submission` | One intake. Promoted columns + full `data` JSON + `answered`/`total`. |
| `FollowUpNote` | A note an admin leaves against a submission. |
| `MediaFile` | An uploaded photo/audio file (stored on disk; swap for S3 in prod). |
| `AdminUser` | Someone who can sign in. Passwords are bcrypt-hashed. |

The form's field definitions live in one shared file — `src/lib/formSchema.ts` — copied into both `client` and `server` so rendering, storage, and the exported brief never drift apart. The two copies are byte-identical on purpose; change one and copy it across.

## API reference

Public:
- `POST /api/submissions` — `{ data: { field: value | [values] } }` → `{ id, createdAt }`
- `POST /api/submissions/:id/files` — multipart; part names match form inputs (`photo_hero`, `photo_gallery`, …)

Admin (Bearer token from login):
- `POST /api/auth/login` → `{ token, admin }`
- `GET  /api/auth/me`
- `GET  /api/admin/submissions?status=&q=&page=&pageSize=`
- `GET  /api/admin/submissions/:id`
- `PATCH /api/admin/submissions/:id` — `{ status }`
- `POST /api/admin/submissions/:id/notes` — `{ body }`
- `GET  /api/admin/submissions/:id/brief` — text download
- `GET  /api/admin/files/:id` — stream a stored file

Statuses: `NEW`, `IN_REVIEW`, `IN_PROGRESS`, `AWAITING_CLIENT`, `DONE`, `ARCHIVED`.

## Security notes

- JWT auth on all admin routes; bcrypt password hashing; login is constant-time against unknown users.
- Rate limiting on the public submit endpoint and the login endpoint.
- Helmet, CORS locked to `CORS_ORIGIN`, 1 MB JSON body cap, upload size cap (`MAX_UPLOAD_MB`), and image/audio-only file filtering.
- Unknown form fields are discarded rather than trusted.

## Deploying to production

- **Database:** already a managed Postgres. Use a *separate* database from the one you develop against, set `DATABASE_URL` + `DIRECT_DATABASE_URL` for it, and run `npm run db:deploy` as part of each release. Take a backup before any migration that drops or rewrites a column.
- **Server:** run `npm run build:server` first — `npm --prefix server start` runs the compiled `dist/`, not the TypeScript. Set `NODE_ENV=production`, a strong `JWT_SECRET`, and the real `CORS_ORIGIN`. Put it behind a reverse proxy for TLS.
- **Client:** `npm run build:client` produces `client/dist`; serve it as static files and set `VITE_API_BASE` to the API origin at build time.
- **Uploads:** local disk works for a single instance. For multiple instances or durability, replace `server/src/lib/upload.ts` with an S3 (or compatible) storage engine — the `MediaFile` row already records everything needed to reference an object key.

## What changed from the prototype

The original was a single HTML file using a bespoke component runtime, saving only to `localStorage` and "submitting" by opening a pre-filled email. This version keeps the exact form content and look, but the submission now lands in a real database, media is uploaded and retrievable, the studio has a proper follow-up workflow behind a login, and every file is typed.
