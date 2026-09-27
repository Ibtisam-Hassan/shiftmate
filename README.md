# ShiftMate

Staff scheduling for multi-location retail: a weekly drag-and-drop schedule, availability and time off,
coworker shift swaps, conflict detection, overtime approval, and a labor-cost dashboard.

> Portfolio project. The live demo resets nightly. Use the "Try as Admin / Manager / Employee" buttons.

## Stack

Next.js 16 (App Router, server actions) · TypeScript · Postgres (Neon) · Prisma 7 · Better Auth (magic link) ·
Tailwind 4 + shadcn/ui · Vitest · Playwright · Vercel.

## Run locally

```bash
docker run -d --name shiftmate-pg -e POSTGRES_USER=shiftmate -e POSTGRES_PASSWORD=shiftmate \
  -e POSTGRES_DB=shiftmate -p 127.0.0.1:54329:5432 postgres:17-alpine
docker exec shiftmate-pg psql -U shiftmate -c 'create database shiftmate_test'
cp .env.example .env   # fill BETTER_AUTH_SECRET, DEMO_PASSWORD, CRON_SECRET
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev            # http://localhost:3000
```

Without `RESEND_API_KEY`, magic links are printed to the dev server log.

## Tests

```bash
npm test                  # unit (domain logic: time zones, conflicts, overtime, labor cost)
npm run test:integration  # services + DB constraints against shiftmate_test
npx playwright test       # end-to-end, starts the dev server if needed
```

Deployment, environment variables and design decisions: `docs/`.
