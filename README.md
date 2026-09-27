# ShiftMate

ShiftMate is a staff scheduling app for a small retail chain with several stores.

Live demo: https://shiftmate-lyart.vercel.app. On the sign-in page, click Try as Admin, Try as Manager or Try as Employee. The demo data resets every night.

## What it does

- Managers build each week on a grid. They drag shifts between people and days.
- ShiftMate warns about problems before a week is published. It checks unavailability, time off, short rest, the stores that each person works at, and the number of people on the floor. The database refuses double-bookings.
- A week with overtime (more than 40 hours, at all stores together) cannot be published until a manager approves the overtime.
- Employees see their shifts, set when they cannot work, ask for time off, and offer shifts to coworkers. A clean swap happens at once. A swap that causes a problem goes to a manager.
- The Labor cost page shows the cost of each week against the store budget, and exports a CSV file.
- Every change is recorded on the Activity page.

## Stack

Next.js 16 (App Router, server actions), TypeScript, Postgres on Neon and Prisma 7. Better Auth sends email sign-in links. The interface uses Tailwind CSS 4, shadcn/ui and dnd-kit. The tests use Vitest and Playwright. The app runs on Vercel.

## Run it on your computer

You need Node.js 22 and Docker.

```bash
docker run -d --name shiftmate-pg -e POSTGRES_USER=shiftmate -e POSTGRES_PASSWORD=shiftmate \
  -e POSTGRES_DB=shiftmate -p 127.0.0.1:54329:5432 postgres:17-alpine
docker exec shiftmate-pg psql -U shiftmate -c 'create database shiftmate_test'
cp .env.example .env    # then fill BETTER_AUTH_SECRET, DEMO_PASSWORD and CRON_SECRET
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev             # open http://localhost:3000
```

If `RESEND_API_KEY` is empty, sign-in links are printed in the terminal instead of emailed.

## Tests

```bash
npm test                  # unit tests: time zones, conflicts, overtime, cost, coverage, ranking
npm run test:integration  # services and database rules, against the shiftmate_test database
npx playwright test       # browser tests (starts the dev server if it is not running)
```

## More documents

- `docs/DEPLOY.md`: how the live site is set up and how to deploy.
- `docs/ENV.md`: every environment variable.
- `docs/DECISIONS.md`: the main design decisions and the reasons for them.
- `docs/CODE-MAP.md`: where things are in the code.
