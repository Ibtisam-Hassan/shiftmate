# Deploy

## How the live site is set up

- Vercel project `shiftmate` on the Hobby plan. It is connected to the GitHub repository. A push to `main` deploys to production. Other branches get a preview address.
- Postgres on Neon (free plan, region `us-east-1`), added through the Storage tab of the Vercel project.
- The environment variables are listed in `docs/ENV.md`. Production and Preview use different secrets.
- A scheduled job (Vercel Cron) calls `/api/cron/reset-demo` every day at 08:00 UTC to rebuild the demo data.

## What a deploy runs

The build command is in `vercel.json`:

1. `npm run db:migrate` applies new database migrations.
2. `npm run db:seed-if-empty` fills the database with demo data, but only when the database is empty.
3. `npm run build` builds the app.

## Deploy a change

1. Make sure that `npm run lint`, `npm run typecheck`, the tests and `npm run build` pass.
2. Push to `main`. GitHub Actions runs every check. Vercel builds and deploys.
3. Open https://shiftmate-lyart.vercel.app/api/health. It must show `{"ok":true}`.

To deploy by hand, run `npx vercel deploy --prod` in the project folder. The `.vercelignore` file keeps local `.env` files, tests and design files out of the upload.

## Roll back

In the Vercel dashboard, open Deployments, choose the last good deployment, and click Promote to Production. Database migrations do not roll back, so write each migration so that the previous version of the app still works with it.

## Set up a new copy

1. Create a Vercel project from the repository.
2. In the Storage tab, add a Neon database and connect it to every environment.
3. Add the variables from `docs/ENV.md`.
4. Deploy. The first build creates the tables and the demo data.

## Known limits

- The Vercel Hobby plan is for personal, non-commercial use. A real business must use a paid plan.
- The Neon free plan pauses an idle database. The first request after a pause takes about one second longer.
- Sign-in emails are not sent in production until `RESEND_API_KEY` is set. The demo buttons do not need email.
