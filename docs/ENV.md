# Environment variables

Local development reads `.env`. Vercel keeps its own values for each environment. Never commit a real value.

| Name | Needed | What it is |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection for the app. On Neon, use the pooled URL. The Neon integration sets it on Vercel. |
| `DATABASE_URL_UNPOOLED` | On Neon | Direct Postgres connection. Migrations use it because the pooled connection can fail during migrations. The Neon integration sets it. |
| `DIRECT_URL` | No | Overrides the connection for migrations. Use it only with a database that is not on Neon. |
| `BETTER_AUTH_SECRET` | Yes | Signs session cookies. Make one with `openssl rand -base64 32`. Use a different value in each environment. |
| `APP_URL` | No | The public address, used in sign-in links. On Vercel, ShiftMate uses the address of the deployment if this is empty. |
| `RESEND_API_KEY` | No | Sends sign-in emails through Resend. If it is empty, links go to the server log. |
| `EMAIL_FROM` | No | Sender of sign-in emails. The default is `ShiftMate <onboarding@resend.dev>`. |
| `DEMO_MODE` | No | `true` shows the demo buttons and allows the nightly reset. |
| `DEMO_PASSWORD` | With demo | Password of the demo accounts. Nobody types it: the demo buttons use it on the server. Make one with `openssl rand -hex 16`. |
| `OWNER_EMAIL` | No | A real email that stays an admin through every demo reset. |
| `CRON_SECRET` | With demo | Protects the nightly reset address. Vercel sends it with each scheduled call. Make one with `openssl rand -hex 24`. |

On Vercel, the Resend free plan without your own domain only delivers to the email of the Resend account owner. For sign-in emails to anyone, verify a domain in Resend first.
